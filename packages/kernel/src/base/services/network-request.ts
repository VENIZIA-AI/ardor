import { getError } from '@venizia/ignis-inversion';
import { uuidV4 } from '@venizia/ignis-helpers/uuid';
import { HttpExtraRequest } from '@venizia/ignis-kernel/repository';

import {
  type AnyType,
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
  RequestChannel,
  RequestCountData,
  RequestMethods,
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
  NodeFetchNetworkRequest,
  RequestBodyEncoder,
  ResponseReader,
} from '@/helpers';
import { BaseService } from './base';

/**
 * The options hold data (the base URL, headers, the no-auth lists, the refresh path); behaviour is
 * in the protected hooks, each taking one `opts` object, which a subclass overrides.
 */
export class DefaultNetworkRequestService extends BaseService {
  protected noAuthPaths?: string[];
  protected noAuthPathRegexes: RegExp[];
  protected headers: Record<string, string>;
  protected networkRequest: NodeFetchNetworkRequest;
  protected baseUrl: string;
  protected authRecovery?: IAuthRecoveryOptions;

  private readonly recovery: AuthRecovery;

  constructor(
    opts: INoAuthOptions & {
      name: string;
      baseUrl?: string;
      headers?: HeadersInit;
      authRecovery?: IAuthRecoveryOptions;
    },
  ) {
    super({ scope: DefaultNetworkRequestService.name });
    const { name, baseUrl = '', headers = {}, noAuthPaths, noAuthPathRegex, authRecovery } = opts;

    this.headers = NetworkHeaders.toRecord({ headers });
    this.noAuthPaths = noAuthPaths;
    this.noAuthPathRegexes = this.compileNoAuthPathRegex({ input: noAuthPathRegex });
    this.baseUrl = baseUrl;
    this.authRecovery = authRecovery;
    this.recovery = new AuthRecovery({
      logger: this.logger,
      getRefreshTokenPath: () => this.authRecovery?.refreshTokenPath,
      refresh: () => this.refreshToken(),
      onFailure: () => this.onAuthFailure(),
      isNoAuthPath: paths => this.isNoAuthPath({ resource: paths?.[0], paths }),
    });
    this.networkRequest = new NodeFetchNetworkRequest({
      name,
      networkOptions: { baseUrl, headers },
    });
  }

  /**
   * The stored token (`AuthTokenStore.read`), `undefined` outside a browser. The default of
   * `resolveAuthToken`, and what to hand an `HttpDataSource` as its `authTokenResolver`.
   */
  static readAuthTokenFromStorage(): IAuthTokenRecord | undefined {
    return AuthTokenStore.read();
  }

  // --- Hooks -----------------------------------------------------------------------------------

  /**
   * The token this service sends. The one way to supply a token: override it to read another
   * store, or to hold the token in memory.
   */
  protected resolveAuthToken(): IAuthTokenRecord | undefined {
    return DefaultNetworkRequestService.readAuthTokenFromStorage();
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

    return this.noAuthPathRegexes.some(regex => {
      return candidates.some(candidate => {
        regex.lastIndex = 0;
        return regex.test(candidate);
      });
    });
  }

  /**
   * Refreshes the session after a 401. `true`: refreshed, the request is retried; `false`: this
   * service has no refresh (the default); a throw: the refresh failed and `onAuthFailure` runs.
   */
  protected refreshToken(): Promise<boolean> {
    return Promise.resolve(false);
  }

  /** Runs once when `refreshToken` threw. The place to send the user back to sign-in. */
  protected onAuthFailure(): Promise<void> {
    return Promise.resolve();
  }

  /** The tracing id of a request, sent in `x-request-tracing-id`. Default `<application name>_<uuid>`. */
  protected buildRequestTracingId(opts: { applicationInfo: IApplicationInfo }): string {
    return `${opts.applicationInfo.name}_${uuidV4()}`;
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

  /** The body as it is sent and the content type to send it under. Override to encode another way. */
  protected encodeBody(opts: { bodyType?: string; body: unknown }): IEncodedBody {
    return RequestBodyEncoder.encode(opts);
  }

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
    const headers: Record<string, AnyType> = NetworkHeaders.merge({
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
  convertResponse<TData = AnyType>(opts: Parameters<typeof ResponseReader.convert<TData>>[0]) {
    return ResponseReader.convert<TData>(opts);
  }

  async doRequest<TResult = AnyType>(
    opts: IGetRequestPropsResult & {
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

    const sendOnce = (sendHeaders?: HeadersInit) => {
      return this.networkRequest.getNetworkService().send({
        url,
        method,
        params: query,
        body: method === RequestMethods.GET ? undefined : body,
        headers: sendHeaders,
        configs: {},
      });
    };

    let fetched = await sendOnce(headers);

    if (fetched.status === 401 && this.recovery.canRecover({ paths })) {
      const isRefreshed = await this.refresh();

      if (isRefreshed) {
        const authHeader = this.getRequestAuthorizationHeader();
        const retryHeaders = {
          ...(headers as Record<string, AnyType>),
          [HeaderConstants.AUTHORIZATION]: authHeader.token,
          ...(authHeader.provider
            ? { [HeaderConstants.X_AUTH_PROVIDER]: authHeader.provider }
            : {}),
        };

        fetched = await sendOnce(retryHeaders);
      }
    }

    const status = fetched.status;

    if (status < 200 || status >= 300) {
      throw await ResponseReader.toError({ response: fetched });
    }

    return ResponseReader.read<TResult>({ response: fetched, type, requestCountData });
  }
}
