import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { RejectionUtility } from '@venizia/dev-configs/testing';
import { Container, isApplicationError } from '@venizia/ignis-inversion';
import {
  type IApplicationInfo,
  type IRestDataProviderOptions,
  NETWORK_TIMEOUT_CODE,
  RequestMethods,
} from '@venizia/ardor-kernel';
import type { GetListParams } from 'ra-core';

import { CountRestDataProvider } from '@/providers/count-rest-data';
import { DefaultRestDataProvider } from '@/providers/rest-data';

const SLOW_MS = 400;

const applicationInfo: IApplicationInfo = {
  name: 'ardor-abort-test',
  version: '1.0.0',
  description: 'ARDOR abort test application',
};

const nameOf = (error: unknown): string | undefined => {
  return error instanceof Error || error instanceof DOMException ? error.name : undefined;
};

const codeOf = (error: unknown): string | undefined => {
  return isApplicationError(error) ? error.normalized.code : undefined;
};

let server: ReturnType<typeof Bun.serve>;
let baseUrl = '';
const recordedFilters: Array<string | null> = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const url = new URL(req.url);
      recordedFilters.push(url.searchParams.get('filter'));

      if (url.pathname.startsWith('/slow')) {
        await Bun.sleep(SLOW_MS);
      }

      const isCollection = url.pathname.split('/').filter(Boolean).length === 1;

      return new Response(JSON.stringify(isCollection ? [{ id: 1 }] : { id: 1, count: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'content-range': 'items 0-0/1' },
      });
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

afterEach(() => {
  recordedFilters.length = 0;
});

const createDataProvider = (opts: { timeout?: IRestDataProviderOptions['timeout'] } = {}) => {
  const provider = new DefaultRestDataProvider(
    { url: baseUrl, noAuthPathRegex: /./, timeout: opts.timeout },
    applicationInfo,
  );

  return provider.value(new Container());
};

const abortSoon = (): AbortSignal => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);

  return controller.signal;
};

const listParams: Required<Pick<GetListParams, 'pagination' | 'sort' | 'filter'>> = {
  pagination: { page: 1, perPage: 10 },
  sort: { field: 'id', order: 'ASC' },
  filter: {},
};

describe('DefaultRestDataProvider, abort', () => {
  test('tells react-admin it takes an abort signal', () => {
    expect(createDataProvider().supportAbortSignal).toBe(true);
  });

  test('an aborted getList rejects with the abort, long before the server answers', async () => {
    const startedAt = performance.now();
    const signal = abortSoon();

    const error = await RejectionUtility.rejectionOf({
      task: createDataProvider().getList('slow', { ...listParams, signal }),
    });

    expect(nameOf(error)).toBe('AbortError');
    expect(error).toBe(signal.reason);
    expect(performance.now() - startedAt).toBeLessThan(SLOW_MS / 2);
  });

  test.each([
    {
      name: 'getOne',
      run: (signal: AbortSignal) => createDataProvider().getOne('slow', { id: 1, signal }),
    },
    {
      name: 'getMany',
      run: (signal: AbortSignal) => createDataProvider().getMany('slow', { ids: [1], signal }),
    },
    {
      name: 'getManyReference',
      run: (signal: AbortSignal) =>
        createDataProvider().getManyReference('slow', {
          ...listParams,
          target: 'authorId',
          id: 1,
          signal,
        }),
    },
    {
      name: 'send',
      run: (signal: AbortSignal) =>
        createDataProvider().send({
          resource: 'slow',
          params: { method: RequestMethods.GET, signal },
        }),
    },
  ])('$name rejects with the abort too', async ({ run }) => {
    const startedAt = performance.now();
    const error = await RejectionUtility.rejectionOf({ task: run(abortSoon()) });

    expect(nameOf(error)).toBe('AbortError');
    expect(performance.now() - startedAt).toBeLessThan(SLOW_MS / 2);
  });

  test('the signal is never sent as a filter key', async () => {
    const dataProvider = createDataProvider();
    const signal = new AbortController().signal;

    await dataProvider.getList('items', { ...listParams, signal });
    await dataProvider.getManyReference('items', {
      ...listParams,
      target: 'authorId',
      id: 1,
      signal,
    });

    expect(recordedFilters).toHaveLength(2);

    for (const filter of recordedFilters) {
      expect(filter).not.toBeNull();
      expect(Object.keys(JSON.parse(filter ?? '{}'))).not.toContain('signal');
    }
  });

  test('CountRestDataProvider aborts the count request with the list request', async () => {
    const provider = new CountRestDataProvider(
      { url: baseUrl, noAuthPathRegex: /./ },
      applicationInfo,
    );
    const dataProvider = provider.value(new Container());
    const doRequest = spyOn(provider.getNetworkService(), 'doRequest');
    const signal = new AbortController().signal;

    await dataProvider.getList('items', { ...listParams, signal });

    expect(doRequest).toHaveBeenCalledTimes(2);

    for (const [opts] of doRequest.mock.calls) {
      expect(opts.signal).toBe(signal);
    }
  });
});

describe('DefaultRestDataProvider, timeout', () => {
  test('a request that outlives the timeout rejects with the timeout code, naming the path', async () => {
    const startedAt = performance.now();
    const error = await RejectionUtility.rejectionOf({
      task: createDataProvider({ timeout: { use: true, milliseconds: 50 } }).getList(
        'slow',
        listParams,
      ),
    });

    expect(codeOf(error)).toBe(NETWORK_TIMEOUT_CODE);
    expect(isApplicationError(error) ? error.statusCode : undefined).toBe(504);
    expect(error instanceof Error ? error.message : '').toContain('slow');
    expect(performance.now() - startedAt).toBeLessThan(SLOW_MS / 2);
  });

  test('a user abort with a timeout on rejects with the abort, not the timeout code', async () => {
    const error = await RejectionUtility.rejectionOf({
      task: createDataProvider({ timeout: { use: true, milliseconds: 200 } }).getList('slow', {
        ...listParams,
        signal: abortSoon(),
      }),
    });

    expect(nameOf(error)).toBe('AbortError');
    expect(codeOf(error)).not.toBe(NETWORK_TIMEOUT_CODE);
  });

  test('a request that answers in time is unaffected', async () => {
    const result = await createDataProvider({ timeout: { use: true, milliseconds: 200 } }).getList(
      'items',
      listParams,
    );

    expect(result.data).toEqual([{ id: 1 }]);
  });

  test('an invalid milliseconds throws when the provider is built', () => {
    expect(
      () =>
        new DefaultRestDataProvider(
          { url: baseUrl, timeout: { use: true, milliseconds: 0 } },
          applicationInfo,
        ),
    ).toThrow('milliseconds');
  });
});
