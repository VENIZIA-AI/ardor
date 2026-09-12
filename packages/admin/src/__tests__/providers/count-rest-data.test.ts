import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { type IApplicationInfo, type IRestDataProviderOptions } from '@venizia/ardor-kernel';
import { getError } from '@venizia/ignis-inversion';
import { type RaRecord } from 'ra-core';
import { CountRestDataProvider } from '@/providers/count-rest-data';

class TestResources {
  public static readonly BOOKS = 'books';
  public static readonly ARTICLES = 'articles';
  public static readonly MAGAZINES = 'magazines';

  public static readonly SCHEME_SET = new Set<string>([
    TestResources.BOOKS,
    TestResources.ARTICLES,
    TestResources.MAGAZINES,
  ]);

  public static isValid(value: unknown): value is string {
    return typeof value === 'string' && TestResources.SCHEME_SET.has(value);
  }

  private constructor() {}
}

interface IRecordedRequest {
  readonly method: string;
  readonly pathname: string;
  readonly search: string;
  readonly headers: Headers;
  readonly body: unknown;
}

interface IBookRecord extends RaRecord {
  readonly id: string;
  readonly title: string;
  readonly status?: string;
}

interface IArticleRecord extends RaRecord {
  readonly id: string;
  readonly title: string;
  readonly archived?: boolean;
}

interface IMagazineRecord extends RaRecord {
  readonly id: string;
  readonly title: string;
  readonly category?: string;
}

const parseRequestBody = async (opts: { request: Request }): Promise<unknown> => {
  const { request } = opts;
  if (request.method === 'GET' || request.method === 'HEAD' || !request.body) {
    return null;
  }
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return null;
  }
  try {
    return await request.json();
  } catch (error) {
    console.error(error);
    return null;
  }
};

const createJsonResponse = (opts: { data: unknown; status?: number }): Response => {
  const { data, status = 200 } = opts;
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

const ensureFound = <T>(opts: { value: T | undefined; message: string }): T => {
  const { value, message } = opts;
  if (value === undefined) {
    throw getError({ message });
  }
  return value;
};

const createProvider = (opts: { baseUrl: string }): CountRestDataProvider => {
  const { baseUrl } = opts;
  const restDataProviderOptions: IRestDataProviderOptions = {
    url: baseUrl,
    useAuth: false,
  };
  const applicationInfo: IApplicationInfo = {
    name: 'test-ardor-application',
    version: '1.0.0',
    description: 'Test application for ARDOR count rest data provider',
  };
  return new CountRestDataProvider(restDataProviderOptions, applicationInfo);
};

describe('CountRestDataProvider getList', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = '';
  const recordedRequests: IRecordedRequest[] = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const body = await parseRequestBody({ request });
        recordedRequests.push({
          method: request.method,
          pathname: url.pathname,
          search: url.search,
          headers: request.headers,
          body,
        });

        if (url.pathname === `/${TestResources.BOOKS}/count`) {
          return createJsonResponse({ data: { count: 7 } });
        }

        if (url.pathname === `/${TestResources.BOOKS}`) {
          return createJsonResponse({
            data: [
              { id: '1', title: 'Refactoring' },
              { id: '2', title: 'Clean Architecture' },
            ],
          });
        }

        if (url.pathname === `/${TestResources.ARTICLES}/count`) {
          return createJsonResponse({ data: {} });
        }

        if (url.pathname === `/${TestResources.ARTICLES}`) {
          return createJsonResponse({
            data: [{ id: 'a-1', title: 'Domain-Driven Design', archived: false }],
          });
        }

        if (url.pathname === `/${TestResources.MAGAZINES}/count`) {
          return createJsonResponse({ data: { count: 42 } });
        }

        if (url.pathname === `/${TestResources.MAGAZINES}`) {
          return createJsonResponse({
            data: [{ id: 'm-1', title: 'Tech Monthly', category: 'technology' }],
          });
        }

        return new Response('Not Found', { status: 404 });
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.stop(true);
  });

  afterEach(() => {
    recordedRequests.length = 0;
  });

  test('issues two requests: GET /resource with filter and GET /resource/count carrying only where in filter, returning data and count', async () => {
    const provider = createProvider({ baseUrl });

    const result = await provider.getList<IBookRecord>({
      resource: TestResources.BOOKS,
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'title', order: 'ASC' },
        filter: {
          status: 'published',
          include: ['author'],
        },
        queryKey: [TestResources.BOOKS, 'getList'],
        meta: { tenantId: 'tenant-001' },
      },
    });

    expect(result.data).toEqual([
      { id: '1', title: 'Refactoring' },
      { id: '2', title: 'Clean Architecture' },
    ]);
    expect(result.total).toBe(7);

    expect(recordedRequests.length).toBe(2);

    const dataRequest = ensureFound({
      value: recordedRequests.find((entry) => {
        return entry.pathname === `/${TestResources.BOOKS}`;
      }),
      message: 'Expected data request to be recorded',
    });
    const countRequest = ensureFound({
      value: recordedRequests.find((entry) => {
        return entry.pathname === `/${TestResources.BOOKS}/count`;
      }),
      message: 'Expected count request to be recorded',
    });

    expect(dataRequest.method).toBe('GET');
    expect(countRequest.method).toBe('GET');

    const decodedDataSearch = decodeURIComponent(dataRequest.search);
    expect(decodedDataSearch).toContain('filter');
    expect(decodedDataSearch).toContain('status');
    expect(decodedDataSearch).toContain('published');

    const decodedCountSearch = decodeURIComponent(countRequest.search);
    expect(decodedCountSearch).toContain('where');
    expect(decodedCountSearch).toContain('status');
    expect(decodedCountSearch).toContain('published');
    expect(decodedCountSearch).not.toContain('include');
    expect(decodedCountSearch).not.toContain('order');
    expect(decodedCountSearch).not.toContain('limit');
    expect(decodedCountSearch).not.toContain('skip');
    expect(decodedCountSearch).not.toContain('offset');
  });

  test('returns total as 0 when count response has no count property', async () => {
    const provider = createProvider({ baseUrl });

    const result = await provider.getList<IArticleRecord>({
      resource: TestResources.ARTICLES,
      params: {
        pagination: { page: 1, perPage: 5 },
        sort: { field: 'id', order: 'DESC' },
        filter: { archived: false },
        queryKey: [TestResources.ARTICLES, 'getList'],
      },
    });

    expect(result.data).toEqual([{ id: 'a-1', title: 'Domain-Driven Design', archived: false }]);
    expect(result.total).toBe(0);

    expect(recordedRequests.length).toBe(2);

    const countRequest = ensureFound({
      value: recordedRequests.find((entry) => {
        return entry.pathname === `/${TestResources.ARTICLES}/count`;
      }),
      message: 'Expected count request to be recorded',
    });
    expect(countRequest.method).toBe('GET');
  });

  test('forwards existing filter where clause to count request and returns total from count', async () => {
    const provider = createProvider({ baseUrl });

    const result = await provider.getList<IMagazineRecord>({
      resource: TestResources.MAGAZINES,
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'title', order: 'ASC' },
        filter: {
          where: { category: 'technology' },
        },
        queryKey: [TestResources.MAGAZINES, 'getList'],
      },
    });

    expect(result.data).toEqual([{ id: 'm-1', title: 'Tech Monthly', category: 'technology' }]);
    expect(result.total).toBe(42);

    const countRequest = ensureFound({
      value: recordedRequests.find((entry) => {
        return entry.pathname === `/${TestResources.MAGAZINES}/count`;
      }),
      message: 'Expected count request to be recorded',
    });

    const decodedCountSearch = decodeURIComponent(countRequest.search);
    expect(decodedCountSearch).toContain('where');
    expect(decodedCountSearch).toContain('technology');
  });
});
