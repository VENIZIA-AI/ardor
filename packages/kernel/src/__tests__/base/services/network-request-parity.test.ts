import { HTTP } from '@venizia/ignis-helpers/common';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';

import { RejectionUtility } from '@venizia/dev-configs/testing';
import { getError, isApplicationError } from '@venizia/ignis-inversion';

import { DefaultNetworkRequestService } from '@/base/services/network-request';
import {
  App,
  type IAuthTokenRecord,
  RequestBodyTypes,
  RequestChannel,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type TRequestType,
} from '@/common';

/**
 * What `doRequest` puts on the wire and how it reads the answer, on the cases the other network
 * tests leave open. Any change of HTTP client underneath must keep these, except where a test
 * below names the behaviour as the one a reader fix replaces.
 */

interface IRecorded {
  method: string;
  pathname: string;
  params: URLSearchParams;
  headers: Record<string, string>;
  body: string;
}

type THandler = (opts: { req: Request }) => Response;

const APPLICATION_INFO = { name: 'parity-app', version: '1.0.0', description: 'parity' };

let server: ReturnType<typeof Bun.serve>;
let baseUrl = '';
let handler: THandler = () => Response.json({});
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

      return handler({ req });
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

afterEach(() => {
  recorded.length = 0;
  handler = () => Response.json({});
});

class ParityService extends DefaultNetworkRequestService {
  token?: IAuthTokenRecord;
  refreshedToken?: IAuthTokenRecord;

  protected override resolveAuthToken(): IAuthTokenRecord | undefined {
    return this.token;
  }

  protected override async refreshToken(): Promise<boolean> {
    if (!this.refreshedToken) {
      return false;
    }

    this.token = this.refreshedToken;

    return true;
  }
}

const createService = (opts: { headers?: HeadersInit; isOpen?: boolean } = {}) => {
  return new ParityService({
    name: 'parity-test',
    baseUrl,
    headers: opts.headers,
    noAuth: { regex: opts.isOpen ? /./ : undefined },
  });
};

const lastRequest = (): IRecorded => {
  const request = recorded.at(-1);

  if (!request) {
    throw getError({ message: 'no request reached the server' });
  }

  return request;
};

describe('the headers a request carries', () => {
  test('a call with no headers sends the constructor headers and the default JSON content type, even on a GET', async () => {
    const service = createService({ headers: { 'X-Static': 'static-1' }, isOpen: true });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
    });

    const { headers } = lastRequest();
    expect(headers['x-static']).toBe('static-1');
    expect(headers['content-type']).toBe('application/json; charset=utf-8');
    expect(headers).not.toHaveProperty(HTTP.Headers.REQUEST_COUNT_DATA);
    expect(headers).not.toHaveProperty(HTTP.Headers.AUTHORIZATION);
  });

  test('a call with headers sends those alone: the constructor headers and the default content type are not added', async () => {
    const service = createService({ headers: { 'X-Static': 'static-1' }, isOpen: true });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      headers: { 'x-own': 'own-1' },
    });

    const { headers } = lastRequest();
    expect(headers['x-own']).toBe('own-1');
    expect(headers).not.toHaveProperty('x-static');
    expect(headers).not.toHaveProperty('content-type');
    expect(headers).not.toHaveProperty(HTTP.Headers.REQUEST_COUNT_DATA);
  });

  test('a header removed with removeHeaders is not sent, with or without call headers', async () => {
    const service = createService({
      headers: { 'X-Tenant-Id': 't1', Authorization: 'Bearer static' },
      isOpen: true,
    });
    service.removeHeaders({ keys: ['x-tenant-id', 'authorization'] });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
    });
    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      headers: { 'x-own': 'own-1' },
    });

    expect(recorded).toHaveLength(2);

    for (const { headers } of recorded) {
      expect(headers).not.toHaveProperty('x-tenant-id');
      expect(headers).not.toHaveProperty('authorization');
    }
  });

  test('getRequestProps headers reach the server: session, tracing, count, token and provider', async () => {
    const service = createService({ headers: { 'X-Static': 'static-1' } });
    service.token = { value: 'tok-1', type: 'Bearer', provider: 'ldap' };
    service.setHeaders({ headers: { 'Accept-Language': 'vi' } });

    const props = service.getRequestProps({
      resource: 'items',
      restDataProviderOptions: { url: baseUrl },
      applicationInfo: APPLICATION_INFO,
    });
    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_LIST,
      ...props,
    });

    const { headers } = lastRequest();
    expect(headers[HTTP.Headers.TIMEZONE]).toBe(App.TIMEZONE);
    expect(headers[HTTP.Headers.TIMEZONE_OFFSET]).toBe(`${App.TIMEZONE_OFFSET}`);
    expect(headers['x-static']).toBe('static-1');
    expect(headers['accept-language']).toBe('vi');
    expect(headers[HTTP.Headers.REQUEST_CHANNEL]).toBe(RequestChannel.WEB);
    expect(headers[HTTP.Headers.REQUEST_TRACING_ID]).toStartWith('parity-app_');
    expect(headers[HTTP.Headers.REQUEST_COUNT_DATA]).toBe(RequestCountData.DATA_ONLY);
    expect(headers[HTTP.Headers.AUTHORIZATION]).toBe('Bearer tok-1');
    expect(headers[HTTP.Headers.AUTH_PROVIDER]).toBe('ldap');
    expect(headers['content-type']).toBe('application/json');
  });

  test('DATA_WITH_COUNT is sent as x-request-count 1', async () => {
    const service = createService({ isOpen: true });
    handler = () => Response.json({ data: [{ id: 1 }], count: 1 });

    const props = service.getRequestProps({
      resource: 'items',
      requestCountData: RequestCountData.DATA_WITH_COUNT,
      restDataProviderOptions: { url: baseUrl },
      applicationInfo: APPLICATION_INFO,
    });
    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_LIST,
      requestCountData: RequestCountData.DATA_WITH_COUNT,
      ...props,
    });

    expect(lastRequest().headers[HTTP.Headers.REQUEST_COUNT_DATA]).toBe(
      RequestCountData.DATA_WITH_COUNT,
    );
  });

  test('the retry after a refresh keeps every header of the first send and carries the new token', async () => {
    const service = createService();
    service.token = { value: 'stale', type: 'Bearer' };
    service.refreshedToken = { value: 'fresh', type: '', provider: 'sso' };

    handler = ({ req }) => {
      return req.headers.get('authorization') === 'Bearer fresh'
        ? Response.json({ ok: true })
        : Response.json({ error: 'expired' }, { status: 401 });
    };

    const props = service.getRequestProps({
      resource: 'items',
      requestCountData: RequestCountData.DATA_WITH_COUNT,
      restDataProviderOptions: { url: baseUrl },
      applicationInfo: APPLICATION_INFO,
    });
    const response = await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      ...props,
    });

    expect(response.data).toEqual({ ok: true });
    expect(recorded).toHaveLength(2);
    const [first, retry] = recorded;
    const { authorization: _first, ...firstRest } = first?.headers ?? {};
    const {
      authorization: retryAuthorization,
      [HTTP.Headers.AUTH_PROVIDER]: retryProvider,
      ...retryRest
    } = retry?.headers ?? {};
    expect(retryAuthorization).toBe('Bearer fresh');
    expect(retryProvider).toBe('sso');
    expect(retryRest).toEqual(firstRest);
  });
});

describe('the bodies a request carries', () => {
  test('a json body is its JSON under application/json', async () => {
    const service = createService({ isOpen: true });
    const props = service.getRequestProps({
      resource: 'items',
      payload: {
        data: { title: 'a', tags: ['x'], at: new Date('2026-01-02T03:04:05.000Z') },
        type: RequestBodyTypes.JSON,
      },

      restDataProviderOptions: { url: baseUrl },
      applicationInfo: APPLICATION_INFO,
    });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.POST,
      type: RequestTypes.CREATE,
      ...props,
    });

    const request = lastRequest();
    expect(request.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request.body)).toEqual({
      title: 'a',
      tags: ['x'],
      at: '2026-01-02T03:04:05.000Z',
    });
  });

  test('an urlencoded body is its pairs, under the urlencoded content type', async () => {
    const service = createService({ isOpen: true });
    const props = service.getRequestProps({
      resource: 'sign-in',
      payload: {
        data: {
          username: 'a b',
          remember: true,
          at: new Date('2026-01-02T03:04:05.000Z'),
          meta: { k: 1 },
          skipped: null,
        },
        type: RequestBodyTypes.FORM_URL_ENCODED,
      },

      restDataProviderOptions: { url: baseUrl },
      applicationInfo: APPLICATION_INFO,
    });

    await service.doRequest({
      paths: ['sign-in'],
      method: RequestMethods.POST,
      type: RequestTypes.SEND,
      ...props,
    });

    const request = lastRequest();
    expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(request.body).toBe(
      'username=a+b&remember=true&at=2026-01-02T03%3A04%3A05.000Z&meta=%7B%22k%22%3A1%7D',
    );
  });

  test('an object body with headers that name no content type is JSON text, and no content type is added', async () => {
    const service = createService({ isOpen: true });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.POST,
      type: RequestTypes.CREATE,
      headers: { 'x-own': 'own-1' },
      body: { title: 'a' },
    });

    const request = lastRequest();
    expect(request.body).toBe('{"title":"a"}');
    expect(request.headers).not.toHaveProperty('content-type');
  });

  test('a null body sends no body', async () => {
    const service = createService({ isOpen: true });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.POST,
      type: RequestTypes.SEND,
      headers: { 'content-type': 'application/json' },
      body: null,
    });

    expect(lastRequest().body).toBe('');
  });
});

describe('the query a request carries', () => {
  test('primitives are their text, a nested filter is one JSON parameter', async () => {
    const service = createService({ isOpen: true });

    await service.doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_LIST,
      query: {
        filter: { where: { name: { like: '%a b%' } }, order: ['id DESC'], skip: 0 },
        isActive: false,
        page: 0,
        q: 'x&y=z',
        at: new Date('2026-01-02T03:04:05.000Z'),
      },
    });

    const { params } = lastRequest();
    expect(JSON.parse(params.get('filter') ?? 'null')).toEqual({
      where: { name: { like: '%a b%' } },
      order: ['id DESC'],
      skip: 0,
    });
    expect(params.get('isActive')).toBe('false');
    expect(params.get('page')).toBe('0');
    expect(params.get('q')).toBe('x&y=z');
    expect(params.get('at')).toBe('"2026-01-02T03:04:05.000Z"');
  });

  test('a path with its own query keeps it, and the query option is added after it', async () => {
    const service = createService({ isOpen: true });

    await service.doRequest({
      paths: ['items?scope=mine'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_LIST,
      query: { page: 2 },
    });

    const request = lastRequest();
    expect(request.pathname).toBe('/items');
    expect([...request.params.entries()]).toEqual([
      ['scope', 'mine'],
      ['page', '2'],
    ]);
  });
});

describe('the totals and counts of a response', () => {
  const getList = (opts: { requestCountData?: string } = {}) => {
    return createService({ isOpen: true }).doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_LIST,
      requestCountData:
        opts.requestCountData === RequestCountData.DATA_WITH_COUNT
          ? RequestCountData.DATA_WITH_COUNT
          : undefined,
    });
  };

  test('a list takes its total from Content-Range', async () => {
    handler = () => {
      return Response.json([{ id: 1 }, { id: 2 }], {
        headers: { [HTTP.Headers.CONTENT_RANGE]: 'items 0-1/42' },
      });
    };

    const response = await getList();

    expect(response).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 42 });
  });

  test.each([
    ['no Content-Range', undefined],
    ['a malformed Content-Range', 'items lots'],
  ])('a list with %s takes the row count as its total', async (_name, contentRange) => {
    handler = () => {
      return Response.json(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        contentRange ? { headers: { [HTTP.Headers.CONTENT_RANGE]: contentRange } } : {},
      );
    };

    const response = await getList();

    expect(response).toEqual({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], total: 3 });
  });

  test('a list answered by one object is a list of that object', async () => {
    handler = () => Response.json({ id: 9 });

    const response = await getList();

    expect(response).toEqual({ data: [{ id: 9 }], total: 1 });
  });

  test('a counted list reads { data, count } and the Content-Range total', async () => {
    handler = () => {
      return Response.json(
        { data: [{ id: 1 }, { id: 2 }], count: 2 },
        { headers: { [HTTP.Headers.CONTENT_RANGE]: 'items 0-1/30' } },
      );
    };

    const response = await getList({ requestCountData: RequestCountData.DATA_WITH_COUNT });

    expect(response).toEqual({ data: [{ id: 1 }, { id: 2 }], count: 2, total: 30 });
  });

  test('a counted list answered by a bare array throws the documented error', async () => {
    handler = () => Response.json([{ id: 1 }]);

    const error = await RejectionUtility.rejectionOf({
      task: getList({ requestCountData: RequestCountData.DATA_WITH_COUNT }),
    });

    expect(error instanceof Error ? error.message : '').toContain('Invalid response format');
  });

  test('a record takes its count from x-response-count, and none when the header is absent', async () => {
    const service = createService({ isOpen: true });

    handler = () => {
      return Response.json({ id: 1 }, { headers: { [HTTP.Headers.RESPONSE_COUNT_DATA]: '5' } });
    };

    const counted = await service.doRequest({
      paths: ['items', '1'],
      method: RequestMethods.PATCH,
      type: RequestTypes.UPDATE,
    });

    handler = () => Response.json({ id: 1 });
    const uncounted = await service.doRequest({
      paths: ['items', '1'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
    });

    expect(counted).toEqual({ data: { id: 1 }, count: 5 });
    expect(uncounted).toEqual({ data: { id: 1 }, count: undefined });
  });

  test('a counted record returns the { data, count } body as it is', async () => {
    handler = () => Response.json({ data: { id: 1 }, count: 1 });

    const response = await createService({ isOpen: true }).doRequest({
      paths: ['items', '1'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      requestCountData: RequestCountData.DATA_WITH_COUNT,
    });

    expect(response).toEqual({ data: { id: 1 }, count: 1 });
  });
});

describe('the errors of a response', () => {
  test('a relayed error keeps its own request id and lists the upstream one', async () => {
    handler = () => {
      return Response.json(
        {
          error: {
            statusCode: 502,
            message: 'Upstream failed',
            normalized: { text: 'Upstream failed', code: 'server.upstream' },
            requestId: 'req-near',
            extra: { requestId: 'req-far', upstreamRequestIds: ['req-farther'] },
          },
        },
        { status: 502 },
      );
    };

    const error = await RejectionUtility.rejectionOf({
      task: createService({ isOpen: true }).doRequest({
        paths: ['relay'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_ONE,
      }),
    });

    expect(isApplicationError(error)).toBe(true);
    expect(error).toMatchObject({
      statusCode: 502,
      message: 'Upstream failed',
      extra: { requestId: 'req-near', upstreamRequestIds: ['req-far', 'req-farther'] },
    });
    expect(isApplicationError(error) ? error.normalized.code : undefined).toBe('server.upstream');
  });
});

describe('the 2xx bodies as they are read today', () => {
  const readWith = (opts: { body: BodyInit | null; headers?: Record<string, string> }) => {
    handler = () => new Response(opts.body, { status: 200, headers: opts.headers });

    return createService({ isOpen: true }).doRequest({
      paths: ['body'],
      method: RequestMethods.GET,
      type: RequestTypes.SEND,
    });
  };

  test('a 2xx text/plain body is the text, whatever it holds', async () => {
    const response = await readWith({
      body: 'plain words',
      headers: { 'content-type': 'text/plain' },
    });

    expect(response.data).toBe('plain words');
  });

  test('a 2xx text/csv body that is no attachment is the text', async () => {
    const response = await readWith({
      body: 'a,b\n1,2',
      headers: { 'content-type': 'text/csv' },
    });

    expect(response.data).toBe('a,b\n1,2');
  });

  test('a 2xx body that claims JSON and is not rejects with a 502 ApplicationError, without its content', async () => {
    const error = await RejectionUtility.rejectionOf({
      task: readWith({
        body: 'secret <html>',
        headers: { 'content-type': 'application/json' },
      }),
    });

    expect(isApplicationError(error)).toBe(true);
    expect(error).toMatchObject({ statusCode: 502 });
    expect(error instanceof Error ? error.message : '').not.toContain('secret');
  });

  test('an empty 2xx body, JSON or text, answers data null in every runtime', async () => {
    const json = await readWith({ body: '', headers: { 'content-type': 'application/json' } });
    const text = await readWith({ body: '', headers: { 'content-type': 'text/plain' } });

    expect(json).toEqual({ data: null, count: undefined });
    expect(text).toEqual({ data: null, count: undefined });
  });

  test.each<TRequestType>([RequestTypes.GET_LIST, RequestTypes.GET_MANY_REFERENCE])(
    'an empty 2xx body of a %s is no row: data [] and a total of 0, never [null]',
    async (type) => {
      handler = () =>
        new Response('', { status: 200, headers: { 'content-type': 'application/json' } });

      const response = await createService({ isOpen: true }).doRequest({
        paths: ['items'],
        method: RequestMethods.GET,
        type,
      });

      expect(response).toMatchObject({ data: [], total: 0 });
    },
  );

  test('a 204 answers { data: {} } whatever the request type, with no total', async () => {
    handler = () => new Response(null, { status: 204 });

    const response = await createService({ isOpen: true }).doRequest({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_LIST,
    });

    expect(response).toEqual({ data: {} });
  });

  test('a 2xx body of a type that is not textual is a Blob', async () => {
    const response = await readWith({
      body: new TextEncoder().encode('raw bytes'),
      headers: { 'content-type': 'application/octet-stream' },
    });

    expect(response.data).toBeInstanceOf(Blob);
    expect(response).not.toHaveProperty('filename');
  });

  test('an attachment names its file from filename*, and keeps its Content-Disposition', async () => {
    const disposition =
      'attachment; filename="plain.csv"; filename*=UTF-8\'\'b%C3%A1o-c%C3%A1o.csv';
    const response = await readWith({
      body: 'a,b',
      headers: { 'content-type': 'text/csv', 'content-disposition': disposition },
    });

    expect(response.data).toBeInstanceOf(Blob);
    expect(response.filename).toBe('báo-cáo.csv');
    expect(response.contentDisposition).toBe(disposition);
  });
});
