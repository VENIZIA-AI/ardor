import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { IApplicationInfo, IRestDataProviderOptions } from '@venizia/ardor-kernel';

import { rejectionOf } from '@/__tests__/rejection';
import { CountRestDataProvider } from '@/providers/count-rest-data';
import { DefaultRestDataProvider } from '@/providers/rest-data';

const applicationInfo: IApplicationInfo = {
  name: 'ardor-admin-failure-test',
  version: '1.0.0',
  description: 'ARDOR test application',
};

const restDataProviderOptions = (opts: { baseUrl: string }): IRestDataProviderOptions => {
  return { url: opts.baseUrl, noAuthPathRegex: /./ };
};

const METHODS = [
  'getList',
  'getOne',
  'getMany',
  'getManyReference',
  'create',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'send',
] as const;

describe('DefaultRestDataProvider failures', () => {
  test.each(METHODS)(
    '%s rejects instead of throwing when its params are unusable',
    async (method) => {
      const provider = new DefaultRestDataProvider(
        restDataProviderOptions({ baseUrl: 'http://127.0.0.1:1' }),
        applicationInfo,
      );
      let task: unknown;

      try {
        task = (provider[method] as (opts: unknown) => unknown)({
          resource: 'posts',
          params: undefined,
        });
      } catch (error) {
        throw new Error(`${method} threw synchronously`, { cause: error });
      }

      expect(task).toBeInstanceOf(Promise);
      const result = await rejectionOf(task as Promise<unknown>);
      expect(result).toBeDefined();
    },
  );
});

describe('CountRestDataProvider list extras', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = '';
  const requests: Array<{ pathname: string; headers: Headers }> = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: (request) => {
        const url = new URL(request.url);
        requests.push({ pathname: url.pathname, headers: request.headers });

        if (url.pathname === '/posts/count') {
          return Response.json({ count: 7 });
        }

        if (request.headers.has('x-request-extra')) {
          return new Response(
            JSON.stringify({ data: [{ id: 1 }], extra: { facets: { status: { open: 3 } } } }),
            {
              headers: { 'content-type': 'application/json', 'x-response-extra': 'facets' },
            },
          );
        }

        return Response.json([{ id: 1 }]);
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.stop(true);
  });

  afterEach(() => {
    requests.length = 0;
  });

  const listParams = (meta?: Record<string, unknown>) => ({
    pagination: { page: 1, perPage: 10 },
    sort: { field: 'id', order: 'ASC' as const },
    filter: {},
    ...(meta ? { meta } : {}),
  });

  test('keeps the extra the list route answered as meta.extra, beside the total', async () => {
    const provider = new CountRestDataProvider(
      restDataProviderOptions({ baseUrl }),
      applicationInfo,
    );

    const result = await provider.getList({
      resource: 'posts',
      params: listParams({ extra: { facets: ['status'] } }),
    });

    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.total).toBe(7);
    expect(result.meta).toEqual({ extra: { facets: { status: { open: 3 } } } });
  });

  test('asks the list route for the extra but not the /count route', async () => {
    const provider = new CountRestDataProvider(
      restDataProviderOptions({ baseUrl }),
      applicationInfo,
    );

    await provider.getList({
      resource: 'posts',
      params: listParams({ extra: { facets: ['status'] } }),
    });

    const list = requests.find((entry) => entry.pathname === '/posts');
    const count = requests.find((entry) => entry.pathname === '/posts/count');

    expect(list?.headers.has('x-request-extra')).toBe(true);
    expect(count).toBeDefined();
    expect(count?.headers.has('x-request-extra')).toBe(false);
  });

  test('without an extra the result has no meta and nothing is asked', async () => {
    const provider = new CountRestDataProvider(
      restDataProviderOptions({ baseUrl }),
      applicationInfo,
    );

    const result = await provider.getList({ resource: 'posts', params: listParams() });

    expect(result.total).toBe(7);
    expect(result.meta).toBeUndefined();
    expect(requests.every((entry) => !entry.headers.has('x-request-extra'))).toBe(true);
  });
});
