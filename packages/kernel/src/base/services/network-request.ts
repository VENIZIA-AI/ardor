import { getError } from '@venizia/ignis-inversion';
import { HTTP } from '@venizia/ignis-helpers/common';
import {
  HttpHeaders,
  HttpResponseReader,
  NativeFetcher,
  NativeFetchNetworkRequest,
} from '@venizia/ignis-helpers/core';
import { UuidV4Generator } from '@venizia/ignis-helpers/uuid';

import {
  App,
  type IApplicationInfo,
  type IAuthTokenRecord,
  type IAuthRecoveryOptions,
  type IGetRequestPropsResult,
  type ISignInSession,
  type INetworkResponse,
  type IResponseSchema,
  type INoAuthOptions,
  LocalStorageKeys,
  type RequestCountData,
  RequestMethods,
  RequestTypes,
  type TConstValue,
  type TRequestMethod,
  type TRequestTimeoutOptions,
  type TRequestType,
} from '@/common';
import { AuthRecoveryHelper } from '@/helpers';
import { AuthTokenStore, NetworkResponseReader } from '@/utilities';
import type { DefaultAuthService } from './auth';
import { AbstractNetworkSessionService, SESSION_CHANGED_CODE } from './network-session';

export { SESSION_CHANGED_CODE };

/**
 * The `normalized.code` of the 504 a request rejects with when it outlives the configured `timeout`.
 */
export const NETWORK_TIMEOUT_CODE = 'ardor.network.timeout';

/** What `doRequest` takes besides a schema. */
type TDoRequestOptions = IGetRequestPropsResult & {
  /** @default this.baseUrl */
  baseUrl?: string;
  query?: Record<string, unknown>;
  type: TRequestType;
  method: TRequestMethod;
  paths: string[];
  requestCountData?: TConstValue<typeof RequestCountData>;
  /** Aborts this request only: a refresh its 401 started runs on for the other requests. */
  signal?: AbortSignal;
};

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
export class DefaultNetworkRequestService extends AbstractNetworkSessionService {
  protected networkRequest: NativeFetchNetworkRequest;
  /** The origin and base path requests are sent to; an empty one makes `doRequest` throw. */
  protected baseUrl: string;
  /** How long a request may take; see `IRestDataProviderOptions.timeout`. */
  protected timeout: TRequestTimeoutOptions;

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
    this.headers = HttpHeaders.merge({ layers: [headers] });
    this.noAuthPaths = noAuthPaths;
    this.noAuthPathRegexes = this.compileNoAuthPathRegex({ input: noAuthPathRegex });
    this.baseUrl = baseUrl;
    this.authRecovery = authRecovery;
    this.authService = authService;
    this.recovery = new AuthRecoveryHelper({
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
  protected override resolveAuthToken(): IAuthTokenRecord | undefined {
    // The auth service knows where this application's session is kept (its `id` scopes the keys).
    return this.authService
      ? (this.authService.getAuth() ?? undefined)
      : DefaultNetworkRequestService.readAuthTokenFromStorage();
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
  protected override buildRequestTracingId(opts: { applicationInfo: IApplicationInfo }): string {
    return `${opts.applicationInfo.name}_${UuidV4Generator.generate()}`;
  }

  // --- Recovery --------------------------------------------------------------------------------

  /**
   * Refreshes the session, once for every 401 in flight on either transport (see `AuthRecoveryHelper`).
   * Also what `DefaultAuthProvider.refreshToken` calls, so a refresh is made in one place.
   */
  override refresh(): Promise<boolean> {
    const { userId, token } = this.readSession();

    return this.recovery.refresh({ key: `${userId}|${token}` });
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

  // --- Requests --------------------------------------------------------------------------------

  /** Reads a response by the request type. See `NetworkResponseReader.convert`. */
  convertResponse(opts: Parameters<typeof NetworkResponseReader.convert>[0]) {
    return NetworkResponseReader.convert(opts);
  }

  /**
   * Sends the request and reads the response by `type`. Throws when `baseUrl` (the option, else the
   * service's) is empty. A 401 on a path that can recover triggers `refresh` and, if it refreshed,
   * one retry with the new token. Any other non-2xx response, or a retry that still fails, throws
   * the error read from the response. An aborted `signal` rejects with its reason, and a request
   * that outlives the service's `timeout` rejects with a 504 coded `NETWORK_TIMEOUT_CODE`. With a
   * `schema`, `data` is what it checked and typed; what it refuses, an empty answer included, throws a
   * `FetchSchemaError` (502).
   */
  doRequest<TResult>(
    opts: TDoRequestOptions & { schema: IResponseSchema<TResult> },
  ): Promise<INetworkResponse<TResult>>;
  /** As above with no schema: the `data` of the response is `unknown`. */
  doRequest(opts: TDoRequestOptions & { schema?: IResponseSchema }): Promise<INetworkResponse>;
  async doRequest(
    opts: TDoRequestOptions & { schema?: IResponseSchema },
  ): Promise<INetworkResponse> {
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
      const response = await this.sendAndRead({ ...opts, url, signal: sendSignal });

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
  private async sendAndRead(
    opts: TDoRequestOptions & { url: string; schema?: IResponseSchema },
  ): Promise<INetworkResponse> {
    const { url, type, method, paths, body, headers, query, requestCountData, signal, schema } =
      opts;

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

    const response = await NetworkResponseReader.read({
      response: fetched,
      type,
      requestCountData,
      schema,
    });

    return response;
  }
}
