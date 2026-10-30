import { describe, expect, test } from 'bun:test';
import { isApplicationError } from '@venizia/ignis-inversion';
import { RequestCountData, RequestTypes } from '@/common';
import { ResponseReader } from '@/helpers';

const json = (body: unknown, headers: Record<string, string> = {}, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
};

describe('ResponseReader.read', () => {
  test('a 204 is an empty object', async () => {
    const result = await ResponseReader.read({
      response: new Response(null, { status: 204 }),
      type: RequestTypes.DELETE,
    });

    expect(result).toEqual({ data: {} });
  });

  test('a list body is rows, with the total of Content-Range', async () => {
    const result = await ResponseReader.read({
      response: json([{ id: 1 }, { id: 2 }], { 'content-range': 'items 0-1/10' }),
      type: RequestTypes.GET_LIST,
    });

    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 10 });
  });

  test('a list body with the count in it keeps the count, and the extras beside it', async () => {
    const result = await ResponseReader.read({
      response: json(
        { data: [{ id: 1 }], count: 4, extra: { facets: { open: 3 } } },
        { 'x-response-extra': 'facets' },
      ),
      type: RequestTypes.GET_LIST,
      requestCountData: RequestCountData.DATA_WITH_COUNT,
    });

    expect(result).toEqual({
      data: [{ id: 1 }],
      count: 4,
      total: 1,
      extra: { facets: { open: 3 } },
    });
  });

  test('an attachment is a Blob with its file name and Content-Disposition', async () => {
    const contentDisposition = "attachment; filename*=UTF-8''a%20b.txt";
    const result = await ResponseReader.read({
      response: new Response('content', {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': contentDisposition,
        },
      }),
      type: RequestTypes.SEND,
    });

    expect(result.data).toBeInstanceOf(Blob);
    expect(result.filename).toBe('a b.txt');
    expect(result.contentDisposition).toBe(contentDisposition);
  });

  test('a quoted and a bare file name are read, and none is not an error', async () => {
    const read = (contentDisposition: string) => {
      return ResponseReader.read({
        response: new Response('x', {
          headers: { 'content-type': 'text/plain', 'content-disposition': contentDisposition },
        }),
        type: RequestTypes.SEND,
      });
    };

    const result = await read('attachment; filename="q.csv"');
    expect(result.filename).toBe('q.csv');
    const result2 = await read('attachment; filename=bare.csv');
    expect(result2.filename).toBe('bare.csv');
    const result3 = await read('attachment');
    expect(result3.filename).toBeUndefined();
  });
});

describe('ResponseReader.convert', () => {
  const headers = new Headers();

  test('a row that is not a list becomes a list of one, with its own count as the total', () => {
    expect(
      ResponseReader.convert<unknown>({
        response: { data: { id: 1 }, headers },
        type: RequestTypes.GET_LIST,
      }),
    ).toEqual({ data: [{ id: 1 }], total: 1 });
  });

  test('a body that carries no count is refused when one is required', () => {
    for (const data of [null, 'text', [1]]) {
      expect(() =>
        ResponseReader.convert({
          response: { data, headers },
          type: RequestTypes.GET_LIST,
          requestCountData: RequestCountData.DATA_WITH_COUNT,
        }),
      ).toThrow('Invalid response format');
    }
  });

  test('another request type reads the count header, and a missing or bad one is no count', () => {
    const read = (count?: string) => {
      return ResponseReader.convert({
        response: {
          data: { ok: true },
          headers: new Headers(count ? { 'x-response-count': count } : {}),
        },
        type: RequestTypes.SEND,
      });
    };

    expect(read('7')).toEqual({ data: { ok: true }, count: 7 });
    expect(read()).toEqual({ data: { ok: true }, count: undefined });
    expect(read('abc')).toEqual({ data: { ok: true }, count: undefined });
  });
});

describe('ResponseReader.toError', () => {
  test('is an ApplicationError with the status, the server text and the request id', async () => {
    const error = await ResponseReader.toError({
      response: json(
        {
          error: {
            statusCode: 409,
            message: 'Order already paid',
            requestId: 'req-1',
            extra: { transaction: 'tx-9' },
          },
        },
        {},
        409,
      ),
    });

    expect(isApplicationError(error)).toBe(true);
    expect((error as { statusCode: number }).statusCode).toBe(409);
    expect(error.message).toBe('Order already paid');
    expect((error as { extra: unknown }).extra).toEqual({
      transaction: 'tx-9',
      requestId: 'req-1',
    });
  });

  test('a body that says nothing falls back to the HTTP status', async () => {
    const error = await ResponseReader.toError({ response: new Response('', { status: 503 }) });

    expect(error.message).toBe('HTTP 503');
  });

  test('names the root key the data source auth shares', () => {
    expect(ResponseReader.ERROR_ROOT_KEY).toBe('error');
  });
});
