import { getError } from '@venizia/ignis-inversion';
import { HTTP } from '@venizia/ignis-helpers/common';
import { HttpHeaders } from '@venizia/ignis-helpers/core';
import { HttpExtraRequest } from '@venizia/ignis-kernel/repository';

import {
  App,
  type IApplicationInfo,
  type IAuthRecoveryOptions,
  type IAuthTokenRecord,
  type IDataSourceAuth,
  type IGetRequestPropsParams,
  type IGetRequestPropsResult,
  RequestChannel,
  RequestCountData,
  type TNoAuthPathRegex,
} from '@/common';
import type { AuthRecoveryHelper } from '@/helpers';
import { type IEncodedBody, NetworkResponseReader, RequestBodyEncoder } from '@/utilities';
import type { DefaultAuthService } from './auth';
import { BaseService } from './base';

/** Who sent a request, and with which token: what a 401 is judged against. */
interface ISentSession {
  /** `undefined` when the service cannot tell who is signed in (no auth service, or no user id stored). */
  userId?: string;
  token?: string;
}

/**
 * The `normalized.code` of the 401 that answers a request whose session is gone: the user who sent it signed out or another user signed in while it was in flight.
 */
export const SESSION_CHANGED_CODE = 'ardor.network.session_changed';

/**
 * The session side of `DefaultNetworkRequestService`: who is signed in, which requests go without a
 * token, the headers and body of a request, and what an `HttpDataSource` needs to share them.
 */
export abstract class AbstractNetworkSessionService extends BaseService {
  /** Resources sent without a token, matched exactly. */
  protected noAuthPaths?: string[];
  /** `noAuthPathRegex` compiled; a resource matching any is sent without a token. */
  protected noAuthPathRegexes: RegExp[];
  /** Headers added to every request. */
  protected headers: Headers;
  protected authRecovery?: IAuthRecoveryOptions;
  protected authService?: DefaultAuthService;

  /** The one refresh every 401 in flight shares; the subclass makes it. */
  protected recovery: AuthRecoveryHelper;

  /** The session each data source request was sent under, keyed by the context object IGNIS hands to both hooks. */
  private readonly sentSessions = new WeakMap<object, ISentSession>();

  /** The token sent with a request, `undefined` when there is none. */
  protected abstract resolveAuthToken(): IAuthTokenRecord | undefined;

  /** The tracing id of a request. */
  protected abstract buildRequestTracingId(opts: { applicationInfo: IApplicationInfo }): string;

  /** Refreshes the session, once for every 401 in flight. */
  abstract refresh(): Promise<boolean>;

  /**
   * Whether a request goes without a token: its `resource` is in `noAuthPaths`, or the resource, or
   * the joined `paths`, matches `noAuthPathRegex`. To send no token at all (an API with no sign-in),
   * set `noAuthPathRegex: /./`.
   */
  protected isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean {
    const { resource, paths } = opts;

    if (resource && this.noAuthPaths?.includes(resource)) {
      return true;
    }

    if (!this.noAuthPathRegexes.length) {
      return false;
    }

    const candidates = [resource, paths?.join('/')].filter((item): item is string => !!item);

    if (!candidates.length) {
      return false;
    }

    return this.noAuthPathRegexes.some((regex) => {
      return candidates.some((candidate) => {
        regex.lastIndex = 0;

        return regex.test(candidate);
      });
    });
  }

  /** `noAuthPathRegex` as `RegExp`s; a string is compiled, and an invalid one is logged and dropped. */
  protected compileNoAuthPathRegex(opts: { input?: TNoAuthPathRegex }): RegExp[] {
    const { input } = opts;

    if (!input) {
      return [];
    }

    const patterns = Array.isArray(input) ? input : [input];
    const compiled: RegExp[] = [];

    for (const pattern of patterns) {
      if (!pattern) {
        continue;
      }

      if (pattern instanceof RegExp) {
        compiled.push(pattern);
        continue;
      }

      try {
        compiled.push(new RegExp(pattern));
      } catch (error) {
        this.logger.error(
          '[compileNoAuthPathRegex] Invalid noAuthPathRegex pattern: %s | error: %o',
          pattern,
          error,
        );
      }
    }

    return compiled;
  }

  /** The session signed in now: who, and with which token. */
  protected readSession(): ISentSession {
    const userId = this.authService?.getUser().userId;

    return {
      userId: userId === undefined ? undefined : `${userId}`,
      token: this.resolveAuthToken()?.value,
    };
  }

  /** The 401 that answers a request whose session is gone: `DefaultAuthProvider.checkError` leaves the signed-in session alone for it. */
  protected sessionChangedError(): Error {
    return getError({
      statusCode: 401,
      messageCode: SESSION_CHANGED_CODE,
      message: '[doRequest] The session that sent this request ended while it was in flight',
    });
  }

  /**
   * How the session changed since `sent`: `undefined` when it did not, `true` when the same user holds
   * another token now (the request can be sent again with it), `false` when the user who sent is gone. When
   * nobody can tell who sent, another token is a switch: it is never read as the same user's.
   */
  protected readSessionChange(opts: { sent: ISentSession }): boolean | undefined {
    const { sent } = opts;
    const now = this.readSession();

    if (now.userId === sent.userId && now.token === sent.token) {
      return undefined;
    }

    return sent.userId !== undefined && now.userId === sent.userId && !!now.token;
  }

  /**
   * Whether the 401 of a request that `sent` is a session change for the caller: the user who sent is gone and
   * either the request was sent again since (`isRetried`) or another session is signed in now. A refresh that
   * failed and ended the session itself leaves nobody to protect, and its 401 stands.
   */
  protected isSessionTaken(opts: { sent: ISentSession; isRetried: boolean }): boolean {
    // With no user to compare, the token that follows a refresh this service ran is that refresh's.
    if (opts.sent.userId === undefined && opts.isRetried) {
      return false;
    }

    // A user switch in progress (a token stored for another user than the identity) is someone signing in: it
    // reads no token, but it is not a sign-out.
    return (
      this.readSessionChange({ sent: opts.sent }) === false &&
      (opts.isRetried ||
        this.readSession().token !== undefined ||
        this.authService?.isSwitching() === true)
    );
  }

  /**
   * Spread into an `HttpDataSource`'s settings, so its requests carry the session headers and the
   * timezone as read at send time (and the channel and tracing id, given the data provider's
   * options), and a 401 joins this service's shared `refresh`. A no-auth path gets no token.
   */
  getDataSourceAuth(
    opts?: Pick<IGetRequestPropsParams, 'restDataProviderOptions' | 'applicationInfo'>,
  ): IDataSourceAuth {
    return {
      authTokenResolver: (context) => {
        const { paths } = context;
        const sent = this.sentSessions.get(context);

        // The retry of a request whose user has gone must not carry the token of whoever signed in since.
        if (sent && this.readSessionChange({ sent }) === false) {
          return undefined;
        }

        const token = this.isNoAuthPath({ resource: paths[0], paths })
          ? undefined
          : this.resolveAuthToken();

        // Both hooks receive this very object, and a retry sends again under the session of that moment.
        this.sentSessions.set(context, { userId: this.readSession().userId, token: token?.value });

        return token;
      },
      headersResolver: () => {
        return Object.fromEntries(
          HttpHeaders.merge({
            layers: [this.getSessionHeaders(), opts ? this.getTracingHeaders(opts) : {}],
          }),
        );
      },
      onUnauthorized: (context, info) => {
        if (!this.recovery.canRecover({ paths: context.paths })) {
          return Promise.resolve(false);
        }

        const sent = this.sentSessions.get(context);
        const change = sent ? this.readSessionChange({ sent }) : undefined;

        if (change === false) {
          return Promise.reject(this.sessionChangedError());
        }

        // The retry's own 401 stands, as it does for `doRequest`: one refresh, one retry.
        if (info.attempt >= 2) {
          return Promise.resolve(false);
        }

        if (change === true) {
          return Promise.resolve(true);
        }

        return this.refresh().then((isRefreshed) => {
          // The retry sends again under the session of this refresh.
          if (sent && sent.userId === undefined && isRefreshed) {
            this.sentSessions.set(context, this.readSession());
          }

          return sent && this.isSessionTaken({ sent, isRetried: isRefreshed })
            ? Promise.reject(this.sessionChangedError())
            : isRefreshed;
        });
      },
      errorRootKey: NetworkResponseReader.ERROR_ROOT_KEY,
    };
  }

  /**
   * The `token` (`<type> <value>`, `Bearer` when the type is empty) and `provider` of the stored
   * token. Throws an error with status 401 when there is no token.
   */
  getRequestAuthorizationHeader() {
    const authToken = this.resolveAuthToken();

    if (!authToken?.value) {
      throw getError({
        message: '[dataProvider][getAuthHeader] Invalid auth token to fetch!',
        statusCode: 401,
      });
    }

    return {
      provider: authToken?.provider,
      token: `${authToken?.type?.length ? authToken.type : App.TOKEN_TYPE} ${authToken.value}`,
    };
  }

  /** Adds headers to every request this service sends; a name already set is replaced, in any case. */
  setHeaders(opts: { headers: HeadersInit }) {
    this.headers = HttpHeaders.merge({ layers: [this.headers, opts.headers] });
  }

  /** Removes the headers set by name, in any case. */
  removeHeaders(opts: { keys: string[] }) {
    if (!opts.keys?.length) {
      return;
    }

    for (const key of opts.keys) {
      this.headers.delete(key);
    }
  }

  /** The timezone, then whatever `setHeaders` holds now. Both transports send these. */
  protected getSessionHeaders(): Record<string, string> {
    return Object.fromEntries(
      HttpHeaders.merge({
        layers: [
          {
            [HTTP.Headers.TIMEZONE]: App.TIMEZONE,
            [HTTP.Headers.TIMEZONE_OFFSET]: `${App.TIMEZONE_OFFSET}`,
          },
          this.headers,
        ],
      }),
    );
  }

  /** The request channel (`RequestChannel.WEB` unless configured) and a fresh tracing id. */
  protected getTracingHeaders(
    opts: Pick<IGetRequestPropsParams, 'restDataProviderOptions' | 'applicationInfo'>,
  ): Record<string, string> {
    const { restDataProviderOptions, applicationInfo } = opts;
    const channel = restDataProviderOptions.requestTracingChannel?.length
      ? restDataProviderOptions.requestTracingChannel
      : RequestChannel.WEB;

    return {
      [HTTP.Headers.REQUEST_CHANNEL]: channel,
      [HTTP.Headers.REQUEST_TRACING_ID]: this.buildRequestTracingId({ applicationInfo }),
    };
  }

  /**
   * The session headers, plus `authorization` and `x-auth-provider` unless `resource` is a no-auth
   * path. Throws a 401 error for any other resource when there is no token.
   */
  getRequestHeader(opts: { resource: string }): Record<string, string> {
    const { resource } = opts;

    const defaultHeaders = this.getSessionHeaders();

    if (this.isNoAuthPath({ resource })) {
      return defaultHeaders;
    }

    const authHeader = this.getRequestAuthorizationHeader();

    return {
      ...defaultHeaders,
      // A token need not name a provider; never send the string `undefined`.
      ...(authHeader.provider ? { [HTTP.Headers.AUTH_PROVIDER]: authHeader.provider } : {}),
      [HTTP.Headers.AUTHORIZATION]: authHeader.token,
    };
  }

  /** The body as it is sent and the content type to send it under. Override to encode another way. */
  protected encodeBody(opts: { bodyType?: string; body: unknown }): IEncodedBody {
    return RequestBodyEncoder.encode(opts);
  }

  /**
   * The headers (session, auth, tracing, `x-request-count`, the `extra` header, and the content type
   * of the encoded body) and the encoded body of a request. Throws as `getRequestHeader` does.
   */
  getRequestProps(params: IGetRequestPropsParams) {
    const {
      bodyType,
      body,
      resource,
      restDataProviderOptions,
      applicationInfo,
      requestCountData = RequestCountData.DATA_ONLY,
      extra,
    } = params;
    const extraHeader = HttpExtraRequest.toHeader({ extra });

    // Merged, not spread, so a per-request value replaces a static header in any case.
    const headers = Object.fromEntries(
      HttpHeaders.merge({
        layers: [
          this.getRequestHeader({ resource }),
          this.getTracingHeaders({ restDataProviderOptions, applicationInfo }),
          { [HTTP.Headers.REQUEST_COUNT_DATA]: requestCountData },
          extraHeader ? { [HttpExtraRequest.HEADER]: extraHeader } : undefined,
        ],
      }),
    );

    const encoded = this.encodeBody({ bodyType, body });

    const props: IGetRequestPropsResult = {
      headers: encoded.contentType
        ? { ...headers, [HTTP.Headers.CONTENT_TYPE]: encoded.contentType }
        : headers,
      body: encoded.body,
    };

    return props;
  }
}
