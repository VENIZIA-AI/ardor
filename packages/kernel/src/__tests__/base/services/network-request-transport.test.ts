import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';

import { rejectionOf } from '@/__tests__/rejection';
import { DefaultNetworkRequestService } from '@/base/services/network-request';
import { RequestBodyTypes, RequestTypes } from '@/common';
import { Logger } from '@/helpers';

interface IRecorded {
  method: string;
  search: string;
  headers: Headers;
  bytes: Uint8Array;
}

const SECRET_TOKEN = 'Bearer SECRET-TOKEN-4f1c9a';
const SECRET_PASSWORD = 'hunter2-PASSWORD-7d2e';

let server: ReturnType<typeof Bun.serve>;
let baseUrl = '';
const recorded: IRecorded[] = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === '/delay') {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      recorded.push({
        method: request.method,
        search: url.search,
        headers: request.headers,
        bytes: new Uint8Array(await request.arrayBuffer()),
      });

      return Response.json({ ok: true });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

afterEach(() => {
  recorded.length = 0;
});

/** The transport DefaultNetworkRequestService sends through, as the service builds it. */
class TransportService extends DefaultNetworkRequestService {
  transport() {
    return this.networkRequest.getNetworkService();
  }
}

const createService = () =>
  new TransportService({ name: 'transport-test', baseUrl, noAuthPathRegex: /./ });

const createFetcher = (_opts: { name: string }) => createService().transport();

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('request log', () => {
  test('no Authorization value and no body reaches any console method, at any level', async () => {
    const service = createService();
    // The service logs through its own scope; the switch is process-wide.
    Logger.getInstance({ scope: 'DefaultNetworkRequestService', enableDebug: true });

    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      spyOn(console, method).mockImplementation(() => undefined),
    );

    try {
      const response = await service.doRequest({
        type: RequestTypes.SEND,
        method: 'POST',
        paths: ['echo'],
        headers: { Authorization: SECRET_TOKEN, 'content-type': 'application/json' },
        body: { username: 'admin', password: SECRET_PASSWORD },
      });
      expect(response.data).toBeDefined();

      const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
      expect(logged).not.toContain('SECRET-TOKEN-4f1c9a');
      expect(logged).not.toContain('hunter2-PASSWORD-7d2e');
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
      Logger.getInstance({ scope: 'DefaultNetworkRequestService', enableDebug: false });
    }

    // Redaction is for the log only: the server still received the real header and body.
    expect(recorded[0]!.headers.get('authorization')).toBe(SECRET_TOKEN);
    expect(decode(recorded[0]!.bytes)).toContain(SECRET_PASSWORD);
  });

  test('nothing about the request is written at info level', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-info-test' });
    const info = spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      await fetcher.send({ url: `${baseUrl}/echo`, method: 'get' });
      await createService().doRequest({
        type: RequestTypes.SEND,
        method: 'GET',
        paths: ['echo'],
      });
      expect(info).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
    }
  });
});

describe('abort signals', () => {
  test('a caller abort cancels the request even when a timeout is set', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-abort-test' });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const startedAt = Date.now();

    expect(
      await rejectionOf(
        fetcher.send({
          url: `${baseUrl}/delay`,
          method: 'get',
          timeout: 5000,
          signal: controller.signal,
        }),
      ),
    ).toBeDefined();

    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  test('a signal already aborted before the call rejects, with a timeout set', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-preaborted-test' });
    const controller = new AbortController();
    controller.abort();

    expect(
      await rejectionOf(
        fetcher.send({
          url: `${baseUrl}/echo`,
          method: 'get',
          timeout: 5000,
          signal: controller.signal,
        }),
      ),
    ).toBeDefined();
  });

  test('the timeout still aborts when the caller passes a signal that never fires', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-timeout-test' });
    const controller = new AbortController();
    const startedAt = Date.now();

    expect(
      await rejectionOf(
        fetcher.send({
          url: `${baseUrl}/delay`,
          method: 'get',
          timeout: 50,
          signal: controller.signal,
        }),
      ),
    ).toBeDefined();

    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  test('the timeout alone still aborts', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-timeout-only-test' });

    expect(
      await rejectionOf(fetcher.send({ url: `${baseUrl}/delay`, method: 'get', timeout: 50 })),
    ).toBeDefined();
  });
});

describe('NodeFetcher query string', () => {
  test('params join a url without a query with a question mark', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-query-test' });

    await fetcher.send({ url: `${baseUrl}/echo`, method: 'get', params: { a: 1, b: 'x' } });

    expect(recorded[0]!.search).toBe('?a=1&b=x');
  });

  test('params join a url that already has a query with an ampersand', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-query-existing-test' });

    await fetcher.send({ url: `${baseUrl}/echo?a=1`, method: 'get', params: { b: 2 } });

    expect(recorded[0]!.search).toBe('?a=1&b=2');
  });

  test('empty params leave the url exactly as given', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-query-empty-test' });

    await fetcher.send({ url: `${baseUrl}/echo?a=1`, method: 'get', params: {} });

    expect(recorded[0]!.search).toBe('?a=1');
  });
});

describe('NodeFetcher bodies', () => {
  test('a Blob is sent as its bytes, not as "{}"', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-blob-test' });

    await fetcher.send({
      url: `${baseUrl}/echo`,
      method: 'post',
      body: new Blob(['blob-content']),
    });

    expect(decode(recorded[0]!.bytes)).toBe('blob-content');
  });

  test('an ArrayBuffer and a typed array are sent as their bytes', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-buffer-test' });
    const bytes = new TextEncoder().encode('buffer-content');

    await fetcher.send({
      url: `${baseUrl}/echo`,
      method: 'post',
      body: bytes.buffer as ArrayBuffer,
    });
    await fetcher.send({ url: `${baseUrl}/echo`, method: 'post', body: bytes });

    expect(decode(recorded[0]!.bytes)).toBe('buffer-content');
    expect(decode(recorded[1]!.bytes)).toBe('buffer-content');
  });

  test('a string is sent as it is, not encoded a second time', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-string-test' });

    await fetcher.send({ url: `${baseUrl}/echo`, method: 'post', body: '{"already":"json"}' });

    expect(decode(recorded[0]!.bytes)).toBe('{"already":"json"}');
  });

  test('a plain object and an array are still JSON-encoded', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-json-test' });

    await fetcher.send({ url: `${baseUrl}/echo`, method: 'post', body: { a: 1 } as any });
    await fetcher.send({ url: `${baseUrl}/echo`, method: 'post', body: [1, 2] as any });

    expect(decode(recorded[0]!.bytes)).toBe('{"a":1}');
    expect(decode(recorded[1]!.bytes)).toBe('[1,2]');
  });

  test('FormData and URLSearchParams still pass through', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-form-test' });
    const form = new FormData();
    form.append('field', 'value');

    await fetcher.send({ url: `${baseUrl}/echo`, method: 'post', body: form });
    await fetcher.send({
      url: `${baseUrl}/echo`,
      method: 'post',
      body: new URLSearchParams({ q: '1' }),
    });

    expect(decode(recorded[0]!.bytes)).toContain('name="field"');
    expect(decode(recorded[1]!.bytes)).toBe('q=1');
  });

  test('no body sends none', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-nobody-test' });

    await fetcher.send({ url: `${baseUrl}/echo`, method: 'get' });

    expect(recorded[0]!.bytes.length).toBe(0);
  });
});

describe('what a request carries, through doRequest', () => {
  const info = { name: 'transport-test', version: '1.0.0', description: 'x' };

  test('a filter object is one JSON parameter, null and undefined are left out, a primitive array is one JSON parameter', async () => {
    await createService().doRequest({
      type: RequestTypes.GET_LIST,
      method: 'GET',
      paths: ['posts'],
      query: {
        filter: {
          where: { status: 'open', id: { inq: [1, 2] } },
          fields: ['id', 'name'],
          limit: 5,
        },
        ids: [1, 2],
        name: 'a b',
        skipped: undefined,
        nothing: null,
        page: 2,
      },
    });

    const params = new URLSearchParams(recorded[0]!.search);
    expect(JSON.parse(params.get('filter') ?? 'null')).toEqual({
      where: { status: 'open', id: { inq: [1, 2] } },
      fields: ['id', 'name'],
      limit: 5,
    });
    expect(params.getAll('ids')).toEqual(['[1,2]']);
    expect(params.get('name')).toBe('a b');
    expect(params.get('page')).toBe('2');
    expect(params.has('skipped')).toBe(false);
    expect(params.has('nothing')).toBe(false);
  });

  test('a multipart body reaches the server with a boundary, which fetch writes', async () => {
    const service = createService();
    const props = service.getRequestProps({
      resource: 'upload',
      bodyType: RequestBodyTypes.FORM_DATA,
      body: { name: 'a', file: new File(['content'], 'a.txt') },
      restDataProviderOptions: { url: baseUrl, noAuthPathRegex: /./ },
      applicationInfo: info,
    });

    await service.doRequest({
      type: RequestTypes.CREATE,
      method: 'POST',
      paths: ['upload'],
      ...props,
    });

    expect(recorded[0]!.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
    expect(decode(recorded[0]!.bytes)).toContain('name="file"; filename="a.txt"');
  });

  test('a JSON body is sent as JSON, and a GET sends no body', async () => {
    const service = createService();

    await service.doRequest({
      type: RequestTypes.CREATE,
      method: 'POST',
      paths: ['posts'],
      headers: { 'content-type': 'application/json' },
      body: { title: 'a' },
    });
    await service.doRequest({ type: RequestTypes.GET_ONE, method: 'GET', paths: ['posts', '1'] });

    expect(JSON.parse(decode(recorded[0]!.bytes))).toEqual({ title: 'a' });
    expect(recorded[1]!.bytes.length).toBe(0);
  });
});
