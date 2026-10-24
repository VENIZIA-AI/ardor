import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';

import { rejectionOf } from '@/__tests__/rejection';
import { Logger } from '@/helpers/logger';
import { NodeFetcher } from '@/helpers/networks/fetchers/node-fetch';

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
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      recorded.push({
        method: request.method,
        search: url.search,
        headers: request.headers,
        bytes: new Uint8Array(await request.arrayBuffer()),
      });

      return new Response('ok');
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

const createFetcher = (opts: { name: string }) =>
  new NodeFetcher({ name: opts.name, defaultConfigs: {} });

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('NodeFetcher logging', () => {
  test('no Authorization value and no body reaches any console method, at any level', async () => {
    const fetcher = createFetcher({ name: 'node-fetch-log-test' });
    Logger.getInstance({ scope: 'node-fetch-log-test', enableDebug: true });

    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method =>
      spyOn(console, method).mockImplementation(() => undefined),
    );

    try {
      const rs = await fetcher.send({
        url: `${baseUrl}/echo`,
        method: 'post',
        headers: { Authorization: SECRET_TOKEN, 'content-type': 'application/json' },
        body: { username: 'admin', password: SECRET_PASSWORD } as any,
      });
      expect(rs.status).toBe(200);

      const logged = JSON.stringify(spies.flatMap(spy => spy.mock.calls));
      expect(logged).not.toContain('SECRET-TOKEN-4f1c9a');
      expect(logged).not.toContain('hunter2-PASSWORD-7d2e');
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
      Logger.getInstance({ scope: 'node-fetch-log-test', enableDebug: false });
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
      expect(info).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
    }
  });
});

describe('NodeFetcher abort signals', () => {
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
