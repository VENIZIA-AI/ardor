import { getError } from '@venizia/ignis-inversion';
import { uuidV4 } from '@venizia/ignis-helpers/uuid';
import isEmpty from 'lodash/isEmpty.js';
import merge from 'lodash/merge.js';

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
 * `HeadersInit` as a plain record, keys lowercased: header names are case-insensitive but object keys
 * are not, and two spellings of one name would reach the wire joined as `"1, 0"`.
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

// `FileList` exists only in a DOM; the bare identifier throws in Workers and on Bun.
const isFileList = (value: unknown): value is FileList => {
  return typeof FileList !== 'undefined' && value instanceof FileList;
};

/** A multipart text value: JSON for objects and arrays, ISO-8601 for a `Date`, `String()` otherwise. */
const encodeFormValue = (opts: { key: string; value: unknown; bodyType: string }): string => {
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
};

/** Skips only `undefined` and `null`: `0`, `false` and `''` are values the caller meant to send. */
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

/** Where a token comes from when none was set on the service. */
export type TAuthTokenResolver = () => IAuthTokenRecord | undefined;

/**
 * Reads the stored token, and `undefined` outside a browser. Also the resolver to hand
 * `HttpDataSource`, so both transports send the same token.
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

    // A refreshToken that throws synchronously is still a failed refresh, not a stray exception.
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

    // The record is keyed by lowercase name.
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
      // A token need not name a provider; never send the string `undefined`.
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

    // Merged, not spread, so a per-request value replaces a static header in any case.
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
          // Skip only what was never provided; `0`, `false` and `''` are values.
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
