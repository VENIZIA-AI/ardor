import { getError } from '@venizia/ignis-inversion';
import { HTTP } from '@venizia/ignis-helpers/common';
import { HttpHeaders } from '@venizia/ignis-helpers/core';
import { UuidV4Generator } from '@venizia/ignis-helpers/uuid';
import { HttpExtraRequest } from '@venizia/ignis-kernel/repository';

import {
  App,
  type IApplicationInfo,
  type IAuthTokenRecord,
  type IGetRequestPropsParams,
  type IGetRequestPropsResult,
  type ISignInSession,
  LocalStorageKeys,
  RequestChannel,
  RequestCountData,
  type TNoAuthPathRegex,
  type TRequestTimeoutOptions,
} from '@/common';
import {
  AuthTokenStore,
  type IEncodedBody,
  NetworkResponseReader,
  RequestBodyEncoder,
} from '@/utilities';
import type { DefaultAuthService } from './auth';
import { BaseService } from './base';

/**
 * What `DefaultNetworkRequestService` is built on: which requests go without a token, the token, the
 * headers and body of a request, and the hooks that read data. It holds nothing about a request in
 * flight.
 */
export abstract class AbstractNetworkRequestService extends BaseService {
  /** Resources sent without a token, matched exactly: `noAuth.paths`. */
  protected noAuthPaths?: string[];
  /** `noAuth.regex` compiled; a resource matching any is sent without a token. */
  protected noAuthPathRegexes: RegExp[];
  /** Headers added to every request. */
  protected headers: Headers;
  protected authService?: DefaultAuthService;

  /**
   * The token under the unscoped session key (`AuthTokenStore.read`), `undefined` outside a browser, for an
   * application with no `id`. With an application `id` the session is under other keys: use
   * `createAuthTokenReader({ id })`, the `HttpDataSource` `getDataSourceAuth()` of the data provider, or `authService.getAuth`.
   */
  static readAuthTokenFromStorage(): IAuthTokenRecord | undefined {
    return AuthTokenStore.read();
  }

  /**
   * A reader of the stored token of the application with this `id` (`IApplicationInfo.id`): the same
   * key `DefaultAuthService.getAuth` reads (`LocalStorageKeys.scoped({ id }).token`). Without an `id` it
   * is `readAuthTokenFromStorage`. Throws for an invalid `id`, when it is created.
   *
   * @example
   * ```ts
   * super({ baseUrl: '/api', authTokenResolver: DefaultNetworkRequestService.createAuthTokenReader({ id: 'shop' }) });
   * ```
   */
  static createAuthTokenReader(opts: { id?: string } = {}): () => IAuthTokenRecord | undefined {
    const { token: key } = LocalStorageKeys.scoped({ id: opts.id });

    return () => AuthTokenStore.read({ key });
  }

  /**
   * Throws for options that carry `noAuthPaths` or `noAuthPathRegex`, which `noAuth` replaced, and for
   * a `noAuth` that is not `{ paths, regex }`: an ignored one would send the token to a path that is
   * meant to go without it.
   */
  static assertNoAuthOptions(opts: {
    options: object;
    /** The class that was given the options, named in the message. */
    owner: string;
  }): void {
    const removed = ['noAuthPaths', 'noAuthPathRegex'].filter((key) => key in opts.options);

    if (removed.length) {
      const verb = removed.length > 1 ? 'were' : 'was';

      throw getError({
        message: `[${opts.owner}] ${removed.join(' and ')} ${verb} replaced by noAuth: { paths, regex }; run "bun run ardor codemod no-auth"`,
      });
    }

    const noAuth = 'noAuth' in opts.options ? opts.options.noAuth : undefined;

    const invalid = AbstractNetworkRequestService.findInvalidNoAuth({ noAuth });

    if (invalid) {
      throw getError({
        message: `[${opts.owner}] noAuth takes { paths, regex }: invalid ${invalid}`,
      });
    }
  }

  /** What is wrong with a `noAuth` value: its `shape`, `paths` or `regex`; `undefined` when nothing is. */
  private static findInvalidNoAuth(opts: { noAuth: unknown }): string | undefined {
    const { noAuth } = opts;

    if (noAuth === undefined) {
      return undefined;
    }

    const isGroup =
      typeof noAuth === 'object' &&
      noAuth !== null &&
      !Array.isArray(noAuth) &&
      !(noAuth instanceof RegExp) &&
      Object.keys(noAuth).every((key) => key === 'paths' || key === 'regex');

    if (!isGroup) {
      return 'shape';
    }

    const paths = 'paths' in noAuth ? noAuth.paths : undefined;
    const regex = 'regex' in noAuth ? noAuth.regex : undefined;
    const isPattern = (value: unknown) => typeof value === 'string' || value instanceof RegExp;

    // A text in place of the list would match by substring, and leave more requests without a token.
    if (
      paths !== undefined &&
      !(Array.isArray(paths) && paths.every((p) => typeof p === 'string'))
    ) {
      return 'paths';
    }

    const isRegex = Array.isArray(regex) ? regex.every(isPattern) : isPattern(regex);

    return regex === undefined || isRegex ? undefined : 'regex';
  }

  /** Throws unless a timeout that is on has a positive integer `milliseconds`. */
  static assertTimeout(opts: { timeout?: TRequestTimeoutOptions }): void {
    const { timeout } = opts;

    if (!timeout?.use) {
      return;
    }

    const { milliseconds } = timeout;

    if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
      throw getError({
        message: `[DefaultNetworkRequestService] timeout.milliseconds must be a positive integer, got ${milliseconds}`,
      });
    }
  }

  /**
   * The token this service sends. The one way to supply a token: override it to read another
   * store, or to hold the token in memory.
   */
  protected resolveAuthToken(): IAuthTokenRecord | undefined {
    // The auth service knows where this application's session is kept (its `id` scopes the keys).
    return this.authService
      ? (this.authService.getAuth() ?? undefined)
      : AbstractNetworkRequestService.readAuthTokenFromStorage();
  }

  /**
   * Whether a request goes without a token: its `resource` is in `noAuth.paths`, or the resource, or
   * the joined `paths`, matches `noAuth.regex`. To send no token at all (an API with no sign-in),
   * set `noAuth: { regex: /./ }`.
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

  /**
   * The new token of a refresh response: `{ token: { value, type } }` or `{ token: '<jwt>' }`. A
   * refresh keeps the same user, so nothing else is read. Override it for another shape. No token is
   * a throw.
   */
  protected readRefreshedToken(opts: { data: unknown }): ISignInSession['token'] {
    const body: { token?: unknown } =
      typeof opts.data === 'object' && opts.data !== null ? opts.data : {};
    const { token } = body;
    let record: object = {};

    if (typeof token === 'string') {
      record = { value: token };
    } else if (typeof token === 'object' && token !== null) {
      record = token;
    }

    const value = 'value' in record ? record.value : undefined;
    const type = 'type' in record ? record.type : undefined;

    if (typeof value !== 'string' || !value) {
      throw getError({ message: '[refreshToken] The refresh response carries no token' });
    }

    return { value, type: typeof type === 'string' ? type : App.TOKEN_TYPE };
  }

  /** Runs once when `refreshToken` threw. The place to send the user back to sign-in. */
  protected onAuthFailure(): Promise<void> {
    return Promise.resolve();
  }

  /** The tracing id of a request, sent in `x-request-id`. Default `<application name>_<uuid>`. */
  protected buildRequestTracingId(opts: { applicationInfo: IApplicationInfo }): string {
    return `${opts.applicationInfo.name}_${UuidV4Generator.generate()}`;
  }

  /** `noAuth.regex` as `RegExp`s; a string is compiled, and an invalid one is logged and dropped. */
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
          '[compileNoAuthPathRegex] Invalid noAuth.regex pattern: %s | error: %o',
          pattern,
          error,
        );
      }
    }

    return compiled;
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

  /** Reads a response by the request type. See `NetworkResponseReader.convert`. */
  convertResponse(opts: Parameters<typeof NetworkResponseReader.convert>[0]) {
    return NetworkResponseReader.convert(opts);
  }
}
