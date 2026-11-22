import { HTTP } from '@venizia/ignis-helpers/common';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';

import { RejectionUtility } from '@venizia/dev-configs/testing';
import { HttpDataSource } from '@venizia/ignis-connectors/http';
import { isApplicationError } from '@venizia/ignis-inversion';

import { DefaultNetworkRequestService } from '@/base/services/network-request';
import { type IAuthTokenRecord, RequestMethods, RequestTypes } from '@/common';

/**
 * The second HTTP client of ARDOR, IGNIS \`HttpDataSource\` spread with \`getDataSourceAuth()\`, next to
 * \`doRequest\`, on the same server. A case where the two agree asserts that they do; each difference the
 * docs name has a test of its own, so a change of either side shows here.
 */

interface IRecorded {
  method: string;
  pathname: string;
  params: URLSearchParams;
  headers: Record<string, string>;
  body: string;
}

let server: ReturnType<typeof Bun.serve>;
let baseUrl = '';
let respond: () => Response = () => Response.json({ data: 'ok' });
const recorded: IRecorded[] = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const body = await req.text();
      recorded.push({
        method: req.method,
        pathname: url.pathname,
        params: url.searchParams,
        headers: Object.fromEntries(req.headers),
        body,
      });

      return respond();
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

afterEach(() => {
  recorded.length = 0;
  respond = () => Response.json({ data: 'ok' });
});

class TokenService extends DefaultNetworkRequestService {
  token?: IAuthTokenRecord;

  protected override resolveAuthToken(): IAuthTokenRecord | undefined {
    return this.token;
  }
}

const createClients = (opts: { token?: IAuthTokenRecord } = {}) => {
  const service = new TokenService({
    name: 'two-clients',
    baseUrl,
    noAuthPathRegex: opts.token ? undefined : /./,
  });
  service.token = opts.token;
  const source = new HttpDataSource({
    name: 'two-clients-source',
    baseUrl,
    ...service.getDataSourceAuth(),
  });

  return { service, source };
};

const requestCount = () => recorded.length;

describe('where the two clients agree', () => {
  test('a token goes out as the same authorization header', async () => {
    const { service, source } = createClients({
      token: { value: 'tok-1', type: 'Bearer', provider: 'oidc' },
    });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      headers: service.getRequestHeader({ resource: 'items' }),
    });
    await source.request({ paths: ['items'], method: 'GET' });

    const [viaService, viaSource] = recorded;
    expect(viaService.headers[HTTP.Headers.AUTHORIZATION]).toBe('Bearer tok-1');
    expect(viaSource.headers[HTTP.Headers.AUTHORIZATION]).toBe('Bearer tok-1');
    expect(viaSource.headers['x-auth-provider']).toBe(viaService.headers['x-auth-provider']);
  });

  test('a JSON body travels as the same text', async () => {
    const { service, source } = createClients();

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.POST,
      type: RequestTypes.CREATE,
      body: { name: 'a', tags: [1, 2] },
    });
    await source.request({ paths: ['items'], method: 'POST', body: { name: 'a', tags: [1, 2] } });

    expect(recorded[1].body).toBe(recorded[0].body);
  });

  test('a filter object travels as the same JSON in the query', async () => {
    const { service, source } = createClients();
    const filter = { where: { status: 'open' }, limit: 5, skip: 10 };

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_LIST,
      query: { filter },
    });
    await source.request({ paths: ['items'], method: 'GET', query: { filter } });

    expect(recorded[1].params.get('filter')).toBe(recorded[0].params.get('filter'));
    expect(recorded[0].params.get('filter')).toBe(JSON.stringify(filter));
  });

  test('a JSON answer is read as the same value', async () => {
    const { service, source } = createClients();
    respond = () => Response.json({ id: 7, title: 'x' });

    const viaService = await service.doRequest({
      paths: ['items', '7'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
    });
    const result = await source.request({ paths: ['items', '7'], method: 'GET' });
    const viaSource = await result.json();

    expect(viaSource).toEqual(viaService.data);
  });

  test('an error of the server is the same ApplicationError', async () => {
    const { service, source } = createClients();
    respond = () =>
      Response.json(
        {
          error: {
            statusCode: 404,
            message: 'No such item',
            normalized: { text: 'No such item', code: 'app.items.missing' },
          },
        },
        { status: 404 },
      );

    const viaService = await RejectionUtility.rejectionOf({
      task: service.doRequest({
        paths: ['items', '9'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_ONE,
      }),
    });
    const viaSource = await RejectionUtility.rejectionOf({
      task: source.read({ paths: ['items', '9'] }),
    });

    expect(isApplicationError(viaService) && isApplicationError(viaSource)).toBe(true);
    expect(viaSource).toMatchObject({
      statusCode: 404,
      normalized: { text: 'No such item', code: 'app.items.missing' },
    });
    expect(viaService).toMatchObject({
      statusCode: 404,
      normalized: { text: 'No such item', code: 'app.items.missing' },
    });
  });
});

describe('where the two clients differ, as the docs say', () => {
  test('a null query value: both clients leave it out', async () => {
    const { service, source } = createClients();

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      query: { a: null, b: 'x' },
    });
    await source.request({ paths: ['items'], method: 'GET', query: { a: null, b: 'x' } });

    expect(recorded[0].params.has('a')).toBe(false);
    expect(recorded[1].params.has('a')).toBe(false);
  });

  test('a list of numbers: doRequest sends one JSON parameter, the data source repeats the key', async () => {
    const { service, source } = createClients();

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      query: { ids: [1, 2] },
    });
    await source.request({ paths: ['items'], method: 'GET', query: { ids: [1, 2] } });

    expect(recorded[0].params.getAll('ids')).toEqual(['[1,2]']);
    expect(recorded[1].params.getAll('ids')).toEqual(['1', '2']);
  });

  test('a body on a GET: doRequest drops it, the data source rejects the call', async () => {
    const { service, source } = createClients();

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      body: { a: 1 },
    });
    const error = await RejectionUtility.rejectionOf({
      task: source.request({ paths: ['items'], method: 'GET', body: { a: 1 } }),
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0].body).toBe('');
    expect(isApplicationError(error)).toBe(true);
  });

  test('x-request-count: doRequest sends what it is given, the data source sends false and refuses a header of that name', async () => {
    const { service, source } = createClients();

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      headers: { [HTTP.Headers.REQUEST_COUNT_DATA]: 'true' },
    });
    await source.request({ paths: ['items'], method: 'GET' });
    const before = requestCount();
    const error = await RejectionUtility.rejectionOf({
      task: source.request({
        paths: ['items'],
        method: 'GET',
        headers: { [HTTP.Headers.REQUEST_COUNT_DATA]: 'true' },
      }),
    });

    expect(recorded[0].headers[HTTP.Headers.REQUEST_COUNT_DATA]).toBe('true');
    expect(recorded[1].headers[HTTP.Headers.REQUEST_COUNT_DATA]).toBe('false');
    expect(requestCount()).toBe(before);
    expect(error instanceof Error ? error.message : '').toContain(
      'x-request-count is owned by HttpDataSource',
    );
  });

  test('the default content type of a JSON body: with a charset from doRequest, without from the data source', async () => {
    const { service, source } = createClients();

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.POST,
      type: RequestTypes.CREATE,
      body: { a: 1 },
    });
    await source.request({ paths: ['items'], method: 'POST', body: { a: 1 } });

    expect(recorded[0].headers['content-type']).toBe('application/json; charset=utf-8');
    expect(recorded[1].headers['content-type']).toBe('application/json');
  });

  test('a path that leaves the base: both answer 400 and send nothing, with the same text', async () => {
    const { service, source } = createClients();

    const viaService = await RejectionUtility.rejectionOf({
      task: service.doRequest({
        paths: ['..', 'admin'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_ONE,
      }),
    });
    const viaSource = await RejectionUtility.rejectionOf({
      task: source.request({ paths: ['..', 'admin'], method: 'GET' }),
    });

    expect(recorded).toHaveLength(0);
    expect(viaService).toMatchObject({ statusCode: 400 });
    expect(viaSource).toMatchObject({ statusCode: 400 });
    expect(viaService instanceof Error ? viaService.message : '').toContain(
      'A request path must stay under the base path',
    );
    expect(viaSource instanceof Error ? viaSource.message : '').toContain(
      'A request path must stay under the base path',
    );
  });

  test('a relative base URL: both resolve it only where a location exists, and refuse it where there is none', async () => {
    const service = new DefaultNetworkRequestService({
      name: 'relative',
      baseUrl: '/api',
      noAuthPathRegex: /./,
    });
    const source = new HttpDataSource({ name: 'relative-source', baseUrl: '/api' });

    const viaService = await RejectionUtility.rejectionOf({
      task: service.doRequest({
        paths: ['items'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_ONE,
      }),
    });
    const viaSource = await RejectionUtility.rejectionOf({
      task: source.request({ paths: ['items'], method: 'GET' }),
    });

    expect(viaService instanceof Error ? viaService.message : '').toContain('Relative baseUrl');
    expect(viaSource instanceof Error ? viaSource.message : '').toContain('Relative baseUrl');
  });
});
