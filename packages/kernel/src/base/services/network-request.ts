import { getError } from '@venizia/ignis-inversion';
import { HTTP } from '@venizia/ignis-helpers/common';
import {
  HttpHeaders,
  HttpResponseReader,
  NativeFetcher,
  NativeFetchNetworkRequest,
} from '@venizia/ignis-helpers/core';
import { UuidV4Generator } from '@venizia/ignis-helpers/uuid';
import { HttpExtraRequest } from '@venizia/ignis-kernel/repository';

import {
  App,
  type IApplicationInfo,
  type IAuthTokenRecord,
  type IAuthRecoveryOptions,
  type IDataSourceAuth,
  type IGetRequestPropsParams,
  type IGetRequestPropsResult,
  type INetworkResponse,
  type INoAuthOptions,
  LocalStorageKeys,
  RequestChannel,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type TConstValue,
  type TNoAuthPathRegex,
  type TRequestMethod,
  type TRequestTimeoutOptions,
  type TRequestType,
} from '@/common';
import {
  AuthRecovery,
  AuthTokenStore,
  type IEncodedBody,
  RequestBodyEncoder,
  NetworkResponseReader,
} from '@/helpers';
import type { DefaultAuthService } from './auth';
import { BaseService } from './base';

/** Who sent a request, and with which token: what a 401 is judged against. */
interface ISentSession {
  /** `undefined` when the service cannot tell who is signed in (no auth service, or no user id stored). */
  userId?: string;
  token?: string;
}

/** The `normalized.code` of the 401 that answers a request whose session is gone: the user who sent it signed out or another user signed in while it was in flight. */
export const SESSION_CHANGED_CODE = 'ardor.network.session_changed';

/** The `normalized.code` of the 504 a request rejects with when it outlives the configured `timeout`. */
export const NETWORK_TIMEOUT_CODE = 'ardor.network.timeout';

/**
 * Sends the requests of the data provider with its own sender. The repositories of
 * `@venizia/ardor/repository` send through IGNIS's `HttpDataSource`, from the optional peer
 * `@venizia/ignis-connectors`, which this service cannot import without making that peer required:
 * until IGNIS's transport core is in a required peer, two clients exist, and `getDataSourceAuth`
 * gives the second the session of the first.
 *
 * The options hold data (the base URL, headers, the no-auth lists, the refresh path); behaviour is
 * in the protected hooks, each taking one `opts` object, which a subclass overrides.
 */
export class DefaultNetworkRequestService extends BaseService {
  /** Resources sent without a token, matched exactly. */
  protected noAuthPaths?: string[];
  /** `noAuthPathRegex` compiled; a resource matching any is sent without a token. */
  protected noAuthPathRegexes: RegExp[];
  /** Headers added to every request. */
  protected headers: Headers;
  protected networkRequest: NativeFetchNetworkRequest;
  /** The origin and base path requests are sent to; an empty one makes `doRequest` throw. */
  protected baseUrl: string;
  protected authRecovery?: IAuthRecoveryOptions;
  protected authService?: DefaultAuthService;
  /** How long a request may take; see `IRestDataProviderOptions.timeout`. */
  protected timeout: TRequestTimeoutOptions;

  private readonly recovery: AuthRecovery;

  /** The session each data source request was sent under, keyed by the context object IGNIS hands to both hooks. */
  private readonly sentSessions = new WeakMap<object, ISentSession>();

  constructor(
    opts: INoAuthOptions & {
      /** The name of the underlying network request helper. */
      name: string;
      /**
       * An empty one makes `doRequest` refuse, unless it is given its own `baseUrl`.
       * @default ''
       */
      baseUrl?: string;
      /**
       * Sent with every request; a name set later with `setHeaders` replaces it.
       * @default {}
       */
      headers?: HeadersInit;
      /** Enables the refresh-and-retry after a 401. */
      authRecovery?: IAuthRecoveryOptions;
      /** What the default `refreshToken` saves the new token through. */
      authService?: DefaultAuthService;
      /**
       * Aborts each request that has not answered in time. Throws here for an invalid `milliseconds`.
       * @default { use: false }
       */
      timeout?: TRequestTimeoutOptions;
    },
  ) {
    super({ scope: DefaultNetworkRequestService.name });
    const {
      name,
      baseUrl = '',
      headers = {},
      noAuthPaths,
      noAuthPathRegex,
      authRecovery,
      authService,
      timeout = { use: false },
    } = opts;

    DefaultNetworkRequestService.assertTimeout({ timeout });
    this.timeout = timeout;
    this.headers = new Headers(headers);
    this.noAuthPaths = noAuthPaths;
    this.noAuthPathRegexes = this.compileNoAuthPathRegex({ input: noAuthPathRegex });
    this.baseUrl = baseUrl;
    this.authRecovery = authRecovery;
    this.authService = authService;
    this.recovery = new AuthRecovery({
      logger: this.logger,
      getRefreshTokenPath: () => this.authRecovery?.refreshTokenPath,
      refresh: () => this.refreshToken(),
      onFailure: () => this.onAuthFailure(),
      isNoAuthPath: (paths) => this.isNoAuthPath({ resource: paths?.[0], paths }),
    });
    this.networkRequest = new NativeFetchNetworkRequest({
      name,
      // A filter travels as one JSON parameter, and a null is left out: what an IGNIS server reads.
      networkOptions: { baseUrl, queryString: { nullish: 'skip', nested: 'json' } },
    });
  }

  /**
   * The headers of one call: its own alone, or the ones `setHeaders` holds now. The transport keeps no
   * default of ours, so a removed header is gone. A call with headers but no `content-type` sends none (`null`),
   * and so does a raw body (`FormData`, `Blob`, `URLSearchParams`, bytes, a stream) with none, so `fetch` writes it.
   */
  private toSendHeaders(opts: {
    headers?: HeadersInit;
    /** What the retry of a 401 adds or replaces: the fresh token. It does not change which `content-type` rule applies. */
    extra?: Record<string, string | null>;
    body?: unknown;
  }): Record<string, string | null> | undefined {
    const sent: Record<string, string | null> = {
      ...Object.fromEntries(new Headers(opts.headers ?? this.headers)),
      ...opts.extra,
    };

    if (opts.headers && !(HTTP.Headers.CONTENT_TYPE in sent)) {
      sent[HTTP.Headers.CONTENT_TYPE] = null;
    }

    if (
      typeof opts.body !== 'string' &&
      NativeFetcher.isRawBody(opts.body) &&
      !sent[HTTP.Headers.CONTENT_TYPE]
    ) {
      sent[HTTP.Headers.CONTENT_TYPE] = null;
    }

    return sent;
  }

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

  // --- Hooks -----------------------------------------------------------------------------------

  /**
   * The token this service sends. The one way to supply a token: override it to read another
   * store, or to hold the token in memory.
   */
  protected resolveAuthToken(): IAuthTokenRecord | undefined {
    // The auth service knows where this application's session is kept (its `id` scopes the keys).
    return this.authService
      ? (this.authService.getAuth() ?? undefined)
      : DefaultNetworkRequestService.readAuthTokenFromStorage();
  }

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

  /**
   * Refreshes the session after a 401. `true`: refreshed, the request is retried; `false`: this
   * service has no refresh, or the session changed while the request was in flight (another user
   * signed in, the user signed out, or another tab refreshed): the new token is not saved, and the
   * failure of a refresh made for a session that is gone is not reported; a throw: the refresh
   * failed and `onAuthFailure` runs. The default posts to `authRecovery.refreshTokenPath` with no
   * body and saves the new token through `authService`, keeping the stored identity and roles;
   * with no path or no `authService` it answers `false`.
   */
  protected async refreshToken(): Promise<boolean> {
    const path = this.authRecovery?.refreshTokenPath;
    const { authService } = this;

    if (!path || !authService) {
      return false;
    }

    // The session this refresh is for: the answer belongs to it and to no other.
    const readSession = () => ({
      userId: `${authService.getUser().userId}`,
      token: authService.getAuth()?.value,
    });
    const startedFor = readSession();

    // `false`: another user, or none, is signed in now. `true`: the same user holds another token
    // now (another tab refreshed, or a new sign-in), which the retry uses. `undefined`: unchanged.
    const readChange = (): boolean | undefined => {
      const now = readSession();

      if (now.userId !== startedFor.userId) {
        return false;
      }

      return now.token === startedFor.token ? undefined : true;
    };

    let response: INetworkResponse<unknown>;

    try {
      const result = await this.doRequest({
        paths: [path],
        method: RequestMethods.POST,
        type: RequestTypes.SEND,
        headers: this.getRequestHeader({ resource: path }),
      });
      response = result;
    } catch (error) {
      const change = readChange();

      if (change === undefined) {
        throw error;
      }

      return change;
    }

    const user = authService.getUser();
    const change = readChange();

    // Signed out while the request was in flight: saving the token would start a session with no user.
    if (user.userId === undefined) {
      return false;
    }

    // The session moved on: this answer is for the one that asked, so it is not saved.
    if (change !== undefined) {
      this.logger.warn(
        '[refreshToken] The session changed while the refresh was in flight, its answer is dropped',
      );

      return change;
    }

    authService.saveAuth({
      userId: user.userId,
      username: user.username,
      referenceId: user.referenceId,
      provider: user.provider,
      token: this.readRefreshedToken({ data: response.data }),
    });

    return true;
  }

  /**
   * The new token of a refresh response: `{ token: { value, type } }` or `{ token: '<jwt>' }`. A
   * refresh keeps the same user, so nothing else is read. Override it for another shape. No token is
   * a throw.
   */
  protected readRefreshedToken(opts: { data: unknown }): { value: string; type: string } {
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

  // --- No-auth and recovery --------------------------------------------------------------------

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

  /**
   * Refreshes the session, once for every 401 in flight on either transport (see `AuthRecovery`).
   * Also what `DefaultAuthProvider.refreshToken` calls, so a refresh is made in one place.
   */
  refresh(): Promise<boolean> {
    const { userId, token } = this.readSession();

    return this.recovery.refresh({ key: `${userId}|${token}` });
  }

  /** The session signed in now: who, and with which token. */
  private readSession(): ISentSession {
    const userId = this.authService?.getUser().userId;

    return {
      userId: userId === undefined ? undefined : `${userId}`,
      token: this.resolveAuthToken()?.value,
    };
  }

  /** The 401 that answers a request whose session is gone: `DefaultAuthProvider.checkError` leaves the signed-in session alone for it. */
  private sessionChangedError(): Error {
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
  private readSessionChange(opts: { sent: ISentSession }): boolean | undefined {
    const { sent } = opts;
    const now = this.readSession();

    if (now.userId === sent.userId && now.token === sent.token) {
      return undefined;
    }

    return sent.userId !== undefined && now.userId === sent.userId && !!now.token;
  }

  /** `task` settles as it does, or the wait rejects with the reason of `signal` once it aborts; the task itself is not cancelled. */
  private static async untilAborted<TResult>(opts: {
    task: Promise<TResult>;
    signal?: AbortSignal;
  }): Promise<TResult> {
    const { task, signal } = opts;

    if (!signal) {
      return task;
    }

    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason);

      if (signal.aborted) {
        onAbort();

        return;
      }

      signal.addEventListener('abort', onAbort, { once: true });
    });

    try {
      const settled = await Promise.race([task, aborted]);

      return settled;
    } finally {
      if (onAbort) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  }

  /**
   * Whether the 401 of a request that `sent` is a session change for the caller: the user who sent is gone and
   * either the request was sent again since (`isRetried`) or another session is signed in now. A refresh that
   * failed and ended the session itself leaves nobody to protect, and its 401 stands.
   */
  private isSessionTaken(opts: { sent: ISentSession; isRetried: boolean }): boolean {
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

  // --- Requests --------------------------------------------------------------------------------

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
    this.headers = HttpHeaders.merge({ layers: [this.headers, new Headers(opts.headers)] });
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
  convertResponse<TData = unknown>(
    opts: Parameters<typeof NetworkResponseReader.convert<TData>>[0],
  ) {
    return NetworkResponseReader.convert<TData>(opts);
  }

  /**
   * Sends the request and reads the response by `type`. Throws when `baseUrl` (the option, else the
   * service's) is empty. A 401 on a path that can recover triggers `refresh` and, if it refreshed,
   * one retry with the new token. Any other non-2xx response, or a retry that still fails, throws
   * the error read from the response. An aborted `signal` rejects with its reason, and a request
   * that outlives the service's `timeout` rejects with a 504 coded `NETWORK_TIMEOUT_CODE`.
   */
  async doRequest<TResult = unknown>(
    opts: IGetRequestPropsResult & {
      /** @default this.baseUrl */
      baseUrl?: string;
      query?: Record<string, unknown>;
      type: TRequestType;
      method: TRequestMethod;
      paths: string[];
      requestCountData?: TConstValue<typeof RequestCountData>;
      /** Aborts this request only: a refresh its 401 started runs on for the other requests. */
      signal?: AbortSignal;
    },
  ): Promise<INetworkResponse<TResult>> {
    const { baseUrl = this.baseUrl, paths, signal } = opts;

    if (!baseUrl) {
      throw getError({
        message: '[doRequest] Invalid baseUrl to send request!',
      });
    }

    const url = this.networkRequest.getRequestUrl({ baseUrl, paths });

    const timeoutSignal = this.timeout.use
      ? AbortSignal.timeout(this.timeout.milliseconds)
      : undefined;
    const sendSignal =
      timeoutSignal && signal
        ? AbortSignal.any([signal, timeoutSignal])
        : (timeoutSignal ?? signal);

    try {
      const response = await this.sendAndRead<TResult>({ ...opts, url, signal: sendSignal });

      return response;
    } catch (error) {
      // The combined signal keeps the reason of whichever source aborted first.
      if (
        this.timeout.use &&
        timeoutSignal?.aborted &&
        sendSignal?.reason === timeoutSignal.reason
      ) {
        throw getError({
          statusCode: HTTP.ResultCodes.RS_5.GatewayTimeout,
          messageCode: NETWORK_TIMEOUT_CODE,
          message: `[doRequest] The request to ${paths.join('/')} did not answer within ${this.timeout.milliseconds} ms`,
        });
      }

      throw error;
    }
  }

  /** `doRequest` once the URL is checked: the send, the refresh and retry after a 401, then the read. */
  private async sendAndRead<TResult>(
    opts: IGetRequestPropsResult & {
      url: string;
      query?: Record<string, unknown>;
      type: TRequestType;
      method: TRequestMethod;
      paths: string[];
      requestCountData?: TConstValue<typeof RequestCountData>;
      signal?: AbortSignal;
    },
  ): Promise<INetworkResponse<TResult>> {
    const { url, type, method, paths, body, headers, query, requestCountData, signal } = opts;

    const sendOnce = (retryHeaders?: Record<string, string | null>) => {
      return this.networkRequest.getNetworkService().send(
        {
          url,
          method,
          params: query,
          body: method === RequestMethods.GET ? undefined : body,
          headers: this.toSendHeaders({
            headers,
            extra: retryHeaders,
            body: method === RequestMethods.GET ? undefined : body,
          }),
          signal,
          acceptStatus: () => true,
        },
        this.logger,
      );
    };

    const sent = this.readSession();
    let isRetried = false;
    let fetched = await sendOnce();

    if (fetched.status === 401 && this.recovery.canRecover({ paths })) {
      // A 401 that arrives after the session changed is not the new session's to refresh or to end.
      const change = this.readSessionChange({ sent });

      if (change === false) {
        throw this.sessionChangedError();
      }

      let isRefreshed = change === true;

      if (change === undefined) {
        // The wait ends with this request's abort; the refresh itself keeps running for the others.
        const refreshed = await DefaultNetworkRequestService.untilAborted({
          task: this.refresh(),
          signal,
        });
        isRefreshed = refreshed;
      }

      // The session may have moved on while the refresh was in flight, or inside a `refreshToken` override.
      if (this.isSessionTaken({ sent, isRetried: isRefreshed })) {
        throw this.sessionChangedError();
      }

      // The shared refresh is never aborted for one request: this request stops when it returns.
      signal?.throwIfAborted();

      if (isRefreshed) {
        if (method !== RequestMethods.GET && body instanceof ReadableStream) {
          throw getError({
            message:
              '[doRequest] The session was refreshed, but a ReadableStream body cannot be sent a second time | Send the request again from your code, or send a body that can be read again (FormData, Blob, a string)',
          });
        }

        const authHeader = this.getRequestAuthorizationHeader();
        // The token's provider wins, and a token with none removes the one the call carried.
        const retryHeaders = {
          [HTTP.Headers.AUTHORIZATION]: authHeader.token,
          [HTTP.Headers.AUTH_PROVIDER]: authHeader.provider ?? null,
        };

        const result = await sendOnce(retryHeaders);
        fetched = result;
        isRetried = true;
      }
    }

    const status = fetched.status;

    // The retry may have been answered 401 after the user who sent it had gone too.
    if (
      status === 401 &&
      this.recovery.canRecover({ paths }) &&
      this.isSessionTaken({ sent, isRetried })
    ) {
      throw this.sessionChangedError();
    }

    if (status < 200 || status >= 300) {
      const result2 = await HttpResponseReader.toApplicationError({
        response: fetched,
        rootKey: NetworkResponseReader.ERROR_ROOT_KEY,
      });
      throw result2;
    }

    const response = await NetworkResponseReader.read<TResult>({
      response: fetched,
      type,
      requestCountData,
    });

    return response;
  }
}
