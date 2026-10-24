import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { RequestMethods, RequestTypes, type IApplicationInfo } from '@venizia/ardor-kernel';
import type { RaRecord } from 'ra-core';
import { CountRestDataProvider } from '@/providers/count-rest-data';
import { DefaultRestDataProvider } from '@/providers/rest-data';

interface IRecorded {
  method: string;
  pathname: string;
  query: Record<string, string>;
  headers: Headers;
  body: unknown;
}

class ExposedProvider extends DefaultRestDataProvider {
  public override request<TResult = unknown>(
    opts: Parameters<DefaultRestDataProvider['request']>[0],
  ) {
    return super.request<TResult>(opts);
  }

  public override requestList<TRecord extends RaRecord = RaRecord>(
    opts: Parameters<DefaultRestDataProvider['requestList']>[0],
  ) {
    return super.requestList<TRecord>(opts);
  }
}

const info: IApplicationInfo = { name: 'ardor-admin-test', version: '1.0.0', description: 'x' };

let server: ReturnType<typeof Bun.serve>;
let baseUrl = '';
const recorded: IRecorded[] = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const url = new URL(req.url);
      const text = req.method === 'GET' ? '' : await req.text();
      recorded.push({
        method: req.method,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: req.headers,
        body: text ? JSON.parse(text) : undefined,
      });

      if (url.pathname === '/posts/count') {
        return Response.json({ count: 7 });
      }

      if (req.method === 'GET' && req.headers.has('x-request-extra')) {
        return Response.json(
          { data: [{ id: 1 }], extra: { facets: { open: 3 } } },
          { headers: { 'x-response-extra': 'facets' } },
        );
      }

      return Response.json(req.method === 'GET' ? [{ id: 1 }] : { ok: true });
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

afterEach(() => {
  recorded.length = 0;
});

const create = () => new ExposedProvider({ url: baseUrl, noAuthPathRegex: /./ }, info);

describe('request', () => {
  test('sends the method, the path, the query and the JSON body, and answers the data', async () => {
    const result = await create().request<{ ok: boolean }>({
      resource: 'posts',
      type: RequestTypes.CREATE,
      method: RequestMethods.POST,
      body: { title: 'a' },
      query: { locale: 'vi' },
    });

    expect(result.data).toEqual({ ok: true });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].method).toBe('POST');
    expect(recorded[0].pathname).toBe('/posts');
    expect(recorded[0].query).toEqual({ locale: 'vi' });
    expect(recorded[0].body).toEqual({ title: 'a' });
  });

  test('paths default to the resource, and an explicit list is used as it is', async () => {
    const provider = create();

    await provider.request({
      resource: 'posts',
      type: RequestTypes.GET_ONE,
      method: RequestMethods.GET,
      paths: ['posts', '7'],
    });
    await provider.request({
      resource: 'posts',
      type: RequestTypes.GET_MANY,
      method: RequestMethods.GET,
    });

    expect(recorded.map((r) => r.pathname)).toEqual(['/posts/7', '/posts']);
  });

  test('sends the tracing headers, and the list extras in x-request-extra', async () => {
    await create().request({
      resource: 'posts',
      type: RequestTypes.GET_LIST,
      method: RequestMethods.GET,
      extra: { facets: ['status'] } as never,
    });

    expect(recorded[0].headers.get('x-request-channel')).toBe('100_WEB');
    expect(recorded[0].headers.get('x-request-id')).toContain('ardor-admin-test');
    expect(recorded[0].headers.has('x-request-extra')).toBe(true);
  });

  test('a header the caller names wins over the computed one', async () => {
    await create().request({
      resource: 'posts',
      type: RequestTypes.SEND,
      method: RequestMethods.GET,
      headers: { 'x-request-channel': 'custom', 'x-tenant': 't1' },
    });

    expect(recorded[0].headers.get('x-request-channel')).toBe('custom');
    expect(recorded[0].headers.get('x-tenant')).toBe('t1');
  });
});

describe('requestList', () => {
  test('is a GET with the filter in the query, and no meta without extras', async () => {
    const result = await create().requestList({
      resource: 'posts',
      type: RequestTypes.GET_LIST,
      queryKey: { tenant: 't1' },
      filter: { where: { status: 'open' }, limit: 5 },
    });

    expect(recorded[0].method).toBe('GET');
    expect(recorded[0].query.tenant).toBe('t1');
    expect(JSON.parse(recorded[0].query.filter)).toEqual({ where: { status: 'open' }, limit: 5 });
    expect(result.data).toEqual([{ id: 1 }]);
    expect('meta' in result).toBe(false);
  });

  test('hands the extras a route answered to react-admin as meta.extra', async () => {
    const result = await create().requestList({
      resource: 'posts',
      type: RequestTypes.GET_LIST,
      queryKey: {},
      filter: { where: {} },
      extra: { facets: ['status'] } as never,
    });

    expect((result as { meta?: unknown }).meta).toEqual({ extra: { facets: { open: 3 } } });
  });

  test('getListHelper is gone: the hook is requestList', () => {
    expect('getListHelper' in create()).toBe(false);
    expect(typeof create().requestList).toBe('function');
  });
});

describe('CountRestDataProvider.requestList', () => {
  test('reads the total from /count, which gets no list extras and its own tracing id', async () => {
    const provider = new CountRestDataProvider({ url: baseUrl, noAuthPathRegex: /./ }, info);

    const result = await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 1, perPage: 5 },
        sort: { field: 'id', order: 'ASC' },
        filter: { status: 'open' },
        meta: { extra: { facets: ['status'] } },
      } as never,
    });

    expect(result.total).toBe(7);
    expect(result.meta).toEqual({ extra: { facets: { open: 3 } } });

    const list = recorded.find((r) => r.pathname === '/posts');
    const count = recorded.find((r) => r.pathname === '/posts/count');
    expect(list?.headers.has('x-request-extra')).toBe(true);
    expect(count?.headers.has('x-request-extra')).toBe(false);
    expect(JSON.parse(count?.query.where ?? 'null')).toEqual({ status: 'open' });
    expect(count?.headers.get('x-request-id')).not.toBe(list?.headers.get('x-request-id'));
  });
});
