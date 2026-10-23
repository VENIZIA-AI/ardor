import { getError } from '@venizia/ignis-inversion';
import { uuidV4 } from '@venizia/ignis-helpers/uuid';
import { HttpExtraRequest, HttpResponseReader } from '@venizia/ignis-kernel/repository';
import isEmpty from 'lodash/isEmpty.js';

import {
  type AnyType,
  App,
  HeaderConstants,
  type IApplicationInfo,
  type IAuthRecoveryOptions,
  type IGetRequestPropsParams,
  type IGetRequestPropsResult,
  type INoAuthOptions,
  LocalStorageKeys,
  RequestBodyTypes,
  RequestChannel,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type TConstValue,
  type TNoAuthPathRegex,
  type TRequestMethod,
  type TRequestType,
} from '@/common';
import { NetworkHeaders, NodeFetchNetworkRequest } from '@/helpers';
import { isDefined } from '@/utilities';
import { BaseService } from './base';

export interface IAuthTokenRecord {
  type?: string;
  value: string;
  provider?: string;
}

/** The server wraps an error body under this key; both transports unwrap it. */
const ERROR_ROOT_KEY = 'error';

/** What an `HttpDataSource` hook reads from the request it is asked about. */
export interface IDataSourceRequestContext {
  paths: Array<string>;
}

/**
 * The settings an `HttpDataSource` takes, bound to one `DefaultNetworkRequestService`, so a
 * repository sends what the data provider sends: the same headers, the same token on the same
 * paths, and one shared refresh per 401 burst. The hooks run on every send, the retry included.
 */
export interface IDataSourceAuth {
  authTokenResolver: (context: IDataSourceRequestContext) => IAuthTokenRecord | undefined;
  headersResolver: (context: IDataSourceRequestContext) => Record<string, string>;
  onUnauthorized: (context: IDataSourceRequestContext) => Promise<boolean>;
  errorRootKey: string;
}

/**
 * The options hold data: the base URL, headers, the no-auth lists and the refresh path. Behaviour
 * is in the protected hooks, each taking one `opts` object - `resolveAuthToken`, `isNoAuthPath`,
 * `refreshToken`, `onAuthFailure` and `buildRequestTracingId` - which a subclass overrides, and
 * `DefaultRestDataProvider.createNetworkService` returns.
 */
export class DefaultNetworkRequestService extends BaseService {
  protected noAuthPaths?: string[];
  protected noAuthPathRegexes: RegExp[];
  protected headers: Record<string, string>;
  protected networkRequest: NodeFetchNetworkRequest;
  protected baseUrl: string;
  protected authRecovery?: IAuthRecoveryOptions;

  private refreshing: Promise<boolean> | null = null;

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
    this.networkRequest = new NodeFetchNetworkRequest({
      name,
      networkOptions: { baseUrl, headers },
    });
  }

  /**
   * Reads the stored token, and `undefined` outside a browser. The default of `resolveAuthToken`,
   * and what to hand an `HttpDataSource` as its `authTokenResolver`, so both transports send the
   * same token.
   */
  static readAuthTokenFromStorage(): IAuthTokenRecord | undefined {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }

    const stored = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
    if (!stored?.length) {
      return undefined;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return undefined;
    }
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

    const candidates = [resource, paths?.join('/')].filter(
      (el): el is string => !!el && !isEmpty(el),
    );

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
   * Refreshes the session after a 401. Resolve `true` once it is refreshed - the request is then
   * retried with the new token; resolve `false` when this service has no refresh (the default); throw
   * when the refresh failed, and `onAuthFailure` runs. A request to `authRecovery.refreshTokenPath`
   * never gets here.
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
    const rs: RegExp[] = [];

    for (const pattern of patterns) {
      if (!pattern) {
        continue;
      }

      if (pattern instanceof RegExp) {
        rs.push(pattern);
        continue;
      }

      try {
        rs.push(new RegExp(pattern));
      } catch {
        this.logger.error('[compileNoAuthPathRegex] Invalid noAuthPathRegex pattern: %s', pattern);
      }
    }

    return rs;
  }

  /**
   * Refreshes the session, once for every 401 in flight on either transport: the callers share one
   * `refreshToken` call. `true` when the token was refreshed. Also what `DefaultAuthProvider.refreshToken`
   * calls, so a refresh is made in one place.
   */
  refresh(): Promise<boolean> {
    // A refreshToken that throws synchronously is still a failed refresh, not a stray exception.
    this.refreshing ??= Promise.resolve()
      .then(() => this.refreshToken())
      .catch(async () => {
        try {
          await this.onAuthFailure();
        } catch {
          this.logger.error('[refresh] onAuthFailure failed');
        }
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });

    return this.refreshing;
  }

  private canRecover(paths: string[]): boolean {
    if (this.isNoAuthPath({ resource: paths?.[0], paths })) {
      return false;
    }

    const refreshTokenPath = this.authRecovery?.refreshTokenPath;
    if (refreshTokenPath && paths?.join('/').includes(refreshTokenPath)) {
      return false;
    }

    return true;
  }

  // --- Requests --------------------------------------------------------------------------------

  /**
   * Spread into an `HttpDataSource`'s settings. Each of its requests then carries, as read at send
   * time, the session headers (`setHeaders`) and the timezone; with the data provider's options,
   * the request channel and tracing id too. A no-auth path gets no token and no refresh, as on the
   * data provider. Any other 401 joins this service's `refresh`: one `refreshToken` call for every
   * 401 in flight on either transport, `onAuthFailure` on a failed one, and no retry when the
   * service has no refresh. The refresh is shared, so one call's abort never cancels it.
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
        return this.canRecover(paths) ? this.refresh() : Promise.resolve(false);
      },
      errorRootKey: ERROR_ROOT_KEY,
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

  /** The request channel, `web` unless configured, and a fresh tracing id. */
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

  // `FileList` exists only in a DOM; the bare identifier throws in Workers and on Bun.
  protected isFileList(opts: { value: unknown }): boolean {
    return typeof FileList !== 'undefined' && opts.value instanceof FileList;
  }

  /** A multipart text value: JSON for objects and arrays, ISO-8601 for a `Date`, `String()` otherwise. */
  protected encodeFormValue(opts: { key: string; value: unknown; bodyType: string }): string {
    const { key, value, bodyType } = opts;

    // A urlencoded body carries text only; a file here would be sent as `"{}"` with nothing said.
    if (value instanceof Blob) {
      throw getError({
        message: `[getRequestProps] "${key}" is a file, which a ${bodyType} body cannot carry. Send it with bodyType "${RequestBodyTypes.FORM_DATA}".`,
      });
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /** Skips only `undefined` and `null`: `0`, `false` and `''` are values the caller meant to send. */
  protected appendFormDataValue(opts: { formData: FormData; key: string; value: unknown }): void {
    const { formData, key, value } = opts;

    if (!isDefined(value)) {
      return;
    }

    if (value instanceof Blob) {
      formData.append(key, value, (value as File).name);
      return;
    }

    formData.append(
      key,
      this.encodeFormValue({ key, value, bodyType: RequestBodyTypes.FORM_DATA }),
    );
  }

  /** The file name a `Content-Disposition` header names, `filename*` before `filename`. */
  protected parseFilenameFromContentDisposition(opts: { header: string }): string | undefined {
    const { header } = opts;

    if (!header) {
      return undefined;
    }

    const extMatch = header.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
    if (extMatch) {
      try {
        return decodeURIComponent(extMatch[2].trim());
      } catch {
        return extMatch[2].trim();
      }
    }

    const quotedMatch = header.match(/filename\s*=\s*"([^"]+)"/i);
    if (quotedMatch) {
      return quotedMatch[1];
    }

    const bareMatch = header.match(/filename\s*=\s*([^;]+)/i);
    if (bareMatch) {
      return bareMatch[1].trim();
    }

    return undefined;
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

    const rs: IGetRequestPropsResult = { headers, body };

    switch (bodyType) {
      case RequestBodyTypes.FORM_URL_ENCODED: {
        rs.headers = {
          ...headers,
          [HeaderConstants.CONTENT_TYPE]: 'application/x-www-form-urlencoded',
        };

        const encoded = new URLSearchParams();

        for (const key in body) {
          // Skip only what was never provided; `0`, `false` and `''` are values.
          if (!isDefined(body[key])) {
            continue;
          }

          encoded.append(
            key,
            this.encodeFormValue({
              key,
              value: body[key],
              bodyType: RequestBodyTypes.FORM_URL_ENCODED,
            }),
          );
        }

        rs.body = encoded;

        break;
      }
      case RequestBodyTypes.FORM_DATA: {
        rs.headers = headers;

        const formData = new FormData();

        for (const key in body) {
          const val = body[key];

          if (Array.isArray(val) || this.isFileList({ value: val })) {
            Array.from(val as ArrayLike<unknown>).forEach(item => {
              this.appendFormDataValue({ formData, key, value: item });
            });
            continue;
          }

          this.appendFormDataValue({ formData, key, value: val });
        }

        rs.body = formData;

        break;
      }
      default: {
        rs.headers = {
          ...headers,
          [HeaderConstants.CONTENT_TYPE]: 'application/json',
        };
        rs.body = body;
        break;
      }
    }

    return rs;
  }

  /** The total from `Content-Range`, or the page's own row count when the header is absent or malformed. */
  private resolveTotal(opts: { headers: Record<string, AnyType>; rowCount: number }): number {
    const range = HttpResponseReader.parseContentRange({
      header: opts.headers?.get(HeaderConstants.CONTENT_RANGE),
    });
    return range?.total ?? opts.rowCount;
  }

  /**
   * A failed response as an `ApplicationError`, mapped like IGNIS `HttpDataSource`: the HTTP status,
   * the server's code and args, its `extra` with the `requestId` added, and `details.cause`.
   * `message` is the server's text, not a log line, because react-admin shows it to the user.
   */
  private async toResponseError(opts: { response: Response }) {
    const { response } = opts;
    const server = await HttpResponseReader.readError({ response, rootKey: ERROR_ROOT_KEY });

    // A relaying server's `extra.requestId` names the request it made upstream; keep it, nearest first.
    const extra: Record<string, unknown> = { ...server.extra };
    if (server.requestId) {
      const upstreamRequestId = extra.requestId;
      extra.requestId = server.requestId;
      if (upstreamRequestId !== undefined && upstreamRequestId !== server.requestId) {
        const known = Array.isArray(extra.upstreamRequestIds) ? extra.upstreamRequestIds : [];
        extra.upstreamRequestIds = [upstreamRequestId, ...known];
      }
    }

    return getError({
      statusCode: response.status,
      message: server.normalized?.text ?? server.message ?? `HTTP ${response.status}`,
      messageCode: server.normalized?.code,
      messageArgs: server.normalized?.args,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
      cause: server.details?.cause,
    });
  }

  convertResponse<TData = AnyType>(opts: {
    response: {
      data: TData | { data: TData; count?: number };
      headers: Record<string, AnyType>;
    };
    type: string;
    requestCountData?: TConstValue<typeof RequestCountData>;
  }): {
    data: TData;
    count?: number;
    total?: number;
  } {
    const {
      response: { data, headers },
      type,
      requestCountData,
    } = opts;

    switch (type) {
      case RequestTypes.GET_LIST:
      case RequestTypes.GET_MANY_REFERENCE: {
        if (requestCountData === RequestCountData.DATA_WITH_COUNT) {
          if (!('data' in (data as AnyType)) || !('count' in (data as AnyType))) {
            throw getError({
              message: `[convertResponse] Invalid response format for requestCountData=${RequestCountData.DATA_WITH_COUNT} !`,
            });
          }

          const dataFormatted = data as { data: TData; count?: number };

          const normalizedData = !Array.isArray(dataFormatted.data)
            ? [dataFormatted.data]
            : dataFormatted.data;

          const total = this.resolveTotal({ headers, rowCount: normalizedData.length });

          return {
            data: normalizedData as TData,
            count: dataFormatted?.count ?? normalizedData.length,
            total,
          };
        }

        const normalizedData = !Array.isArray(data) ? [data] : data;

        const total = this.resolveTotal({ headers, rowCount: normalizedData.length });

        return {
          data: normalizedData as TData,
          total,
        };
      }
      default: {
        if (requestCountData === RequestCountData.DATA_WITH_COUNT) {
          return data as { data: TData; count?: number };
        }

        // A missing or non-numeric header means the server sent no count - never NaN.
        const count = Number.parseInt(headers?.get(HeaderConstants.RESPONSE_COUNT_DATA) ?? '', 10);
        return {
          data: data as TData,
          count: Number.isNaN(count) ? undefined : count,
        };
      }
    }
  }

  private async parseResponse<ReturnType = AnyType>(opts: {
    response: Response;
    type: TRequestType;
    requestCountData?: TConstValue<typeof RequestCountData>;
  }): Promise<{
    data: ReturnType;
    count?: number;
    total?: number;
    filename?: string;
    contentDisposition?: string;
    extra?: Record<string, unknown>;
  }> {
    const { response: rs, type, requestCountData } = opts;

    if (rs.status === 204) {
      return { data: {} as ReturnType };
    }

    const contentType = (rs.headers?.get(HeaderConstants.CONTENT_TYPE) ?? '').toLowerCase();
    const contentDisposition = rs.headers?.get(HeaderConstants.CONTENT_DISPOSITION) ?? '';

    const isAttachment = HeaderConstants.ATTACHMENT_CONTENT_DISPOSITION_RE.test(contentDisposition);
    const isTextual =
      contentType !== '' && HeaderConstants.TEXTUAL_CONTENT_TYPE_RE.test(contentType);

    if (isAttachment || !isTextual) {
      const blob = await rs.blob();
      const filename = this.parseFilenameFromContentDisposition({ header: contentDisposition });

      return {
        data: blob as ReturnType,
        ...(filename ? { filename } : {}),
        ...(contentDisposition ? { contentDisposition } : {}),
      };
    }

    const jsonRs = await rs.json();

    // A route with extras answers `{ data, extra }`, marked by `x-response-extra`; a route with a
    // default extra answers it unasked. `readExtra` strips only `extra`, so a count-in-body request
    // still reads `{ count, data }` (IGNIS kernel 0.2.1-5 and later).
    const { body, extra } = HttpResponseReader.readExtra({ body: jsonRs, headers: rs.headers });

    const converted = this.convertResponse<ReturnType>({
      type,
      requestCountData,
      response: {
        headers: rs.headers ?? {},
        data: body as ReturnType,
      },
    });

    return extra ? { ...converted, extra } : converted;
  }

  async doRequest<ReturnType = AnyType>(
    opts: IGetRequestPropsResult & {
      baseUrl?: string;
      query?: any;
      type: TRequestType;
      method: TRequestMethod;
      paths: string[];
      requestCountData?: TConstValue<typeof RequestCountData>;
    },
  ): Promise<{
    data: ReturnType;
    count?: number;
    total?: number; // GET_LIST || GET_MANY_REFERENCE
    filename?: string;
    contentDisposition?: string;
    extra?: Record<string, unknown>; // what a route with list extras answered
  }> {
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

    if (!baseUrl || isEmpty(baseUrl)) {
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

    let rs = await sendOnce(headers);

    if (rs.status === 401 && this.canRecover(paths)) {
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

        rs = await sendOnce(retryHeaders);
      }
    }

    const status = rs.status;

    if (status < 200 || status >= 300) {
      throw await this.toResponseError({ response: rs });
    }

    return this.parseResponse<ReturnType>({ response: rs, type, requestCountData });
  }
}
