import { getError } from '@venizia/ignis-inversion';
import { NodeFetchNetworkRequest } from '@venizia/ignis-helpers/core';
import { UuidV4Generator } from '@venizia/ignis-helpers/uuid';
import { HttpExtraRequest } from '@venizia/ignis-kernel/repository';

import {
  App,
  HeaderConstants,
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
  type TRequestType,
} from '@/common';
import {
  AuthRecovery,
  AuthTokenStore,
  type IEncodedBody,
  NetworkHeaders,
  RequestBodyEncoder,
  ResponseReader,
} from '@/helpers';
import type { DefaultAuthService } from './auth';
import { BaseService } from './base';

/**
 * The options hold data (the base URL, headers, the no-auth lists, the refresh path); behaviour is
 * in the protected hooks, each taking one `opts` object, which a subclass overrides.
 */
export class DefaultNetworkRequestService extends BaseService {
  /** Resources sent without a token, matched exactly. */
  protected noAuthPaths?: string[];
  /** `noAuthPathRegex` compiled; a resource matching any is sent without a token. */
  protected noAuthPathRegexes: RegExp[];
  /** Headers added to every request, keyed by lowercase name. */
  protected headers: Record<string, string>;
  protected networkRequest: NodeFetchNetworkRequest;
  /** The origin and base path requests are sent to; an empty one makes `doRequest` throw. */
  protected baseUrl: string;
  protected authRecovery?: IAuthRecoveryOptions;
  protected authService?: DefaultAuthService;

  private readonly recovery: AuthRecovery;

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
    } = opts;

    this.headers = NetworkHeaders.toRecord({ headers });
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
    this.networkRequest = new NodeFetchNetworkRequest({
      name,
      // A filter travels as one JSON parameter, and a null is left out: what an IGNIS server reads.
      networkOptions: { baseUrl, headers, queryString: { nullish: 'skip', nested: 'json' } },
    });
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

    return { value, type: typeof type === 'string' ? type : 'Bearer' };
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
    return this.recovery.refresh();
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
      authTokenResolver: ({ paths }) => {
        return this.isNoAuthPath({ resource: paths[0], paths })
          ? undefined
          : this.resolveAuthToken();
      },
      headersResolver: () => {
        return NetworkHeaders.merge({
          sources: [this.getSessionHeaders(), opts ? this.getTracingHeaders(opts) : {}],
        });
      },
      onUnauthorized: ({ paths }) => {
        return this.recovery.canRecover({ paths }) ? this.refresh() : Promise.resolve(false);
      },
      errorRootKey: ResponseReader.ERROR_ROOT_KEY,
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
      token: `${authToken?.type?.length ? authToken.type : 'Bearer'} ${authToken.value}`,
    };
  }

  /** Adds headers to every request this service sends; a name already set is replaced, in any case. */
  setHeaders(opts: { headers: HeadersInit }) {
    this.headers = NetworkHeaders.merge({ sources: [this.headers, opts.headers] });
  }

  /** Removes the headers set by name, in any case. */
  removeHeaders(opts: { keys: string[] }) {
    if (!opts.keys?.length) {
      return;
    }

    // The record is keyed by lowercase name.
    for (const key of opts.keys) {
      delete this.headers[key.toLowerCase()];
    }
  }

  /** The timezone, then whatever `setHeaders` holds now. Both transports send these. */
  protected getSessionHeaders(): Record<string, string> {
    return NetworkHeaders.merge({
      sources: [
        {
          [HeaderConstants.TIMEZONE]: App.TIMEZONE,
          [HeaderConstants.TIMEZONE_OFFSET]: `${App.TIMEZONE_OFFSET}`,
        },
        this.headers,
      ],
    });
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
      [HeaderConstants.REQUEST_CHANNEL]: channel,
      [HeaderConstants.REQUEST_TRACING_ID]: this.buildRequestTracingId({ applicationInfo }),
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
      ...(authHeader.provider ? { [HeaderConstants.X_AUTH_PROVIDER]: authHeader.provider } : {}),
      [HeaderConstants.AUTHORIZATION]: authHeader.token,
    };
  }

  /**
   * Whether the request stays where `baseUrl` points: no entry of `paths` carries a tab, a line break,
   * a backslash or a dot segment (also written `%2E`), and the URL built from
   * them, resolved the way a browser does, has the origin of the base and a path under it.
   */
  private static isUnderBase(opts: { baseUrl: string; paths: string[]; url: string }): boolean {
    const { baseUrl, paths, url } = opts;

    // The joined path, so a dot segment is found whichever entry holds it.
    if (/[\\\t\n\r]|(^|\/)(\.|%2e){1,2}(\/|$)/i.test(paths.join('/'))) {
      return false;
    }

    try {
      const origin = 'http://base.invalid';
      const base = new URL(baseUrl, origin);
      const target = new URL(url, origin);
      const prefix = base.pathname.replace(/\/+$/, '');

      return (
        target.origin === base.origin &&
        (target.pathname === prefix || target.pathname.startsWith(`${prefix}/`))
      );
      // eslint-disable-next-line venizia/no-silent-catch -- a URL that does not parse is the answer: the request is refused
    } catch {
      return false;
    }
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
    const headers = NetworkHeaders.merge({
      sources: [
        this.getRequestHeader({ resource }),
        this.getTracingHeaders({ restDataProviderOptions, applicationInfo }),
        { [HeaderConstants.REQUEST_COUNT_DATA]: requestCountData },
        extraHeader ? { [HttpExtraRequest.HEADER]: extraHeader } : undefined,
      ],
    });

    const encoded = this.encodeBody({ bodyType, body });

    const props: IGetRequestPropsResult = {
      headers: encoded.contentType
        ? { ...headers, [HeaderConstants.CONTENT_TYPE]: encoded.contentType }
        : headers,
      body: encoded.body,
    };

    return props;
  }

  /** Reads a response by the request type. See `ResponseReader.convert`. */
  convertResponse<TData = unknown>(opts: Parameters<typeof ResponseReader.convert<TData>>[0]) {
    return ResponseReader.convert<TData>(opts);
  }

  /**
   * Sends the request and reads the response by `type`. Throws when `baseUrl` (the option, else the
   * service's) is empty. A 401 on a path that can recover triggers `refresh` and, if it refreshed,
   * one retry with the new token. Any other non-2xx response, or a retry that still fails, throws
   * the error read from the response.
   */
  async doRequest<TResult = unknown>(
    opts: IGetRequestPropsResult & {
      /** @default this.baseUrl */
      baseUrl?: string;
      query?: any;
      type: TRequestType;
      method: TRequestMethod;
      paths: string[];
      requestCountData?: TConstValue<typeof RequestCountData>;
    },
  ): Promise<INetworkResponse<TResult>> {
    const {
      baseUrl = this.baseUrl,
      type,
      method,
      paths,
      body,
      headers,
      query,
      requestCountData,
    } = opts;

    if (!baseUrl) {
      throw getError({
        message: '[doRequest] Invalid baseUrl to send request!',
      });
    }

    const url = this.networkRequest.getRequestUrl({ baseUrl, paths });

    if (!DefaultNetworkRequestService.isUnderBase({ baseUrl, paths, url })) {
      throw getError({ message: '[doRequest] Invalid path to send request!' });
    }

    const sendOnce = (sendHeaders?: HeadersInit) => {
      return this.networkRequest.getNetworkService().send(
        {
          url,
          method,
          params: query,
          body: method === RequestMethods.GET ? undefined : body,
          headers: sendHeaders,
        },
        this.logger,
      );
    };

    // Who sends: a 401 that arrives after another user signed in is not this user's to refresh.
    const sentBy = `${this.authService?.getUser().userId}`;
    let fetched = await sendOnce(headers);

    if (
      fetched.status === 401 &&
      `${this.authService?.getUser().userId}` === sentBy &&
      this.recovery.canRecover({ paths })
    ) {
      const isRefreshed = await this.refresh();

      if (isRefreshed) {
        const authHeader = this.getRequestAuthorizationHeader();
        const retryHeaders = NetworkHeaders.merge({
          sources: [
            headers,
            { [HeaderConstants.AUTHORIZATION]: authHeader.token },
            authHeader.provider
              ? { [HeaderConstants.X_AUTH_PROVIDER]: authHeader.provider }
              : undefined,
          ],
        });

        const result = await sendOnce(retryHeaders);
        fetched = result;
      }
    }

    const status = fetched.status;

    if (status < 200 || status >= 300) {
      const result2 = await ResponseReader.toError({ response: fetched });
      throw result2;
    }

    return ResponseReader.read<TResult>({ response: fetched, type, requestCountData });
  }
}
