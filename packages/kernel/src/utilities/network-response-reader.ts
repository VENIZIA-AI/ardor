import { ContentDispositionTypes, HTTP } from '@venizia/ignis-helpers/common';
import { getError } from '@venizia/ignis-inversion';
import { HttpResponseReader } from '@venizia/ignis-helpers/core';

import {
  type INetworkResponse,
  RequestCountData,
  RequestTypes,
  type TConstValue,
  type TRequestType,
} from '@/common';

/** A list body that carries its rows and its total: `{ data, count }`. Null and primitives are not one. */
const isCountedBody = (value: unknown): value is { data: unknown; count?: number } => {
  return typeof value === 'object' && value !== null && 'data' in value && 'count' in value;
};

/**
 * Reads a `Response` into an `INetworkResponse`, and an error response into an error.
 *
 * @useWhen you read a `Response` into a typed result or a typed error
 * @insteadOf `response.json()` with hand-written error handling
 */
export class NetworkResponseReader {
  /** The server wraps an error body under this key; both transports unwrap it. */
  static readonly ERROR_ROOT_KEY = 'error';

  /** Content types read as text. */
  private static readonly TEXTUAL_RE =
    /^(application\/(json|.*\+json|xml|.*\+xml|x-www-form-urlencoded|javascript|graphql)|text\/)/i;

  /** A response as `INetworkResponse`: JSON read by the request type, a file as a `Blob`. */
  static async read<TResult = unknown>(opts: {
    response: Response;
    type: TRequestType;
    requestCountData?: TConstValue<typeof RequestCountData>;
  }): Promise<INetworkResponse<TResult>> {
    const { response, type, requestCountData } = opts;

    if (response.status === 204) {
      return { data: {} as TResult };
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
        data: blob as TResult,
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

    const converted = NetworkResponseReader.convert<TResult>({
      type,
      requestCountData,
      response: { headers: response.headers, data: body as TResult },
    });

    return extra ? { ...converted, extra } : converted;
  }

  /**
   * Shapes a parsed body by request type. `GET_LIST` and `GET_MANY_REFERENCE` give `data` as an
   * array and `total` from `Content-Range`, else the row count; with `RequestCountData.DATA_WITH_COUNT`
   * the body must be `{ data, count }`, or it throws. Any other type gives `data` as is, and `count`
   * from `x-response-count` when that is a number; with `DATA_WITH_COUNT` it returns the
   * `{ data, count }` body unchanged.
   */
  static convert<TData = unknown>(opts: {
    response: {
      data: TData | { data: TData; count?: number };
      headers: Pick<Headers, 'get'>;
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
          if (!isCountedBody(data)) {
            throw getError({
              message: `[convertResponse] Invalid response format for requestCountData=${RequestCountData.DATA_WITH_COUNT} !`,
            });
          }

          const dataFormatted = data as { data: TData; count?: number };

          const normalizedData = NetworkResponseReader.toRows({ data: dataFormatted.data });

          const total = NetworkResponseReader.resolveTotal({
            headers,
            rowCount: normalizedData.length,
          });

          return {
            data: normalizedData as TData,
            count: dataFormatted?.count ?? normalizedData.length,
            total,
          };
        }

        const normalizedData = NetworkResponseReader.toRows({ data });

        const total = NetworkResponseReader.resolveTotal({
          headers,
          rowCount: normalizedData.length,
        });

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
        const count = Number.parseInt(headers?.get(HTTP.Headers.RESPONSE_COUNT_DATA) ?? '', 10);

        return {
          data: data as TData,
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
