import { getError } from '@venizia/ignis-inversion';
import { HttpResponseReader } from '@venizia/ignis-kernel/repository';

import {
  HeaderConstants,
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

export class ResponseReader {
  /** The server wraps an error body under this key; both transports unwrap it. */
  static readonly ERROR_ROOT_KEY = 'error';

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

    const contentType = (response.headers?.get(HeaderConstants.CONTENT_TYPE) ?? '').toLowerCase();
    const contentDisposition = response.headers?.get(HeaderConstants.CONTENT_DISPOSITION) ?? '';

    const isAttachment = HeaderConstants.ATTACHMENT_CONTENT_DISPOSITION_RE.test(contentDisposition);
    const isTextual =
      contentType !== '' && HeaderConstants.TEXTUAL_CONTENT_TYPE_RE.test(contentType);

    if (isAttachment || !isTextual) {
      const blob = await response.blob();
      const filename = ResponseReader.parseFilename({ header: contentDisposition });

      return {
        data: blob as TResult,
        ...(filename ? { filename } : {}),
        ...(contentDisposition ? { contentDisposition } : {}),
      };
    }

    const parsedBody = await response.json();

    // A route with extras answers `{ data, extra }`; `readExtra` strips only `extra`, so a
    // count-in-body request still reads `{ count, data }`.
    const { body, extra } = HttpResponseReader.readExtra({
      body: parsedBody,
      headers: response.headers,
    });

    const converted = ResponseReader.convert<TResult>({
      type,
      requestCountData,
      response: { headers: response.headers, data: body as TResult },
    });

    return extra ? { ...converted, extra } : converted;
  }

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

          const normalizedData = !Array.isArray(dataFormatted.data)
            ? [dataFormatted.data]
            : dataFormatted.data;

          const total = ResponseReader.resolveTotal({ headers, rowCount: normalizedData.length });

          return {
            data: normalizedData as TData,
            count: dataFormatted?.count ?? normalizedData.length,
            total,
          };
        }

        const normalizedData = !Array.isArray(data) ? [data] : data;

        const total = ResponseReader.resolveTotal({ headers, rowCount: normalizedData.length });

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

  /**
   * A failed response as an `ApplicationError`, mapped like IGNIS `HttpDataSource`: the HTTP status,
   * the server's code and args, its `extra` with the `requestId` added, and `details.cause`.
   * `message` is the server's text, not a log line, because react-admin shows it to the user.
   */
  static async toError(opts: { response: Response }) {
    const { response } = opts;
    const server = await HttpResponseReader.readError({
      response,
      rootKey: ResponseReader.ERROR_ROOT_KEY,
    });

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

  /** The total from `Content-Range`, or the page's own row count when the header is absent or malformed. */
  private static resolveTotal(opts: { headers: Pick<Headers, 'get'>; rowCount: number }): number {
    const range = HttpResponseReader.parseContentRange({
      header: opts.headers?.get(HeaderConstants.CONTENT_RANGE),
    });
    return range?.total ?? opts.rowCount;
  }

  /** The file name a `Content-Disposition` header names, `filename*` before `filename`. */
  private static parseFilename(opts: { header: string }): string | undefined {
    const { header } = opts;

    if (!header) {
      return undefined;
    }

    const encodedMatch = header.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
    if (encodedMatch) {
      try {
        return decodeURIComponent(encodedMatch[2].trim());
      } catch {
        return encodedMatch[2].trim();
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
}
