import { getError } from '@venizia/ignis-inversion';
import { uuidV4 } from '@venizia/ignis-helpers/uuid';
import isEmpty from 'lodash/isEmpty';
import merge from 'lodash/merge';

import {
  type AnyType,
  App,
  HeaderConsts,
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
import { NodeFetchNetworkRequest } from '@/helpers';
import { isDefined } from '@/utilities';
import { BaseService } from './base';

const parseFilenameFromContentDisposition = (header: string): string | undefined => {
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
};

const normalizeNoAuthPathRegex = (input?: TNoAuthPathRegex): RegExp[] => {
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
      console.error(
        '[DefaultNetworkRequestService][normalizeNoAuthPathRegex] Invalid noAuthPathRegex pattern: %s',
        pattern,
      );
    }
  }

  return rs;
};

/**
 * `HeadersInit` admits a `Headers` instance and a tuple list; the service keeps a plain record.
 *
 * Keys are lowercased on the way in, and that is the whole point rather than tidiness. Header names
 * are case-insensitive, but object keys are not: `{ 'X-Request-Count': '1' }` merged over
 * `{ 'x-request-count': '0' }` keeps BOTH, and `new Headers()` then joins them into `"1, 0"` - a
 * value neither side wrote and nothing parses. A caller overriding a header would silently corrupt
 * it instead of replacing it. Measured against a stub before this existed.
 */
const toHeaderRecord = (headers: HeadersInit | undefined): Record<string, string> => {
  if (!headers) {
    return {};
  }

  const entries = (() => {
    if (headers instanceof Headers) {
      return [...headers.entries()];
    }
    return Array.isArray(headers) ? headers : Object.entries(headers);
  })();

  const rs: Record<string, string> = {};
  for (const [key, value] of entries) {
    rs[key.toLowerCase()] = value;
  }

  return rs;
};

/** Merge header sources so a later source REPLACES an earlier one, whatever case either used. */
const mergeHeaders = (...sources: Array<HeadersInit | undefined>): Record<string, string> => {
  return sources.reduce<Record<string, string>>((acc, source) => {
    return Object.assign(acc, toHeaderRecord(source));
  }, {});
};

// `FileList` exists only in a DOM; the kernel also runs in Workers and on Bun, where the bare
// identifier throws. A type guard keeps the narrowing `instanceof` gave the branch below.
const isFileList = (value: unknown): value is FileList => {
  return typeof FileList !== 'undefined' && value instanceof FileList;
};

/**
 * Encodes one value for a multipart text part.
 *
 * A multipart part is bytes, so everything that is not a `Blob` becomes a string - but `String()`
 * alone is wrong for two shapes a caller reaches for constantly:
 *
 * - a plain object or array stringifies to `"[object Object]"` / `"a,b"`, which the server can only
 *   reject, sent with no warning that anything was lost;
 * - a `Date` stringifies to a locale- and timezone-dependent sentence, not something an API parses.
 *
 * JSON and ISO-8601 are the encodings that survive the trip. A primitive is left alone.
 */
const encodeFormValue = (opts: { key: string; value: unknown; bodyType: string }): string => {
  const { key, value, bodyType } = opts;

  // `application/x-www-form-urlencoded` carries text, never bytes. Encoding a file here produces
  // `"{}"` or `"[object Blob]"` and the upload is gone with nothing said, so it is named instead:
  // the caller wanted `form-data` and there is no encoding that would have made this work.
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
};

/**
 * Appends one form-data entry, whatever its type.
 *
 * `undefined` and `null` are skipped, and nothing else is: a falsy check drops `0`, `false` and
 * `''`, which are values a caller meant to send and the server never sees. The three-argument
 * `append` is for a `Blob` and its filename - passing a filename beside a string throws, which is
 * why a form-data body used to accept files and nothing else.
 */
const appendFormDataValue = (opts: { formData: FormData; key: string; value: unknown }): void => {
  const { formData, key, value } = opts;

  if (!isDefined(value)) {
    return;
  }

  if (value instanceof Blob) {
    formData.append(key, value, (value as File).name);
    return;
  }

  formData.append(key, encodeFormValue({ key, value, bodyType: RequestBodyTypes.FORM_DATA }));
};

export interface IAuthTokenRecord {
  type?: string;
  value: string;
  provider?: string;
}

/**
 * Where a token comes from when none was set on the service.
 *
 * `localStorage` is the browser's answer, not the only one: the same transport pointed at another
 * server has its token in memory or in the environment, and a server has no `localStorage` to read.
 * Keeping the lookup behind a function is the whole difference between a transport that runs in one
 * place and one that runs in both.
 */
export type TAuthTokenResolver = () => IAuthTokenRecord | undefined;

/**
 * The browser resolver: read the stored token, and say nothing where there is no browser.
 *
 * It is this service's default, and it is exported for the same job elsewhere: `HttpDataSource` from
 * `@venizia/ignis-connectors/http` ships no browser lookup by design, so an ARDOR app hands it this -
 * `authTokenResolver: readAuthTokenFromStorage` - and both transports read the one stored token.
 *
 * The guard is not defensive padding - this used to be an unguarded `localStorage.getItem` that ran
 * before the in-memory token was even consulted, so a caller that had supplied a token explicitly
 * still crashed with `ReferenceError` the moment the code left a DOM.
 */
export const readAuthTokenFromStorage: TAuthTokenResolver = () => {
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
};

export class DefaultNetworkRequestService extends BaseService {
  protected authToken?: IAuthTokenRecord;
  protected authTokenResolver: TAuthTokenResolver;
  protected useAuth: boolean;
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
      authTokenResolver?: TAuthTokenResolver;
    },
  ) {
    super({ scope: DefaultNetworkRequestService.name });
    const {
      name,
      baseUrl = '',
      headers = {},
      useAuth = true,
      noAuthPaths,
      noAuthPathRegex,
      authRecovery,
      authTokenResolver = readAuthTokenFromStorage,
    } = opts;

    this.authTokenResolver = authTokenResolver;
    this.headers = toHeaderRecord(headers);
    this.useAuth = useAuth;
    this.noAuthPaths = noAuthPaths;
    this.noAuthPathRegexes = normalizeNoAuthPathRegex(noAuthPathRegex);
    this.baseUrl = baseUrl;
    this.authRecovery = authRecovery;
    this.networkRequest = new NodeFetchNetworkRequest({
      name,
      networkOptions: { baseUrl, headers },
    });
  }

  isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean {
    if (!this.useAuth) {
      return true;
    }

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

    return this.noAuthPathRegexes.some((regex) => {
      return candidates.some((candidate) => {
        regex.lastIndex = 0;
        return regex.test(candidate);
      });
    });
  }

  setUseAuth(useAuth: boolean) {
    this.useAuth = useAuth;
  }

  setNoAuthPaths(noAuthPaths?: string[]) {
    this.noAuthPaths = noAuthPaths;
  }

  setNoAuthPathRegex(noAuthPathRegex?: TNoAuthPathRegex) {
    this.noAuthPathRegexes = normalizeNoAuthPathRegex(noAuthPathRegex);
  }

  private ensureRefreshed(): Promise<boolean> {
    const rec = this.authRecovery;
    const refreshToken = rec?.refreshToken;
    if (!rec || !refreshToken) {
      return Promise.resolve(false);
    }

    // `Promise.resolve().then(...)` so a refreshToken that throws synchronously is a failed
    // refresh (onAuthFailure, original 401) rather than an unrelated exception out of doRequest.
    this.refreshing ??= Promise.resolve()
      .then(() => refreshToken())
      .then(() => true)
      .catch(async () => {
        try {
          await rec.onAuthFailure?.();
        } catch {
          console.error(
            '[DefaultNetworkRequestService][ensureRefreshed] onAuthFailure callback failed',
          );
        }
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });

    return this.refreshing;
  }

  private canRecover(paths: string[]): boolean {
    const rec = this.authRecovery;
    if (!rec?.refreshToken) {
      return false;
    }

    if (this.isNoAuthPath({ resource: paths?.[0], paths })) {
      return false;
    }

    if (rec.refreshTokenPath && paths?.join('/').includes(rec.refreshTokenPath)) {
      return false;
    }

    return true;
  }

  getRequestAuthorizationHeader() {
    // The explicit token first; the resolver is only consulted when there is nothing in memory.
    const authToken = this.authToken ?? this.authTokenResolver();

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

  setAuthToken(opts: { type?: string; value: string }) {
    const { type, value } = opts;
    this.authToken = { type, value };
  }

  setAuthRecovery(authRecovery: Partial<IAuthRecoveryOptions>) {
    this.authRecovery = { ...this.authRecovery, ...authRecovery };
  }

  getAuthRecovery() {
    return this.authRecovery;
  }

  setHeaders(headers: HeadersInit) {
    this.headers = merge(this.headers, toHeaderRecord(headers));
  }

  removeHeaders(keys: string[]) {
    if (!keys?.length) {
      return;
    }

    // The record is keyed by lowercase name (see `toHeaderRecord`), so the name to remove is too.
    for (const key of keys) {
      delete this.headers[key.toLowerCase()];
    }
  }

  getRequestHeader(opts: { resource: string }): Record<string, string> {
    const { resource } = opts;

    const defaultHeaders = mergeHeaders(
      {
        [HeaderConsts.TIMEZONE]: App.TIMEZONE,
        [HeaderConsts.TIMEZONE_OFFSET]: `${App.TIMEZONE_OFFSET}`,
      },
      this.headers,
    );

    if (this.isNoAuthPath({ resource })) {
      return defaultHeaders;
    }

    const authHeader = this.getRequestAuthorizationHeader();

    return {
      ...defaultHeaders,
      // A token need not name a provider. Setting the header anyway sent the literal string
      // `undefined`, which a server reads as a provider named "undefined" rather than as none.
      ...(authHeader.provider ? { [HeaderConsts.X_AUTH_PROVIDER]: authHeader.provider } : {}),
      [HeaderConsts.AUTHORIZATION]: authHeader.token,
    };
  }

  getRequestProps(params: IGetRequestPropsParams) {
    const {
      bodyType,
      body,
      resource,
      restDataProviderOptions,
      applicationInfo,
      requestCountData = RequestCountData.DATA_ONLY,
    } = params;
    const requestTracingId = restDataProviderOptions.requestTracingId;
    const channel = restDataProviderOptions.requestTracingChannel?.length
      ? restDataProviderOptions.requestTracingChannel
      : RequestChannel.WEB;

    // Merged, not spread: these are per-request values and must REPLACE any static header carrying
    // the same name in another case, rather than sit beside it and be concatenated on the wire.
    const headers: Record<string, AnyType> = mergeHeaders(this.getRequestHeader({ resource }), {
      [HeaderConsts.REQUEST_CHANNEL]: channel,
      [HeaderConsts.REQUEST_COUNT_DATA]: requestCountData,
      [HeaderConsts.REQUEST_TRACING_ID]:
        requestTracingId instanceof Function
          ? requestTracingId({ applicationInfo })
          : `${applicationInfo.name}_${uuidV4()}`,
    });

    const rs: IGetRequestPropsResult = { headers, body };

    switch (bodyType) {
      case RequestBodyTypes.FORM_URL_ENCODED: {
        rs.headers = {
          ...headers,
          [HeaderConsts.CONTENT_TYPE]: 'application/x-www-form-urlencoded',
        };

        const encoded = new URLSearchParams();

        for (const key in body) {
          // Skip only what was never provided. A falsy check drops `0`, `false` and `''`, which are
          // values a caller meant to send - the same bug the form-data branch below carried.
          if (!isDefined(body[key])) {
            continue;
          }

          encoded.append(
            key,
            encodeFormValue({
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

          if (Array.isArray(val) || isFileList(val)) {
            Array.from(val as ArrayLike<unknown>).forEach((item) => {
              appendFormDataValue({ formData, key, value: item });
            });
            continue;
          }

          appendFormDataValue({ formData, key, value: val });
        }

        rs.body = formData;

        break;
      }
      default: {
        rs.headers = {
          ...headers,
          [HeaderConsts.CONTENT_TYPE]: 'application/json',
        };
        rs.body = body;
        break;
      }
    }

    return rs;
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

          const contentRange =
            headers?.get(HeaderConsts.CONTENT_RANGE) ?? `${normalizedData.length}`;
          const total = parseInt(contentRange?.split('/').pop(), 10);

          return {
            data: normalizedData as TData,
            count: dataFormatted?.count ?? normalizedData.length,
            total,
          };
        }

        const normalizedData = !Array.isArray(data) ? [data] : data;

        const contentRange = headers?.get(HeaderConsts.CONTENT_RANGE) ?? `${normalizedData.length}`;
        const total = parseInt(contentRange?.split('/').pop(), 10);

        return {
          data: normalizedData as TData,
          total,
        };
      }
      default: {
        if (requestCountData === RequestCountData.DATA_WITH_COUNT) {
          return data as { data: TData; count?: number };
        }

        const responseCount = headers?.get(HeaderConsts.RESPONSE_COUNT_DATA);
        return {
          data: data as TData,
          count: parseInt(responseCount, 10),
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
  }> {
    const { response: rs, type, requestCountData } = opts;

    if (rs.status === 204) {
      return { data: {} as ReturnType };
    }

    const contentType = (rs.headers?.get(HeaderConsts.CONTENT_TYPE) ?? '').toLowerCase();
    const contentDisposition = rs.headers?.get(HeaderConsts.CONTENT_DISPOSITION) ?? '';

    const isAttachment = HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE.test(contentDisposition);
    const isTextual = contentType !== '' && HeaderConsts.TEXTUAL_CONTENT_TYPE_RE.test(contentType);

    if (isAttachment || !isTextual) {
      const blob = await rs.blob();
      const filename = parseFilenameFromContentDisposition(contentDisposition);

      return {
        data: blob as ReturnType,
        ...(filename ? { filename } : {}),
        ...(contentDisposition ? { contentDisposition } : {}),
      };
    }

    const jsonRs = await rs.json();

    return this.convertResponse<ReturnType>({
      type,
      requestCountData,
      response: {
        headers: rs.headers ?? {},
        data: jsonRs as ReturnType,
      },
    });
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
      const isRefreshed = await this.ensureRefreshed();

      if (isRefreshed) {
        const authHeader = this.getRequestAuthorizationHeader();
        const retryHeaders = {
          ...(headers as Record<string, AnyType>),
          [HeaderConsts.AUTHORIZATION]: authHeader.token,
          ...(authHeader.provider ? { [HeaderConsts.X_AUTH_PROVIDER]: authHeader.provider } : {}),
        };

        rs = await sendOnce(retryHeaders);
      }
    }

    const status = rs.status;

    if (status < 200 || status >= 300) {
      const jsonRs = await rs.json();
      throw jsonRs?.error ?? jsonRs;
    }

    return this.parseResponse<ReturnType>({ response: rs, type, requestCountData });
  }
}
