import { ContentDispositionTypes, HTTP } from '@venizia/ignis-helpers/common';
import { getError } from '@venizia/ignis-inversion';
import {
  FetchSchemaError,
  HttpResponseReader,
  type IFetchSchemaIssue,
  LoggerFactory,
  RecordUtility,
} from '@venizia/ignis-helpers/core';

import {
  type INetworkResponse,
  type IResponseSchema,
  RequestCountData,
  RequestTypes,
  type TConstValue,
  type TRequestType,
} from '@/common';

/** A list body that carries its rows and its total: `{ data, count }`. Null and primitives are not one. */
const isCountedBody = (value: unknown): value is { data: unknown; count?: unknown } => {
  return typeof value === 'object' && value !== null && 'data' in value && 'count' in value;
};

/** What `read` takes besides a schema. */
interface IReadResponseOptions {
  response: Response;
  type: TRequestType;
  requestCountData?: TConstValue<typeof RequestCountData>;
}

/** The issue the IGNIS fetchers give for a body that is no JSON, an empty one included. */
const NO_BODY_ISSUE: IFetchSchemaIssue = { path: [], code: 'invalid_json' };

/** A path of a schema issue as the IGNIS fetchers report it: a symbol as its text. */
const toIssuePath = (opts: { path: unknown }): Array<string | number> => {
  const { path } = opts;

  if (!Array.isArray(path)) {
    return [];
  }

  return path.flatMap((part) => {
    if (typeof part === 'symbol') {
      return [String(part)];
    }

    return typeof part === 'string' || typeof part === 'number' ? [part] : [];
  });
};

/**
 * Where and by which rule a schema refused: the `issues` of what it threw, as zod shapes them, or one
 * `custom` issue at the root when it threw none. Never the message or a value, which may quote the body.
 */
const issuesOf = (opts: { error: unknown }): IFetchSchemaIssue[] => {
  const { error } = opts;
  const issues = RecordUtility.isRecord(error) ? error.issues : undefined;

  const named = Array.isArray(issues) ? issues.filter(RecordUtility.isRecord) : [];

  if (named.length === 0) {
    return [{ path: [], code: 'custom' }];
  }

  return named.map(({ path, code }) => ({
    path: toIssuePath({ path }),
    code: typeof code === 'string' ? code : 'custom',
  }));
};

/**
 * Reads a `Response` into an `INetworkResponse`, and an error response into an error.
 */
export class NetworkResponseReader {
  /** The server wraps an error body under this key; both transports unwrap it. */
  static readonly ERROR_ROOT_KEY = 'error';

  private static readonly DIGITS_RE = /^\d+$/;

  /** Content types read as text. */
  private static readonly TEXTUAL_RE =
    /^(application\/(json|.*\+json|xml|.*\+xml|x-www-form-urlencoded|javascript|graphql)|text\/)/i;

  /**
   * A response as `INetworkResponse` whose `data` the schema checked and typed. The schema is given
   * the data as it was read: the rows of a list, the `Blob` of a file. What it refuses throws a
   * `FetchSchemaError` (502). A textual body is read as JSON whatever its type says; one that is no
   * JSON, a 204, and an empty body of no content type that is no attachment are refused too (code
   * `invalid_json`, as in the IGNIS fetchers).
   */
  static read<TResult>(
    opts: IReadResponseOptions & { schema: IResponseSchema<TResult> },
  ): Promise<INetworkResponse<TResult>>;
  /** A response as `INetworkResponse`: JSON read by the request type, a file as a `Blob`. `data` is `unknown`. */
  static read(opts: IReadResponseOptions & { schema?: IResponseSchema }): Promise<INetworkResponse>;
  static async read(
    opts: IReadResponseOptions & { schema?: IResponseSchema },
  ): Promise<INetworkResponse> {
    const { schema, response } = opts;

    if (!schema) {
      return NetworkResponseReader.readUnchecked(opts);
    }

    const { status, url } = response;
    const json = await NetworkResponseReader.readSchemaJson({ response });
    const read = await NetworkResponseReader.readUnchecked({ ...opts, json });
    const { contentType, isAttachment } = NetworkResponseReader.describeBody({ response });

    // No content type and no attachment reads as a `Blob`: an empty one is nothing to check.
    const isNoBody =
      contentType === '' && !isAttachment && read.data instanceof Blob && read.data.size === 0;

    if (isNoBody) {
      throw NetworkResponseReader.noBodyRefusal({ response });
    }

    return NetworkResponseReader.checkData({ response: read, schema, status, url });
  }

  /**
   * A count as a server sends it: a non-negative integer, or a string of digits. Anything else is
   * `undefined`.
   */
  static parseCount(opts: { count: unknown }): number | undefined {
    const { count } = opts;
    const isDigits = typeof count === 'string' && NetworkResponseReader.DIGITS_RE.test(count);
    const parsed = typeof count === 'number' || isDigits ? Number(count) : Number.NaN;

    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  /**
   * The response with its `data` checked and typed by the schema, for a transport that builds an
   * `INetworkResponse` itself. Whatever `parse` throws, a bug inside it included, becomes a
   * `FetchSchemaError` (502) that names paths and rules, never the data.
   */
  static checkData<TResult>(opts: {
    response: INetworkResponse;
    schema: IResponseSchema<TResult>;
    /** The status the data came with. @default 200 */
    status?: number;
    url?: string;
  }): INetworkResponse<TResult> {
    const { response, schema, status = HTTP.ResultCodes.RS_2.Ok, url = '' } = opts;

    try {
      return { ...response, data: schema.parse(response.data) };
    } catch (error) {
      throw NetworkResponseReader.refusal({ status, url, issues: issuesOf({ error }) });
    }
  }

  /**
   * The JSON of a textual body, whatever textual type it names, for a schema to check; nothing for a
   * file. Throws `invalid_json` for a 204 and for a textual body that is no JSON.
   */
  private static async readSchemaJson(opts: {
    response: Response;
  }): Promise<{ body: unknown } | undefined> {
    const { response } = opts;

    if (response.status === HTTP.ResultCodes.RS_2.NoContent) {
      throw NetworkResponseReader.noBodyRefusal({ response });
    }

    const { contentType, isAttachment } = NetworkResponseReader.describeBody({ response });

    if (isAttachment || !NetworkResponseReader.TEXTUAL_RE.test(contentType)) {
      return undefined;
    }

    const text = await response.text();

    try {
      return { body: JSON.parse(text) };
    } catch {
      // Without the parse error: its message quotes the body.
      throw NetworkResponseReader.noBodyRefusal({ response });
    }
  }

  /** The refusal of an answer that holds no JSON and no file. */
  private static noBodyRefusal(opts: { response: Response }): FetchSchemaError {
    const { status, url } = opts.response;

    return NetworkResponseReader.refusal({ status, url, issues: [NO_BODY_ISSUE] });
  }

  /** What the headers say of the body: its content type, lower-cased, and whether it is an attachment. */
  private static describeBody(opts: { response: Response }) {
    const { headers } = opts.response;
    const contentType = (headers?.get(HTTP.Headers.CONTENT_TYPE) ?? '').toLowerCase();
    const contentDisposition = headers?.get(HTTP.Headers.CONTENT_DISPOSITION) ?? '';
    const { type } = HttpResponseReader.parseContentDisposition({ header: contentDisposition });
    const isAttachment = type?.toLowerCase() === ContentDispositionTypes.ATTACHMENT;

    return { contentType, contentDisposition, isAttachment };
  }

  private static refusal(opts: {
    status: number;
    url: string;
    issues: IFetchSchemaIssue[];
  }): FetchSchemaError {
    const { status, url, issues } = opts;

    // Without the query: it may carry a token or user data.
    return new FetchSchemaError({ status, url: url.split('?')[0] ?? '', issues });
  }

  /** `json` is the body already read and parsed, for a textual answer. */
  private static async readUnchecked(
    opts: IReadResponseOptions & { json?: { body: unknown } },
  ): Promise<INetworkResponse> {
    const { response, type, requestCountData, json } = opts;

    if (response.status === 204) {
      return { data: {} };
    }

    const { contentType, contentDisposition, isAttachment } = NetworkResponseReader.describeBody({
      response,
    });
    const isTextual = contentType !== '' && NetworkResponseReader.TEXTUAL_RE.test(contentType);

    if (isAttachment || !isTextual) {
      const { blob, filename } = await HttpResponseReader.readFile({ response });

      return {
        data: blob,
        ...(filename ? { filename } : {}),
        ...(contentDisposition ? { contentDisposition } : {}),
      };
    }

    let parsedBody = json?.body;

    if (!json) {
      const body = await HttpResponseReader.readBody({
        response,
        context: `[NetworkResponseReader] ${response.status}`,
      });
      parsedBody = body;
    }

    // A route with extras answers `{ data, extra }`; `readExtra` strips only `extra`, so a
    // count-in-body request still reads `{ count, data }`.
    const { body, extra } = HttpResponseReader.readExtra({
      body: parsedBody,
      headers: response.headers,
    });

    const converted = NetworkResponseReader.convert({
      type,
      requestCountData,
      response: { headers: response.headers, data: body },
    });

    return extra ? { ...converted, extra } : converted;
  }

  /**
   * Shapes a parsed body by request type. `GET_LIST` and `GET_MANY_REFERENCE` give `data` as an
   * array and `total` from `Content-Range`, else the row count; with `RequestCountData.DATA_WITH_COUNT`
   * the body must be `{ data, count }`, or it throws; its `count` is read by `parseCount` (none gives the row count, any other value 0 and a warning). Any other type gives `data` as is, and `count`
   * from `x-response-count` when that is a number; with `DATA_WITH_COUNT` it returns the
   * `data` of a `{ data, count }` body, with its `count` and `total` when they are numbers, and no
   * `data` for a body that is no plain object. Other keys of the body are left out.
   */
  static convert(opts: {
    response: {
      data: unknown;
      headers: Pick<Headers, 'get'>;
    };
    type: string;
    requestCountData?: TConstValue<typeof RequestCountData>;
  }): {
    data: unknown;
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
          if (!isCountedBody(data)) {
            throw getError({
              message: `[convertResponse] Invalid response format for requestCountData=${RequestCountData.DATA_WITH_COUNT} !`,
            });
          }

          const normalizedData = NetworkResponseReader.toRows({ data: data.data });

          const total = NetworkResponseReader.resolveTotal({
            headers,
            rowCount: normalizedData.length,
          });

          return {
            data: normalizedData,
            count: NetworkResponseReader.toListCount({
              count: data.count,
              rowCount: normalizedData.length,
            }),
            total,
          };
        }

        const normalizedData = NetworkResponseReader.toRows({ data });

        const total = NetworkResponseReader.resolveTotal({
          headers,
          rowCount: normalizedData.length,
        });

        return {
          data: normalizedData,
          total,
        };
      }
      default: {
        if (requestCountData === RequestCountData.DATA_WITH_COUNT) {
          // Only the keys of the answer, each of its own type: another body key would pass as one.
          if (!RecordUtility.isPlainRecord(data)) {
            return { data: undefined };
          }

          const { count, total } = data;

          return {
            data: data.data,
            count: typeof count === 'number' ? count : undefined,
            total: typeof total === 'number' ? total : undefined,
          };
        }

        // A missing or non-numeric header means the server sent no count - never NaN.
        const count = Number.parseInt(headers?.get(HTTP.Headers.RESPONSE_COUNT_DATA) ?? '', 10);

        return {
          data,
          count: Number.isNaN(count) ? undefined : count,
        };
      }
    }
  }

  /** The count of a list body: the row count when it names none, 0 and a warning for any other non-count. */
  private static toListCount(opts: { count: unknown; rowCount: number }): number {
    const { count, rowCount } = opts;

    if (count === undefined || count === null) {
      return rowCount;
    }

    const parsed = NetworkResponseReader.parseCount({ count });

    if (parsed === undefined) {
      LoggerFactory.getLogger([NetworkResponseReader.name]).warn(
        '[convert] The count is no non-negative integer, count is 0 | count: %o',
        count,
      );
    }

    return parsed ?? 0;
  }

  /** The rows of a list answer: an array as it is, no body at all (an empty answer) as no row, any other value as the one row. */
  private static toRows(opts: { data: unknown }): unknown[] {
    const { data } = opts;

    if (Array.isArray(data)) {
      return data;
    }

    return data === null || data === undefined ? [] : [data];
  }

  /** The total from `Content-Range`, or the page's own row count when the header is absent or malformed. */
  private static resolveTotal(opts: { headers: Pick<Headers, 'get'>; rowCount: number }): number {
    const range = HttpResponseReader.parseContentRange({
      header: opts.headers?.get(HTTP.Headers.CONTENT_RANGE),
    });

    return range?.total ?? opts.rowCount;
  }

  /**
   * The file name the `Content-Disposition` of a response names, `filename*` (UTF-8, decoded) before
   * `filename`, or `undefined` when the header is absent or names none. `read` returns the same name
   * as `filename`.
   */
  static readFilename(opts: { headers?: Pick<Headers, 'get'> }): string | undefined {
    return HttpResponseReader.parseContentDisposition({
      header: opts.headers?.get(HTTP.Headers.CONTENT_DISPOSITION),
    }).filename;
  }
}
