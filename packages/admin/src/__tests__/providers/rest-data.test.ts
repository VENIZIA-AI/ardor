import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { Container } from '@venizia/ignis-inversion';
import {
  RequestBodyTypes,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type IApplicationInfo,
  type IRestDataProviderOptions,
} from '@venizia/ardor-kernel';
import { DefaultRestDataProvider } from '@/providers/rest-data';

interface IRecordedRequest {
  method: string;
  pathname: string;
  query: Record<string, string>;
  headers: Headers;
  body: unknown;
}

const isRecord = (opts: { value: unknown }): opts is { value: Record<string, unknown> } => {
  const { value } = opts;
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseFilterQuery = (opts: { raw?: string }): Record<string, unknown> => {
  const { raw } = opts;
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const check = { value: parsed };
    if (isRecord(check)) {
      return check.value;
    }
  } catch (err) {
    console.error(err);
  }
  return {};
};

const createProvider = (opts: { baseUrl: string }): DefaultRestDataProvider => {
  const { baseUrl } = opts;
  const restDataProviderOptions: IRestDataProviderOptions = {
    url: baseUrl,
    useAuth: false,
  };
  const applicationInfo: IApplicationInfo = {
    name: 'ardor-admin-test',
    version: '1.0.0',
    description: 'ARDOR test application',
  };
  return new DefaultRestDataProvider(restDataProviderOptions, applicationInfo);
};

let server: ReturnType<typeof Bun.serve>;
let baseUrl = '';
const recordedRequests: IRecordedRequest[] = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const url = new URL(req.url);
      let body: unknown = undefined;
      const contentType = req.headers.get('content-type') ?? '';

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (contentType.includes('application/json')) {
          try {
            const text = await req.text();
            if (text.length > 0) {
              body = JSON.parse(text);
            }
          } catch (err) {
            console.error(err);
          }
        } else if (
          contentType.includes('multipart/form-data') ||
          contentType.includes('application/x-www-form-urlencoded')
        ) {
          try {
            const formData = await req.formData();
            const entries: Record<string, unknown> = {};
            formData.forEach((value, key) => {
              entries[key] = value;
            });
            body = entries;
          } catch (err) {
            console.error(err);
          }
        } else {
          try {
            const text = await req.text();
            if (text.length > 0) {
              body = text;
            }
          } catch (err) {
            console.error(err);
          }
        }
      }

      recordedRequests.push({
        method: req.method,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: req.headers,
        body,
      });

      const segments = url.pathname.split('/').filter((segment) => {
        return segment.length > 0;
      });
      const isCollectionGet = req.method === 'GET' && segments.length === 1;

      // A bulk write on the collection answers the rows it touched, as an IGNIS bulk route does with
      // `x-request-count: 0`. One row, whatever was asked, so a result built from the requested ids
      // rather than the reported rows is caught.
      const isCollectionWrite =
        (req.method === 'PATCH' || req.method === 'DELETE') && segments.length === 1;

      if (isCollectionWrite) {
        return new Response(JSON.stringify([{ id: 1, status: 'archived' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (isCollectionGet) {
        return new Response(JSON.stringify([{ id: 1 }]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-range': 'items 0-0/42',
          },
        });
      }

      return new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
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

describe('getList behavior', () => {
  test('sends filter.limit, filter.skip, and filter.offset based on pagination', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 2, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.pathname).toBe('/posts');

    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['limit']).toBe(10);
    expect(filter['skip']).toBe(10);
    expect(filter['offset']).toBe(10);
  });

  test('sends filter.order as array based on sort params', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'name', order: 'DESC' },
        filter: {},
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['order']).toEqual(['name DESC']);
  });

  test('forwards an extra param whose value is falsy but meant', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
        // Not pagination, sort, filter or meta - so these land in `rest` and are forwarded.
        archived: false,
        revision: 0,
        note: '',
        omitted: undefined,
      } as never,
    });

    expect(recordedRequests.length).toBe(1);
    const filter = parseFilterQuery({ raw: recordedRequests[0].query['filter'] });

    // A falsy value is a value: dropping it sends a different query than the caller wrote.
    expect(filter['archived']).toBe(false);
    expect(filter['revision']).toBe(0);
    expect(filter['note']).toBe('');
    expect('omitted' in filter).toBe(false);
  });

  test('wraps filter without where into where and lifts include and fields to filter root', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {
          title: 'ARDOR Architecture',
          status: 'published',
          include: ['author', 'tags'],
          fields: ['id', 'title'],
        },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['where']).toEqual({
      title: 'ARDOR Architecture',
      status: 'published',
    });
    expect(filter['include']).toEqual(['author', 'tags']);
    expect(filter['fields']).toEqual(['id', 'title']);
  });

  test('omits limit, skip, and offset when noLimit is true', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {
          noLimit: true,
        },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['limit']).toBeUndefined();
    expect(filter['skip']).toBeUndefined();
    expect(filter['offset']).toBeUndefined();
    expect(filter['noLimit']).toBeUndefined();
  });

  test('promotes filter.params and meta keys to top-level query parameters', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {
          title: 'IGNIS Inversion',
          params: { tenantKey: 'tenant-primary' },
        },
        meta: {
          viewMode: 'detailed',
        },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.query['tenantKey']).toBe('tenant-primary');
    expect(req.query['viewMode']).toBe('detailed');

    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['params']).toBeUndefined();
    expect(filter['tenantKey']).toBeUndefined();
    expect(filter['viewMode']).toBeUndefined();
  });

  test('resolves total count parsed from content-range response header', async () => {
    const provider = createProvider({ baseUrl });
    const result = await provider.getList({
      resource: 'posts',
      params: {
        pagination: { page: 1, perPage: 10 },
        sort: { field: 'id', order: 'ASC' },
        filter: {},
      },
    });

    expect(result.total).toBe(42);
    expect(result.data).toEqual([{ id: 1 }]);
  });
});

describe('getOne behavior', () => {
  test('requests resource by id and forwards meta.filter without params as query', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getOne({
      resource: 'posts',
      params: {
        id: 77,
        meta: {
          filter: {
            include: ['comments'],
            params: { locale: 'en-US' },
          },
        },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('GET');
    expect(req.pathname).toBe('/posts/77');
    expect(req.query['locale']).toBe('en-US');

    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['include']).toEqual(['comments']);
    expect(filter['params']).toBeUndefined();
  });
});

describe('getMany behavior', () => {
  test('sends where.id with inq merged over meta.filter.where', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getMany({
      resource: 'posts',
      params: {
        ids: [101, 102, 103],
        meta: {
          filter: {
            where: { isPublished: true },
            params: { scope: 'workspace' },
          },
        },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('GET');
    expect(req.pathname).toBe('/posts');
    expect(req.query['scope']).toBe('workspace');

    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['where']).toEqual({
      isPublished: true,
      id: { inq: [101, 102, 103] },
    });
    expect(filter['params']).toBeUndefined();
  });
});

describe('getManyReference behavior', () => {
  test('sets target reference id in where clause and applies pagination', async () => {
    const provider = createProvider({ baseUrl });
    await provider.getManyReference({
      resource: 'comments',
      params: {
        target: 'postId',
        id: 999,
        pagination: { page: 3, perPage: 5 },
        sort: { field: 'createdAt', order: 'DESC' },
        filter: {
          isApproved: true,
        },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('GET');
    expect(req.pathname).toBe('/comments');

    const filter = parseFilterQuery({ raw: req.query['filter'] });
    expect(filter['where']).toEqual({
      isApproved: true,
      postId: 999,
    });
    expect(filter['limit']).toBe(5);
    expect(filter['skip']).toBe(10);
    expect(filter['offset']).toBe(10);
    expect(filter['order']).toEqual(['createdAt DESC']);
  });
});

describe('mutation operations behavior', () => {
  test('create posts record body to resource path', async () => {
    const provider = createProvider({ baseUrl });
    await provider.create({
      resource: 'posts',
      params: {
        data: { title: 'New Article', content: 'ARDOR content' },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('POST');
    expect(req.pathname).toBe('/posts');
    expect(req.body).toEqual({ title: 'New Article', content: 'ARDOR content' });
  });

  test('update patches resource by id with record body', async () => {
    const provider = createProvider({ baseUrl });
    await provider.update({
      resource: 'posts',
      params: {
        id: 456,
        data: { title: 'Patched Title' },
        previousData: { id: 456, title: 'Original' },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('PATCH');
    expect(req.pathname).toBe('/posts/456');
    expect(req.body).toEqual({ title: 'Patched Title' });
  });

  test('updateMany sends one bulk patch with the id selector in the body', async () => {
    const provider = createProvider({ baseUrl });
    await provider.updateMany({
      resource: 'posts',
      params: {
        ids: [11, 22, 33],
        data: { status: 'archived' },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('PATCH');
    expect(req.pathname).toBe('/posts');
    expect(req.body).toEqual({ status: 'archived', where: { id: { inq: [11, 22, 33] } } });
    // Never both: the route answers 400 when `where` arrives in the query AND the body.
    expect(req.query).toEqual({});
  });

  /**
   * The reason the selector moved. In the query, 400 UUIDs drew a 431 from an IGNIS server and a
   * proxy with 8k buffers refuses near 170; in the body the request line stays the resource path.
   */
  test('updateMany keeps a 2000-id selector off the request line', async () => {
    const provider = createProvider({ baseUrl });
    const ids = Array.from({ length: 2000 }, () => crypto.randomUUID());

    await provider.updateMany({ resource: 'posts', params: { ids, data: { status: 'archived' } } });

    expect(recordedRequests.length).toBe(1);
    expect(recordedRequests[0].query).toEqual({});
    expect(recordedRequests[0].body).toMatchObject({ where: { id: { inq: ids } } });
  });

  /**
   * react-admin's bulk results carry ids, and `data` may be absent. A body that is not a row array -
   * a hand-written route answering `{ count }` - gives no ids to report, so none are claimed.
   */
  test('updateMany and deleteMany leave data out when the body is not a row array', async () => {
    const counting = Bun.serve({ port: 0, fetch: () => Response.json({ count: 2 }) });

    try {
      const provider = createProvider({ baseUrl: `http://127.0.0.1:${counting.port}` });

      const updated = await provider.updateMany({
        resource: 'posts',
        params: { ids: [1, 2], data: { status: 'archived' } },
      });
      const deleted = await provider.deleteMany({ resource: 'posts', params: { ids: [1, 2] } });

      expect(updated).toEqual({ data: undefined });
      expect(deleted).toEqual({ data: undefined });
    } finally {
      await counting.stop(true);
    }
  });

  test('updateMany refuses data that carries its own where field', () => {
    const provider = createProvider({ baseUrl });

    expect(() => {
      return provider.updateMany({
        resource: 'posts',
        params: { ids: [1], data: { where: 'north gate' } },
      });
    }).toThrow(/"where" field.*row selector/);
    expect(recordedRequests.length).toBe(0);
  });

  test('updateMany throws error when ids array is empty', async () => {
    const provider = createProvider({ baseUrl });
    expect(() => {
      return provider.updateMany({
        resource: 'posts',
        params: {
          ids: [],
          data: { status: 'archived' },
        },
      });
    }).toThrow('[updateMany] No IDs to execute update!');
  });

  test('delete sends delete request to resource by id', async () => {
    const provider = createProvider({ baseUrl });
    await provider.delete({
      resource: 'posts',
      params: {
        id: 555,
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('DELETE');
    expect(req.pathname).toBe('/posts/555');
  });

  // One request, not one per id: the fan-out was not atomic, and a failure part-way reported one
  // error after the other deletes had already landed.
  test('deleteMany sends one bulk delete with the id selector in the body', async () => {
    const provider = createProvider({ baseUrl });
    await provider.deleteMany({
      resource: 'posts',
      params: {
        ids: [201, 202, 203],
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('DELETE');
    expect(req.pathname).toBe('/posts');
    expect(req.body).toEqual({ where: { id: { inq: [201, 202, 203] } } });
    expect(req.query).toEqual({});
  });

  test('deleteMany throws error when ids array is empty', async () => {
    const provider = createProvider({ baseUrl });
    expect(() => {
      return provider.deleteMany({
        resource: 'posts',
        params: {
          ids: [],
        },
      });
    }).toThrow('[deleteMany] No IDs to execute delete!');
  });
});

describe('send behavior', () => {
  test('forwards method, body, query, headers, and requestCountData with default requestType', async () => {
    const provider = createProvider({ baseUrl });
    const networkService = provider.getNetworkService();
    const doRequestSpy = spyOn(networkService, 'doRequest');

    await provider.send({
      resource: 'analytics',
      params: {
        method: RequestMethods.POST,
        query: { timeframe: 'monthly' },
        headers: { 'x-client-platform': 'ardor-web' },
        requestCountData: RequestCountData.DATA_ONLY,
        body: { metrics: ['views', 'clicks'] },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.method).toBe('POST');
    expect(req.pathname).toBe('/analytics');
    expect(req.query['timeframe']).toBe('monthly');
    expect(req.headers.get('x-client-platform')).toBe('ardor-web');
    expect(req.headers.get('x-request-count')).toBe(RequestCountData.DATA_ONLY);
    expect(req.body).toEqual({ metrics: ['views', 'clicks'] });

    expect(doRequestSpy).toHaveBeenCalled();
    const firstCallArgs = doRequestSpy.mock.calls[0][0];
    expect(firstCallArgs.type).toBe(RequestTypes.SEND);
  });

  test('forwards form-url-encoded bodyType correctly', async () => {
    const provider = createProvider({ baseUrl });
    await provider.send({
      resource: 'oauth/token',
      params: {
        method: RequestMethods.POST,
        bodyType: RequestBodyTypes.FORM_URL_ENCODED,
        body: { ['grant_type']: 'password', username: 'ardor-admin' },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    expect(req.body).toEqual({ ['grant_type']: 'password', username: 'ardor-admin' });
  });

  test('throws error when method is missing', async () => {
    const provider = createProvider({ baseUrl });
    expect(() => {
      return provider.send({
        resource: 'invalid',
        params: {},
      });
    }).toThrow('[send] Invalid http method to send request!');
  });
});

describe('react-admin provider adapter behavior', () => {
  test('returns adapter with positional react-admin signatures and matching network service', async () => {
    const provider = createProvider({ baseUrl });
    const container = new Container();
    const dataProvider = provider.value(container);

    expect(dataProvider.getNetworkService()).toBe(provider.getNetworkService());

    const listResult = await dataProvider.getList('posts', {
      pagination: { page: 1, perPage: 10 },
      sort: { field: 'id', order: 'ASC' },
      filter: {},
    });
    expect(listResult.data).toEqual([{ id: 1 }]);
    expect(listResult.total).toBe(42);

    const oneResult = await dataProvider.getOne('posts', { id: 300 });
    expect(oneResult.data).toEqual({ id: 1 });

    const createResult = await dataProvider.create('posts', {
      data: { title: 'Created via adapter' },
    });
    expect(createResult.data).toEqual({ id: 1 });

    const updateResult = await dataProvider.update('posts', {
      id: 300,
      data: { title: 'Patched via adapter' },
      previousData: { id: 300 },
    });
    expect(updateResult.data).toEqual({ id: 1 });

    const updateManyResult = await dataProvider.updateMany('posts', {
      ids: [1, 2],
      data: { status: 'adapter-active' },
    });
    // Asked for 1 and 2; the server reports touching 1. The result is what was written.
    expect(updateManyResult.data).toEqual([1]);

    const deleteResult = await dataProvider.delete('posts', { id: 300 });
    expect(deleteResult.data).toEqual({ id: 1 });

    const deleteManyResult = await dataProvider.deleteMany('posts', { ids: [1, 2] });
    expect(deleteManyResult.data).toEqual([1]);
  });

  test('forwards send options object through provider adapter', async () => {
    const provider = createProvider({ baseUrl });
    const container = new Container();
    const dataProvider = provider.value(container);

    const sendResult = await dataProvider.send({
      resource: 'health-check',
      params: { method: RequestMethods.GET },
    });

    expect(sendResult.data).toEqual([{ id: 1 }]);
    expect(recordedRequests.length).toBe(1);
    expect(recordedRequests[0].pathname).toBe('/health-check');
  });
});

describe('network service header configuration behavior', () => {
  test('includes newly set headers on subsequent requests', async () => {
    const provider = createProvider({ baseUrl });
    provider.getNetworkService().setHeaders({
      'x-tenant-id': 'tenant-ignis-001',
    });

    await provider.getOne({
      resource: 'posts',
      params: { id: 888 },
    });

    expect(recordedRequests.length).toBe(1);
    const req = recordedRequests[0];
    expect(req.headers.get('x-tenant-id')).toBe('tenant-ignis-001');
  });
});
