import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { getError } from '@venizia/ignis-inversion';

import { DefaultNetworkRequestService } from '@/base/services/network-request';
import {
  App,
  HeaderConsts,
  type IApplicationInfo,
  type IAuthRecoveryOptions,
  type IRestDataProviderOptions,
  LocalStorageKeys,
  RequestBodyTypes,
  RequestChannel,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  type TNoAuthPathRegex,
} from '@/common';

interface IRecordedRequest {
  method: string;
  pathname: string;
  search: string;
  headers: Record<string, string>;
  jsonBody?: unknown;
}

interface IServerHandlerOptions {
  req: Request;
}

type TServerHandler = (opts: IServerHandlerOptions) => Promise<Response> | Response;

interface ICreateServiceOptions {
  name?: string;
  baseUrl?: string;
  useAuth?: boolean;
  noAuthPaths?: string[];
  noAuthPathRegex?: TNoAuthPathRegex;
  headers?: HeadersInit;
  authRecovery?: IAuthRecoveryOptions;
}

const createService = (opts: ICreateServiceOptions = {}): DefaultNetworkRequestService => {
  const {
    name = 'test-network-service',
    baseUrl = '',
    useAuth = true,
    noAuthPaths,
    noAuthPathRegex,
    headers,
    authRecovery,
  } = opts;

  return new DefaultNetworkRequestService({
    name,
    baseUrl,
    useAuth,
    noAuthPaths,
    noAuthPathRegex,
    headers,
    authRecovery,
  });
};

interface ICreateAppInfoOptions {
  name?: string;
  version?: string;
  description?: string;
}

const createApplicationInfo = (opts: ICreateAppInfoOptions = {}): IApplicationInfo => {
  const { name = 'ardor-app', version = '1.0.0', description = 'ARDOR application info' } = opts;
  return {
    name,
    version,
    description,
  };
};

interface ICreateRestOptions {
  url?: string;
  requestTracingId?: boolean | ((opts: { applicationInfo: IApplicationInfo }) => string);
  requestTracingChannel?: string;
}

const createRestDataProviderOptions = (opts: ICreateRestOptions = {}): IRestDataProviderOptions => {
  const { url = 'http://127.0.0.1:8080', requestTracingId, requestTracingChannel } = opts;
  return {
    url,
    requestTracingId,
    requestTracingChannel,
  };
};

const delay = (opts: { milliseconds: number }): Promise<void> => {
  const { milliseconds } = opts;
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

describe('DefaultNetworkRequestService', () => {
  let serverBaseUrl = '';
  let server: ReturnType<typeof Bun.serve>;
  let serverHandler: TServerHandler | null = null;
  const recordedRequests: IRecordedRequest[] = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: async (req: Request): Promise<Response> => {
        const url = new URL(req.url);
        const recordedHeaders: Record<string, string> = {};
        req.headers.forEach((val, key) => {
          recordedHeaders[key] = val;
        });

        let jsonBody: unknown = undefined;
        const contentType = req.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          try {
            jsonBody = await req.json();
          } catch (err: unknown) {
            console.error('[server.fetch] Failed to parse JSON body', err);
            jsonBody = undefined;
          }
        }

        recordedRequests.push({
          method: req.method,
          pathname: url.pathname,
          search: url.search,
          headers: recordedHeaders,
          jsonBody,
        });

        if (serverHandler) {
          return serverHandler({ req });
        }

        return new Response(JSON.stringify({ data: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    serverBaseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.stop(true);
  });

  afterEach(() => {
    serverHandler = null;
    recordedRequests.length = 0;
    localStorage.clear();
  });

  describe('getRequestHeader', () => {
    test('returns Timezone and Timezone-Offset headers for a no-auth resource', () => {
      const service = createService({
        headers: { 'x-custom-app': 'ignis' },
        noAuthPaths: ['public-health'],
      });

      const headers = service.getRequestHeader({ resource: 'public-health' });

      expect(headers).toHaveProperty(HeaderConsts.TIMEZONE, App.TIMEZONE);
      expect(headers).toHaveProperty(HeaderConsts.TIMEZONE_OFFSET, `${App.TIMEZONE_OFFSET}`);
      expect(headers).toHaveProperty('x-custom-app', 'ignis');
      expect(HeaderConsts.AUTHORIZATION in headers).toBe(false);
      expect(HeaderConsts.X_AUTH_PROVIDER in headers).toBe(false);
    });

    test('adds authorization with default Bearer type and x-auth-provider when resource needs auth', () => {
      localStorage.setItem(
        LocalStorageKeys.KEY_AUTH_TOKEN,
        JSON.stringify({ value: 'token-abc', provider: 'oidc' }),
      );
      const service = createService();

      const headers = service.getRequestHeader({ resource: 'protected-resource' });

      expect(headers).toHaveProperty(HeaderConsts.TIMEZONE, App.TIMEZONE);
      expect(headers).toHaveProperty(HeaderConsts.TIMEZONE_OFFSET, `${App.TIMEZONE_OFFSET}`);
      expect(headers).toHaveProperty(HeaderConsts.AUTHORIZATION, 'Bearer token-abc');
      expect(headers).toHaveProperty(HeaderConsts.X_AUTH_PROVIDER, 'oidc');
    });

    test('adds authorization with custom token type when specified', () => {
      const service = createService();
      service.setAuthToken({ value: 'token-custom', type: 'Basic' });

      const headers = service.getRequestHeader({ resource: 'protected-resource' });

      expect(headers).toHaveProperty(HeaderConsts.AUTHORIZATION, 'Basic token-custom');
    });
  });

  describe('getRequestAuthorizationHeader', () => {
    test('throws an error with statusCode 401 when no token is stored', () => {
      const service = createService();

      try {
        service.getRequestAuthorizationHeader();
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[auth header expected error]', err);
        if (typeof err === 'object' && err !== null && 'statusCode' in err) {
          expect(err.statusCode).toBe(401);
        }
        if (err instanceof Error) {
          expect(err.message).toContain(
            '[dataProvider][getAuthHeader] Invalid auth token to fetch!',
          );
        }
      }
    });

    test('reads the token from localStorage under LocalStorageKeys.KEY_AUTH_TOKEN', () => {
      localStorage.setItem(
        LocalStorageKeys.KEY_AUTH_TOKEN,
        JSON.stringify({ value: 'storage-token', type: 'Bearer', provider: 'ardor-auth' }),
      );
      const service = createService();

      const result = service.getRequestAuthorizationHeader();

      expect(result.token).toBe('Bearer storage-token');
      expect(result.provider).toBe('ardor-auth');
    });

    test('prefers authToken set via setAuthToken over localStorage', () => {
      localStorage.setItem(
        LocalStorageKeys.KEY_AUTH_TOKEN,
        JSON.stringify({ value: 'from-local-storage', type: 'Bearer' }),
      );
      const service = createService();
      service.setAuthToken({ value: 'from-set-token', type: 'Bearer' });

      const result = service.getRequestAuthorizationHeader();

      expect(result.token).toBe('Bearer from-set-token');
    });

    test('does not throw a JSON error but throws a 401 when stored value is an empty string', () => {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, '');
      const service = createService();

      try {
        service.getRequestAuthorizationHeader();
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[empty string token expected error]', err);
        if (typeof err === 'object' && err !== null && 'statusCode' in err) {
          expect(err.statusCode).toBe(401);
        }
        if (err instanceof Error) {
          expect(err.message).toContain(
            '[dataProvider][getAuthHeader] Invalid auth token to fetch!',
          );
        }
      }
    });
  });

  describe('isNoAuthPath', () => {
    test('makes every path no-auth when useAuth is false', () => {
      const service = createService({ useAuth: false });

      expect(service.isNoAuthPath({ resource: 'users' })).toBe(true);
      expect(service.isNoAuthPath({ resource: 'admin/secret', paths: ['admin', 'secret'] })).toBe(
        true,
      );
    });

    test('matches the resource exactly against noAuthPaths', () => {
      const service = createService({
        useAuth: true,
        noAuthPaths: ['public', 'health'],
      });

      expect(service.isNoAuthPath({ resource: 'public' })).toBe(true);
      expect(service.isNoAuthPath({ resource: 'health' })).toBe(true);
      expect(service.isNoAuthPath({ resource: 'private' })).toBe(false);
      expect(service.isNoAuthPath({ resource: 'public/nested' })).toBe(false);
    });

    test('accepts string, RegExp, and array patterns matching resource or joined paths in noAuthPathRegex', () => {
      const stringService = createService({
        useAuth: true,
        noAuthPathRegex: '^auth/.*',
      });
      expect(stringService.isNoAuthPath({ resource: 'auth/login' })).toBe(true);
      expect(stringService.isNoAuthPath({ paths: ['auth', 'register'] })).toBe(true);
      expect(stringService.isNoAuthPath({ resource: 'users' })).toBe(false);

      const regexService = createService({
        useAuth: true,
        noAuthPathRegex: /^guest\/[0-9]+/,
      });
      expect(regexService.isNoAuthPath({ resource: 'guest/42' })).toBe(true);
      expect(regexService.isNoAuthPath({ paths: ['guest', '42'] })).toBe(true);
      expect(regexService.isNoAuthPath({ resource: 'guest/abc' })).toBe(false);

      const arrayService = createService({
        useAuth: true,
        noAuthPathRegex: ['^open/.*', /^public-api\/.*/],
      });
      expect(arrayService.isNoAuthPath({ resource: 'open/catalog' })).toBe(true);
      expect(arrayService.isNoAuthPath({ paths: ['public-api', 'status'] })).toBe(true);
      expect(arrayService.isNoAuthPath({ resource: 'secure/data' })).toBe(false);
    });

    test('updates no-auth configuration at runtime via setUseAuth, setNoAuthPaths, and setNoAuthPathRegex', () => {
      const service = createService({
        useAuth: true,
        noAuthPaths: ['initial-open'],
        noAuthPathRegex: '^v1/open/.*',
      });

      expect(service.isNoAuthPath({ resource: 'initial-open' })).toBe(true);
      expect(service.isNoAuthPath({ resource: 'runtime-open' })).toBe(false);

      service.setNoAuthPaths(['runtime-open']);
      expect(service.isNoAuthPath({ resource: 'initial-open' })).toBe(false);
      expect(service.isNoAuthPath({ resource: 'runtime-open' })).toBe(true);

      expect(service.isNoAuthPath({ resource: 'v1/open/data' })).toBe(true);
      service.setNoAuthPathRegex('^v2/open/.*');
      expect(service.isNoAuthPath({ resource: 'v1/open/data' })).toBe(false);
      expect(service.isNoAuthPath({ resource: 'v2/open/data' })).toBe(true);

      service.setUseAuth(false);
      expect(service.isNoAuthPath({ resource: 'strictly-secret' })).toBe(true);
    });
  });

  describe('setHeaders and removeHeaders', () => {
    test('merges headers into existing headers in setHeaders', () => {
      const service = createService({
        headers: {
          'x-base': 'initial',
          'x-shared': 'v1',
        },
      });

      service.setHeaders({
        'x-shared': 'v2',
        'x-new': 'added',
      });

      expect(service['headers']).toEqual({
        'x-base': 'initial',
        'x-shared': 'v2',
        'x-new': 'added',
      });
    });

    test('deletes only the named keys in removeHeaders', () => {
      const service = createService({
        headers: {
          'x-keep': 'remain',
          'x-drop-1': 'bye',
          'x-drop-2': 'farewell',
        },
      });

      service.removeHeaders(['x-drop-1', 'x-drop-2']);

      expect(service['headers']).toEqual({
        'x-keep': 'remain',
      });

      service.removeHeaders([]);
      expect(service['headers']).toEqual({
        'x-keep': 'remain',
      });
    });
  });

  describe('getRequestProps', () => {
    test('builds x-request-channel, x-request-count, and default x-request-id', () => {
      const service = createService({ useAuth: false });
      const applicationInfo = createApplicationInfo({ name: 'ardor-core' });
      const restDataProviderOptions = createRestDataProviderOptions();

      const props = service.getRequestProps({
        resource: 'items',
        applicationInfo,
        restDataProviderOptions,
        requestCountData: RequestCountData.DATA_ONLY,
      });

      expect(props.headers).toHaveProperty(HeaderConsts.REQUEST_CHANNEL, RequestChannel.WEB);
      expect(props.headers).toHaveProperty(
        HeaderConsts.REQUEST_COUNT_DATA,
        RequestCountData.DATA_ONLY,
      );

      const headersObj = props.headers;
      if (
        typeof headersObj === 'object' &&
        headersObj !== null &&
        !Array.isArray(headersObj) &&
        !(headersObj instanceof Headers)
      ) {
        const tracingHeader = Object.entries(headersObj).find(
          ([key]) => key === HeaderConsts.REQUEST_TRACING_ID,
        );
        expect(tracingHeader).toBeDefined();
        if (tracingHeader && typeof tracingHeader[1] === 'string') {
          expect(tracingHeader[1].startsWith('ardor-core_')).toBe(true);
        }
      }
    });

    test('uses requestTracingChannel and function-based requestTracingId when provided', () => {
      const service = createService({ useAuth: false });
      const applicationInfo = createApplicationInfo({ name: 'custom-app' });
      const restDataProviderOptions = createRestDataProviderOptions({
        requestTracingChannel: '200_MOBILE',
        requestTracingId: (opts: { applicationInfo: IApplicationInfo }) => {
          return `custom-trace-${opts.applicationInfo.name}`;
        },
      });

      const props = service.getRequestProps({
        resource: 'items',
        applicationInfo,
        restDataProviderOptions,
      });

      expect(props.headers).toHaveProperty(HeaderConsts.REQUEST_CHANNEL, '200_MOBILE');
      expect(props.headers).toHaveProperty(
        HeaderConsts.REQUEST_TRACING_ID,
        'custom-trace-custom-app',
      );
    });

    test('sets application/json content-type and passes body through for default bodyType', () => {
      const service = createService({ useAuth: false });
      const testBody = { title: 'New Item', count: 12 };

      const props = service.getRequestProps({
        resource: 'items',
        body: testBody,
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.headers).toHaveProperty(HeaderConsts.CONTENT_TYPE, 'application/json');
      expect(props.body).toBe(testBody);
    });

    test('builds FormData with File and File array entries while skipping empty values for form-data bodyType', () => {
      const service = createService({ useAuth: false });
      const singleFile = new File(['alpha'], 'single.txt', { type: 'text/plain' });
      const fileList = [
        new File(['beta1'], 'file1.txt', { type: 'text/plain' }),
        new File(['beta2'], 'file2.txt', { type: 'text/plain' }),
      ];

      const props = service.getRequestProps({
        resource: 'upload',
        bodyType: RequestBodyTypes.FORM_DATA,
        body: {
          single: singleFile,
          multiple: fileList,
          emptyVal: null,
          undefVal: undefined,
        },
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.body instanceof FormData).toBe(true);
      if (props.body instanceof FormData) {
        expect(props.body.get('single')).toBeDefined();
        expect(props.body.getAll('multiple').length).toBe(2);
        expect(props.body.has('emptyVal')).toBe(false);
        expect(props.body.has('undefVal')).toBe(false);
      }
    });

    test('encodes the body as application/x-www-form-urlencoded and skips empty values for form-urlencoded bodyType', () => {
      const service = createService({ useAuth: false });

      const props = service.getRequestProps({
        resource: 'oauth',
        bodyType: RequestBodyTypes.FORM_URL_ENCODED,
        body: {
          ['client_id']: 'client-123',
          ['grant_type']: 'authorization_code',
          emptyField: '',
        },
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.headers).toHaveProperty(
        HeaderConsts.CONTENT_TYPE,
        'application/x-www-form-urlencoded',
      );
      expect(props.body instanceof URLSearchParams).toBe(true);
      if (props.body instanceof URLSearchParams) {
        expect(props.body.toString()).toBe('client_id=client-123&grant_type=authorization_code');
        expect(props.body.has('emptyField')).toBe(false);
      }
    });
  });

  describe('convertResponse', () => {
    test('yields total from content-range header and wraps non-array data into an array for GET_LIST', () => {
      const service = createService();

      const res = service.convertResponse<{ id: number } | { id: number }[]>({
        type: RequestTypes.GET_LIST,
        response: {
          data: { id: 1 },
          headers: new Headers({
            [HeaderConsts.CONTENT_RANGE]: 'items 0-9/57',
          }),
        },
      });

      expect(res.total).toBe(57);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data).toEqual([{ id: 1 }]);
    });

    test('sets total equal to row count when content-range header is absent for GET_LIST', () => {
      const service = createService();

      const res = service.convertResponse<{ id: number }[]>({
        type: RequestTypes.GET_LIST,
        response: {
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
          headers: new Headers(),
        },
      });

      expect(res.total).toBe(3);
      expect(res.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    test('requires data and count properties for DATA_WITH_COUNT and throws otherwise', () => {
      const service = createService();

      expect(() => {
        service.convertResponse({
          type: RequestTypes.GET_LIST,
          requestCountData: RequestCountData.DATA_WITH_COUNT,
          response: {
            data: { onlyData: [{ id: 1 }] },
            headers: new Headers(),
          },
        });
      }).toThrow('Invalid response format');

      const validRes = service.convertResponse<{ id: number }[]>({
        type: RequestTypes.GET_LIST,
        requestCountData: RequestCountData.DATA_WITH_COUNT,
        response: {
          data: { data: [{ id: 10 }], count: 25 },
          headers: new Headers({
            [HeaderConsts.CONTENT_RANGE]: 'items 0-0/25',
          }),
        },
      });

      expect(validRes.count).toBe(25);
      expect(validRes.total).toBe(25);
      expect(validRes.data).toEqual([{ id: 10 }]);
    });

    test('returns data and count parsed from x-response-count for non-list request types', () => {
      const service = createService();

      const res = service.convertResponse<{ id: number; name: string }>({
        type: RequestTypes.GET_ONE,
        response: {
          data: { id: 7, name: 'ARDOR Entity' },
          headers: new Headers({
            [HeaderConsts.RESPONSE_COUNT_DATA]: '84',
          }),
        },
      });

      expect(res.data).toEqual({ id: 7, name: 'ARDOR Entity' });
      expect(res.count).toBe(84);
    });
  });

  describe('doRequest', () => {
    test('throws an error when baseUrl is empty', async () => {
      const emptyBaseService = createService({ baseUrl: '' });

      await expect(
        emptyBaseService.doRequest({
          paths: ['items'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
        }),
      ).rejects.toThrow('[doRequest] Invalid baseUrl to send request!');
    });

    test('returns empty data object on 204 No Content response', async () => {
      serverHandler = () => {
        return new Response(null, { status: 204 });
      };
      const service = createService({ baseUrl: serverBaseUrl });

      const res = await service.doRequest({
        paths: ['records', '1'],
        method: RequestMethods.DELETE,
        type: RequestTypes.DELETE,
      });

      expect(res).toEqual({ data: {} });
    });

    test('parses and returns JSON body on 200 response', async () => {
      serverHandler = () => {
        return new Response(JSON.stringify({ id: 101, title: 'Parsed Record' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };
      const service = createService({ baseUrl: serverBaseUrl });

      const res = await service.doRequest<{ id: number; title: string }>({
        paths: ['records', '101'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_ONE,
      });

      expect(res.data).toEqual({ id: 101, title: 'Parsed Record' });
    });

    test('yields Blob and parsed filename on attachment content-disposition response', async () => {
      serverHandler = () => {
        return new Response('col_a,col_b\n1,2', {
          status: 200,
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="report.csv"',
          },
        });
      };
      const service = createService({ baseUrl: serverBaseUrl });

      const res = await service.doRequest({
        paths: ['export'],
        method: RequestMethods.GET,
        type: RequestTypes.SEND,
      });

      expect(res.filename).toBe('report.csv');
      expect(res.data instanceof Blob).toBe(true);
    });

    test('throws body.error when present on non-2xx response', async () => {
      serverHandler = () => {
        return new Response(JSON.stringify({ error: { message: 'Entity missing', code: 404 } }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      };
      const service = createService({ baseUrl: serverBaseUrl });

      try {
        await service.doRequest({
          paths: ['missing-entity'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
        });
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[expected non-2xx body.error]', err);
        expect(err).toEqual({ message: 'Entity missing', code: 404 });
      }
    });

    test('throws the full body when body.error is absent on non-2xx response', async () => {
      serverHandler = () => {
        return new Response(JSON.stringify({ message: 'Validation failed', field: 'email' }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        });
      };
      const service = createService({ baseUrl: serverBaseUrl });

      try {
        await service.doRequest({
          paths: ['validate'],
          method: RequestMethods.POST,
          type: RequestTypes.CREATE,
          body: { email: 'bad' },
        });
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[expected non-2xx full body error]', err);
        expect(err).toEqual({ message: 'Validation failed', field: 'email' });
      }
    });

    test('never sends a body on GET requests', async () => {
      serverHandler = () => {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };
      const service = createService({ baseUrl: serverBaseUrl });

      await service.doRequest({
        paths: ['get-no-body-test'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_ONE,
        body: { notSent: 'drop me' },
      });

      const getReq = recordedRequests.find((req) => req.pathname === '/get-no-body-test');
      expect(getReq).toBeDefined();
      expect(getReq?.method).toBe('GET');
      expect(getReq?.jsonBody).toBeUndefined();
    });

    test('serialises query parameters into the request URL', async () => {
      serverHandler = () => {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      };
      const service = createService({ baseUrl: serverBaseUrl });

      await service.doRequest({
        paths: ['search-test'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_LIST,
        query: { filter: 'active', limit: '10' },
      });

      const req = recordedRequests.find((r) => r.pathname === '/search-test');
      expect(req).toBeDefined();
      expect(req?.search).toContain('filter=active');
      expect(req?.search).toContain('limit=10');
    });
  });

  describe('401 recovery', () => {
    test('calls refreshToken once for concurrent 401s, retries with refreshed Authorization header, and returns 200', async () => {
      let refreshCallCount = 0;
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'stale-token' });

      const refreshToken = mock(async () => {
        refreshCallCount++;
        await delay({ milliseconds: 40 });
        service.setAuthToken({ value: 'fresh-token' });
        return true;
      });

      service.setAuthRecovery({ refreshToken });

      serverHandler = (opts: IServerHandlerOptions) => {
        const auth = opts.req.headers.get('authorization');
        if (auth === 'Bearer stale-token') {
          return new Response(JSON.stringify({ error: 'expired' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (auth === 'Bearer fresh-token') {
          return new Response(JSON.stringify({ recovered: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'unknown_auth' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      };

      const [resA, resB] = await Promise.all([
        service.doRequest<{ recovered: boolean }>({
          paths: ['concurrent-a'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
          headers: service.getRequestHeader({ resource: 'concurrent-a' }),
        }),
        service.doRequest<{ recovered: boolean }>({
          paths: ['concurrent-b'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
          headers: service.getRequestHeader({ resource: 'concurrent-b' }),
        }),
      ]);

      expect(refreshCallCount).toBe(1);
      expect(resA.data).toEqual({ recovered: true });
      expect(resB.data).toEqual({ recovered: true });
    });

    test('never recovers a path containing refreshTokenPath on 401', async () => {
      let refreshCalled = false;
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'expired-token' });

      const refreshToken = mock(async () => {
        refreshCalled = true;
        return true;
      });

      service.setAuthRecovery({
        refreshTokenPath: 'auth/refresh-token',
        refreshToken,
      });

      serverHandler = () => {
        return new Response(JSON.stringify({ error: 'refresh_failed_unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      };

      try {
        await service.doRequest({
          paths: ['api', 'auth', 'refresh-token'],
          method: RequestMethods.POST,
          type: RequestTypes.SEND,
        });
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[expected refreshTokenPath 401]', err);
        expect(err).toBe('refresh_failed_unauthorized');
      }

      expect(refreshCalled).toBe(false);
    });

    test('never recovers a no-auth path on 401', async () => {
      let refreshCalled = false;
      const service = createService({
        baseUrl: serverBaseUrl,
        noAuthPaths: ['public-data'],
      });

      const refreshToken = mock(async () => {
        refreshCalled = true;
        return true;
      });

      service.setAuthRecovery({ refreshToken });

      serverHandler = () => {
        return new Response(JSON.stringify({ error: 'public_endpoint_401' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      };

      try {
        await service.doRequest({
          paths: ['public-data'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
        });
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[expected no-auth 401 error]', err);
        expect(err).toBe('public_endpoint_401');
      }

      expect(refreshCalled).toBe(false);
    });

    test('calls onAuthFailure once and throws original 401 response error when refreshToken rejects', async () => {
      let authFailureCallCount = 0;
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'unrecoverable-token' });

      const refreshToken = mock(() =>
        Promise.reject(getError({ message: 'Refresh token service offline' })),
      );

      const onAuthFailure = mock(() => {
        authFailureCallCount++;
      });

      service.setAuthRecovery({
        refreshToken,
        onAuthFailure,
      });

      serverHandler = () => {
        return new Response(
          JSON.stringify({ error: { code: 'INVALID_SESSION', reason: 'Expired permanently' } }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        );
      };

      try {
        await service.doRequest({
          paths: ['protected-account'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
        });
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[expected rejected refresh error]', err);
        expect(err).toEqual({ code: 'INVALID_SESSION', reason: 'Expired permanently' });
      }

      expect(authFailureCallCount).toBe(1);
    });

    test('calls onAuthFailure once and throws original 401 response error when refreshToken throws synchronously', async () => {
      let authFailureCallCount = 0;
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'unrecoverable-token' });

      const refreshToken = mock((): Promise<unknown> => {
        throw getError({ message: 'Refresh token service offline' });
      });

      const onAuthFailure = mock(() => {
        authFailureCallCount++;
      });

      service.setAuthRecovery({
        refreshToken,
        onAuthFailure,
      });

      serverHandler = () => {
        return new Response(
          JSON.stringify({ error: { code: 'INVALID_SESSION', reason: 'Expired permanently' } }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        );
      };

      try {
        await service.doRequest({
          paths: ['protected-account'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
        });
        expect(true).toBe(false);
      } catch (err: unknown) {
        console.info('[expected rejected refresh error]', err);
        expect(err).toEqual({ code: 'INVALID_SESSION', reason: 'Expired permanently' });
      }

      expect(authFailureCallCount).toBe(1);
    });
  });
});
