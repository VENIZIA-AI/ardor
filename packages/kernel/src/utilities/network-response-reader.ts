import { ContentDispositionTypes, HTTP } from '@venizia/ignis-helpers/common';
import { getError } from '@venizia/ignis-inversion';
import {
  FetchSchemaError,
  HttpResponseReader,
  type IFetchSchemaIssue,
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
const isCountedBody = (value: unknown): value is { data: unknown; count?: number } => {
  return typeof value === 'object' && value !== null && 'data' in value && 'count' in value;
};

/** What `read` takes besides a schema. */
interface IReadResponseOptions {
  response: Response;
  type: TRequestType;
  requestCountData?: TConstValue<typeof RequestCountData>;
}

const isPathPart = (value: unknown): value is string | number => {
  return typeof value === 'string' || typeof value === 'number';
};

/**
 * Where and by which rule a schema refused: the `issues` of what it threw, as zod shapes them. Never
 * the message or a value, which may quote the body.
 */
const issuesOf = (error: unknown): IFetchSchemaIssue[] => {
  const issues = RecordUtility.isRecord(error) ? error.issues : undefined;

  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.filter(RecordUtility.isRecord).map(({ path, code }) => ({
    path: Array.isArray(path) ? path.filter(isPathPart) : [],
    code: typeof code === 'string' ? code : 'custom',
  }));
};

/**
 * Reads a `Response` into an `INetworkResponse`, and an error response into an error.
 */
export class NetworkResponseReader {
  /** The server wraps an error body under this key; both transports unwrap it. */
  static readonly ERROR_ROOT_KEY = 'error';

  /** Content types read as text. */
  private static readonly TEXTUAL_RE =
    /^(application\/(json|.*\+json|xml|.*\+xml|x-www-form-urlencoded|javascript|graphql)|text\/)/i;

  /**
   * A response as `INetworkResponse` whose `data` the schema checked and typed. The schema is given
   * the data as it was read: the rows of a list, `{}` of a 204, the `Blob` of a file. What it refuses
   * throws a `FetchSchemaError` (502).
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
    const read = await NetworkResponseReader.readUnchecked(opts);

    return schema
      ? NetworkResponseReader.checkData({
          response: read,
          schema,
          status: response.status,
          url: response.url,
        })
      : read;
  }

  /**
   * The response with its `data` checked and typed by the schema, for a transport that builds an
   * `INetworkResponse` itself. What the schema refuses throws a `FetchSchemaError` (502) that names
   * paths and rules, never the data.
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
      // Without the query: it may carry a token or user data.
      throw new FetchSchemaError({
        status,
        url: url.split('?')[0] ?? '',
        issues: issuesOf(error),
      });
    }
  }

  private static async readUnchecked(opts: IReadResponseOptions): Promise<INetworkResponse> {
    const { response, type, requestCountData } = opts;

    if (response.status === 204) {
      return { data: {} };
    }

    const contentType = (response.headers?.get(HTTP.Headers.CONTENT_TYPE) ?? '').toLowerCase();
    const contentDisposition = response.headers?.get(HTTP.Headers.CONTENT_DISPOSITION) ?? '';

    const { type: dispositionType } = HttpResponseReader.parseContentDisposition({
      header: contentDisposition,
    });
    const isAttachment = dispositionType?.toLowerCase() === ContentDispositionTypes.ATTACHMENT;
    const isTextual = contentType !== '' && NetworkResponseReader.TEXTUAL_RE.test(contentType);

    if (isAttachment || !isTextual) {
      const { blob, filename } = await HttpResponseReader.readFile({ response });

      return {
        data: blob,
        ...(filename ? { filename } : {}),
        ...(contentDisposition ? { contentDisposition } : {}),
      };
    }

    const parsedBody = await HttpResponseReader.readBody({
      response,
      context: `[NetworkResponseReader] ${response.status}`,
    });

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
   * the body must be `{ data, count }`, or it throws. Any other type gives `data` as is, and `count`
   * from `x-response-count` when that is a number; with `DATA_WITH_COUNT` it returns the
   * keys of a `{ data, count }` body, a `count` that is no number left out, and no `data` for a body
   * that is no plain object.
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
            count: data.count ?? normalizedData.length,
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
          // The `{ data, count }` body, with a `count` only when it is a number.
          if (!RecordUtility.isPlainRecord(data)) {
            return { data: undefined };
          }

          const { count } = data;

          return { ...data, data: data.data, count: typeof count === 'number' ? count : undefined };
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
