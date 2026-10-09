import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { getError, isApplicationError } from '@venizia/ignis-inversion';

import { HttpDataSource, HttpExtraRequest, HttpRepository } from '@/base/repositories';
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
  type TRequestMethod,
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

    /**
     * Header names are case-insensitive, and the record is keyed by lowercase name so an override
     * replaces instead of joining. Removal has to follow the same rule, or a header set as
     * `X-Tenant` is stored as `x-tenant` and `removeHeaders(['X-Tenant'])` quietly removes nothing.
     */
    test('removes a header whatever case it was set or named in', () => {
      const service = createService();

      service.setHeaders({ 'X-Tenant': 'acme', 'x-locale': 'vi' });
      service.removeHeaders(['X-Tenant']);
      expect(service['headers']).toEqual({ 'x-locale': 'vi' });

      service.removeHeaders(['X-LOCALE']);
      expect(service['headers']).toEqual({});
    });

    test('a setHeaders override in another case replaces the stored value', () => {
      const service = createService({ headers: { 'x-tenant': 'north' } });

      service.setHeaders({ 'X-Tenant': 'south' });

      expect(service['headers']).toEqual({ 'x-tenant': 'south' });
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

    /**
     * Every request carries `x-request-id`, and it used to be built with `crypto.randomUUID`.
     *
     * That method is secure-context-only: on `http://<lan-ip>` - how a phone reaches a dev server -
     * it is `undefined`, so building the header threw and NO request was sent. `getRandomValues` has
     * no such restriction. The method is shadowed here rather than assumed absent, and the shadowing
     * is asserted, so this cannot pass because the environment happened to be kind.
     */
    test('builds a request id off a secure context, where randomUUID does not exist', () => {
      // `randomUUID` lives on `Crypto.prototype`, so deleting it off the instance does nothing - it
      // is shadowed with an own `undefined` instead, and removing that own key restores the real one.
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
      // eslint-disable-next-line no-restricted-syntax -- reads the property to prove it is shadowed; never calls it
      expect(crypto.randomUUID).toBeUndefined();

      try {
        const props = createService({ useAuth: false }).getRequestProps({
          resource: 'items',
          applicationInfo: createApplicationInfo({ name: 'ardor-core' }),
          restDataProviderOptions: createRestDataProviderOptions(),
        });

        const tracingId = (props.headers as Record<string, string>)[
          HeaderConsts.REQUEST_TRACING_ID
        ];

        expect(tracingId).toMatch(
          /^ardor-core_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      } finally {
        Reflect.deleteProperty(crypto, 'randomUUID');
        // eslint-disable-next-line no-restricted-syntax -- reads the property to prove the real one is restored
        expect(typeof crypto.randomUUID).toBe('function');
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

    test('builds FormData with File and File array entries, skipping undefined and null', () => {
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

    test('refuses a file in a form-urlencoded body instead of losing it', () => {
      const service = createService({ useAuth: false });

      // There is no encoding that would have made this work: url-encoded carries text. Silently
      // sending "{}" or "[object Blob]" loses the upload and tells nobody.
      expect(() =>
        service.getRequestProps({
          resource: 'upload',
          bodyType: RequestBodyTypes.FORM_URL_ENCODED,
          body: { attachment: new File(['x'], 'note.txt', { type: 'text/plain' }) },
          applicationInfo: createApplicationInfo(),
          restDataProviderOptions: createRestDataProviderOptions(),
        }),
      ).toThrow(/attachment.*cannot carry.*form-data/s);
    });

    test('carries falsy values in a form-urlencoded body, and skips only undefined and null', () => {
      const service = createService({ useAuth: false });

      const props = service.getRequestProps({
        resource: 'oauth',
        bodyType: RequestBodyTypes.FORM_URL_ENCODED,
        body: {
          scope: 'read',
          remember: false,
          page: 0,
          note: '',
          nullVal: null,
          undefVal: undefined,
        },
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.body instanceof URLSearchParams).toBe(true);
      if (props.body instanceof URLSearchParams) {
        expect(props.body.get('scope')).toBe('read');
        expect(props.body.get('remember')).toBe('false');
        expect(props.body.get('page')).toBe('0');
        expect(props.body.get('note')).toBe('');
        expect(props.body.has('nullVal')).toBe(false);
        expect(props.body.has('undefVal')).toBe(false);
      }
    });

    test('carries text fields in a form-data body, and skips only undefined and null', () => {
      const service = createService({ useAuth: false });

      const props = service.getRequestProps({
        resource: 'upload',
        bodyType: RequestBodyTypes.FORM_DATA,
        body: {
          name: 'alpha',
          count: 0,
          flag: false,
          empty: '',
          nullVal: null,
          undefVal: undefined,
        },
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.body instanceof FormData).toBe(true);
      if (props.body instanceof FormData) {
        expect(props.body.get('name')).toBe('alpha');

        // A falsy value is a value. Skipping it silently drops `0`, `false` and `''` from the
        // request, and the server sees a field the caller believes it sent.
        expect(props.body.get('count')).toBe('0');
        expect(props.body.get('flag')).toBe('false');
        expect(props.body.get('empty')).toBe('');

        expect(props.body.has('nullVal')).toBe(false);
        expect(props.body.has('undefVal')).toBe(false);
      }
    });

    test('serialises a structured value instead of stringifying it to [object Object]', () => {
      const service = createService({ useAuth: false });

      const props = service.getRequestProps({
        resource: 'upload',
        bodyType: RequestBodyTypes.FORM_DATA,
        body: {
          meta: { locale: 'vi', tags: ['a', 'b'] },
          when: new Date('2026-09-16T07:30:00.000Z'),
        },
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.body instanceof FormData).toBe(true);
      if (props.body instanceof FormData) {
        // `String({})` is "[object Object]" - a value the server can only reject, sent with no
        // warning. JSON is the one encoding a multipart text part can carry losslessly.
        expect(props.body.get('meta')).toBe('{"locale":"vi","tags":["a","b"]}');

        // A Date stringifies to a locale- and timezone-dependent sentence. ISO is what an API reads.
        expect(props.body.get('when')).toBe('2026-09-16T07:30:00.000Z');
      }
    });

    test('mixes files and text in one form-data array', () => {
      const service = createService({ useAuth: false });
      const file = new File(['alpha'], 'note.txt', { type: 'text/plain' });

      const props = service.getRequestProps({
        resource: 'upload',
        bodyType: RequestBodyTypes.FORM_DATA,
        body: { items: [file, 'plain', 0] },
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.body instanceof FormData).toBe(true);
      if (props.body instanceof FormData) {
        const items = props.body.getAll('items');
        expect(items.length).toBe(3);
        expect(items[1]).toBe('plain');
        expect(items[2]).toBe('0');
      }
    });

    /**
     * This test used to assert that `emptyField: ''` was dropped, which is the bug the branch
     * carried rather than a decision anyone made: the same falsy check also dropped `0` and `false`.
     * An omitted field is `undefined`, and that is still skipped - the case below covers it.
     */
    test('encodes the body as application/x-www-form-urlencoded, keeping an empty string', () => {
      const service = createService({ useAuth: false });

      const props = service.getRequestProps({
        resource: 'oauth',
        bodyType: RequestBodyTypes.FORM_URL_ENCODED,
        body: {
          ['client_id']: 'client-123',
          ['grant_type']: 'authorization_code',
          emptyField: '',
          omittedField: undefined,
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
        expect(props.body.toString()).toBe(
          'client_id=client-123&grant_type=authorization_code&emptyField=',
        );
        expect(props.body.has('omittedField')).toBe(false);
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

    test('reads the total of an unsatisfied range and falls back to the row count on a malformed header', () => {
      const service = createService();
      const totalFor = (header: string) =>
        service.convertResponse<{ id: number }[]>({
          type: RequestTypes.GET_LIST,
          response: {
            data: [{ id: 1 }, { id: 2 }, { id: 3 }],
            headers: new Headers({ [HeaderConsts.CONTENT_RANGE]: header }),
          },
        }).total;

      expect(totalFor('records */137')).toBe(137);
      expect(totalFor('records */0')).toBe(0);
      expect(totalFor('records 0-24/*')).toBe(3);
      expect(totalFor('137')).toBe(3);
      expect(totalFor('')).toBe(3);
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

    const captureRequestError = async (opts: { paths: string[]; method?: TRequestMethod }) => {
      const service = createService({ baseUrl: serverBaseUrl });
      try {
        await service.doRequest({
          paths: opts.paths,
          method: opts.method ?? RequestMethods.GET,
          type: RequestTypes.GET_ONE,
        });
      } catch (err: unknown) {
        if (isApplicationError(err)) {
          return err;
        }
        throw err;
      }
      throw new Error('expected doRequest to throw');
    };

    test('throws an ApplicationError from the server envelope under the error root key', async () => {
      serverHandler = () => {
        return new Response(
          JSON.stringify({
            error: {
              statusCode: 409,
              message: 'Order already paid',
              normalized: {
                text: 'Order already paid',
                code: 'server.order.paid',
                args: { id: 7 },
              },
              requestId: 'req-1',
              extra: { transaction: 'tx-9' },
              details: { cause: [{ path: ['id'], message: 'paid' }] },
              type: 'ConflictError',
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        );
      };

      const err = await captureRequestError({ paths: ['orders', '7'] });

      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe('Order already paid');
      expect(err.normalized).toEqual({
        text: 'Order already paid',
        code: 'server.order.paid',
        args: { id: 7 },
      });
      expect(err.extra).toEqual({ transaction: 'tx-9', requestId: 'req-1' });
      expect(err.cause).toEqual([{ path: ['id'], message: 'paid' }]);
    });

    test('reads a body without the error root key, keeping only the envelope fields', async () => {
      serverHandler = () => {
        return new Response(JSON.stringify({ message: 'Validation failed', field: 'email' }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        });
      };

      const err = await captureRequestError({ paths: ['validate'], method: RequestMethods.POST });

      expect(err.statusCode).toBe(422);
      expect(err.message).toBe('Validation failed');
      expect(err.normalized.text).toBe('Validation failed');
      expect(err.extra).toBeUndefined();
    });

    test('answers HTTP <status> with the default code when the body is not JSON', async () => {
      serverHandler = () => {
        return new Response('<html>Bad Gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        });
      };

      const err = await captureRequestError({ paths: ['gateway'] });

      expect(err.statusCode).toBe(502);
      expect(err.message).toBe('HTTP 502');
      expect(err.normalized.code).toBe('core.system_error');
    });

    test('answers HTTP <status> for an empty body or a string error key', async () => {
      serverHandler = () => new Response(null, { status: 503 });
      const empty = await captureRequestError({ paths: ['empty'] });
      expect(empty.statusCode).toBe(503);
      expect(empty.message).toBe('HTTP 503');

      serverHandler = () => {
        return new Response(JSON.stringify({ error: 'Bad Gateway' }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        });
      };
      const stringKey = await captureRequestError({ paths: ['string-error'] });
      expect(stringKey.statusCode).toBe(502);
      expect(stringKey.message).toBe('HTTP 502');
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
        expect(
          isApplicationError(err) && { statusCode: err.statusCode, message: err.message },
        ).toEqual({
          statusCode: 401,
          message: 'HTTP 401',
        });
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
        expect(
          isApplicationError(err) && { statusCode: err.statusCode, message: err.message },
        ).toEqual({
          statusCode: 401,
          message: 'HTTP 401',
        });
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
        expect(
          isApplicationError(err) && { statusCode: err.statusCode, message: err.message },
        ).toEqual({
          statusCode: 401,
          message: 'HTTP 401',
        });
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
        expect(
          isApplicationError(err) && { statusCode: err.statusCode, message: err.message },
        ).toEqual({
          statusCode: 401,
          message: 'HTTP 401',
        });
      }

      expect(authFailureCallCount).toBe(1);
    });

    // A repository with its own refresh would race the data provider's: two refresh calls, and the
    // loser's token invalidated by the winner's on a server that rotates refresh tokens.
    test('an HttpDataSource given getDataSourceAuth() joins the same single refresh and retries with its token', async () => {
      let refreshCallCount = 0;
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'stale-token' });
      service.setAuthRecovery({
        refreshToken: async () => {
          refreshCallCount++;
          await delay({ milliseconds: 40 });
          service.setAuthToken({ value: 'fresh-token' });
        },
      });

      serverHandler = (opts: IServerHandlerOptions) => {
        if (opts.req.headers.get('authorization') !== 'Bearer fresh-token') {
          return Response.json({ error: 'expired' }, { status: 401 });
        }
        return Response.json([{ id: 'recovered' }]);
      };

      const tickets = new HttpRepository<{ id: string }>({
        dataSource: new HttpDataSource({ baseUrl: serverBaseUrl, ...service.getDataSourceAuth() }),
        resource: 'tickets',
      });

      const [viaProvider, viaRepository] = await Promise.all([
        service.doRequest<Array<{ id: string }>>({
          paths: ['orders'],
          method: RequestMethods.GET,
          type: RequestTypes.GET_ONE,
          headers: service.getRequestHeader({ resource: 'orders' }),
        }),
        tickets.find({ filter: {} }),
      ]);

      expect(refreshCallCount).toBe(1);
      expect(viaProvider.data).toEqual([{ id: 'recovered' }]);
      expect(viaRepository).toEqual([{ id: 'recovered' }]);
    });

    test('an HttpDataSource given getDataSourceAuth() lets the 401 stand when no refreshToken is configured', async () => {
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'stale-token' });

      serverHandler = () => Response.json({ error: 'expired' }, { status: 401 });

      const tickets = new HttpRepository<{ id: string }>({
        dataSource: new HttpDataSource({ baseUrl: serverBaseUrl, ...service.getDataSourceAuth() }),
        resource: 'tickets',
      });

      await expect(tickets.find({ filter: {} })).rejects.toMatchObject({ statusCode: 401 });
      expect(recordedRequests).toHaveLength(1);
      expect(recordedRequests[0].headers.authorization).toBe('Bearer stale-token');
    });
  });

  // A repository and the data provider call one server for one session: what the provider sends on
  // every call, a repository sends too, read when the request goes out rather than when the
  // datasource was built.
  describe('getDataSourceAuth', () => {
    const createRepository = (opts: {
      service: DefaultNetworkRequestService;
      resource: string;
      auth?: ReturnType<DefaultNetworkRequestService['getDataSourceAuth']>;
    }) => {
      const { service, resource, auth = service.getDataSourceAuth() } = opts;
      return new HttpRepository<{ id: string }>({
        dataSource: new HttpDataSource({ baseUrl: serverBaseUrl, ...auth }),
        resource,
      });
    };

    test('sends the session headers set after the datasource was built, and the timezone', async () => {
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'session-token' });
      serverHandler = () => Response.json([]);

      const orders = createRepository({ service, resource: 'orders' });

      service.setHeaders({ 'x-merchant-id': 'merchant-1', 'x-locale': 'vi' });
      await orders.find({ filter: {} });

      service.setHeaders({ 'x-merchant-id': 'merchant-2' });
      await orders.find({ filter: {} });

      expect(recordedRequests).toHaveLength(2);
      expect(recordedRequests[0].headers['x-merchant-id']).toBe('merchant-1');
      expect(recordedRequests[0].headers['x-locale']).toBe('vi');
      expect(recordedRequests[0].headers[HeaderConsts.TIMEZONE]).toBe(App.TIMEZONE);
      expect(recordedRequests[0].headers[HeaderConsts.TIMEZONE_OFFSET]).toBe(
        `${App.TIMEZONE_OFFSET}`,
      );
      expect(recordedRequests[1].headers['x-merchant-id']).toBe('merchant-2');
      expect(recordedRequests[0].headers.authorization).toBe('Bearer session-token');
    });

    test('sends the request channel and tracing id when given the data provider options', async () => {
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'session-token' });
      serverHandler = () => Response.json([]);

      const orders = createRepository({
        service,
        resource: 'orders',
        auth: service.getDataSourceAuth({
          restDataProviderOptions: createRestDataProviderOptions({
            requestTracingChannel: 'pos',
            requestTracingId: ({ applicationInfo }) => `${applicationInfo.name}-trace`,
          }),
          applicationInfo: createApplicationInfo({ name: 'kiosk' }),
        }),
      });

      await orders.find({ filter: {} });

      expect(recordedRequests[0].headers[HeaderConsts.REQUEST_CHANNEL]).toBe('pos');
      expect(recordedRequests[0].headers[HeaderConsts.REQUEST_TRACING_ID]).toBe('kiosk-trace');
    });

    test('sends no token to a no-auth route, and the token elsewhere', async () => {
      const service = createService({ baseUrl: serverBaseUrl, noAuthPaths: ['sign-in'] });
      service.setAuthToken({ value: 'session-token' });
      serverHandler = () => Response.json([]);

      await createRepository({ service, resource: 'sign-in' }).find({ filter: {} });
      await createRepository({ service, resource: 'orders' }).find({ filter: {} });

      expect(recordedRequests[0].pathname).toBe('/sign-in');
      expect(recordedRequests[0].headers.authorization).toBeUndefined();
      expect(recordedRequests[1].headers.authorization).toBe('Bearer session-token');
    });

    test('sends no token anywhere when the service does not use auth', async () => {
      const service = createService({ baseUrl: serverBaseUrl, useAuth: false });
      service.setAuthToken({ value: 'session-token' });
      serverHandler = () => Response.json([]);

      await createRepository({ service, resource: 'orders' }).find({ filter: {} });

      expect(recordedRequests[0].headers.authorization).toBeUndefined();
    });

    test('does not refresh on a 401 from a no-auth route', async () => {
      const service = createService({ baseUrl: serverBaseUrl, noAuthPaths: ['sign-in'] });
      service.setAuthToken({ value: 'session-token' });
      const refreshToken = mock(async () => {});
      service.setAuthRecovery({ refreshToken });
      serverHandler = () => Response.json({ error: 'bad credentials' }, { status: 401 });

      const signIn = createRepository({ service, resource: 'sign-in' });

      await expect(signIn.find({ filter: {} })).rejects.toMatchObject({ statusCode: 401 });
      expect(refreshToken).not.toHaveBeenCalled();
      expect(recordedRequests).toHaveLength(1);
    });

    test('keeps the server error code from under the `error` root key', async () => {
      const service = createService({ baseUrl: serverBaseUrl });
      service.setAuthToken({ value: 'session-token' });
      serverHandler = () =>
        Response.json(
          {
            error: {
              statusCode: 409,
              message: 'Name already taken',
              normalized: { code: 'user.name.taken', args: { name: 'an' } },
            },
          },
          { status: 409 },
        );

      await expect(
        createRepository({ service, resource: 'users' }).find({ filter: {} }),
      ).rejects.toMatchObject({
        statusCode: 409,
        normalized: { code: 'user.name.taken', args: { name: 'an' } },
      });
    });
  });

  // A route with extras answers `{ data, extra }`, marked by `x-response-extra`. One that declares a
  // DEFAULT extra answers it to every client, so the data provider must read it even unasked.
  describe('list extras', () => {
    const listRequest = (opts: {
      service: DefaultNetworkRequestService;
      requestCountData?: string;
    }) => {
      const { service, requestCountData } = opts;
      return service.doRequest<Array<Record<string, string>>>({
        paths: ['tickets'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_LIST,
        headers: service.getRequestHeader({ resource: 'tickets' }),
        requestCountData: requestCountData as never,
      });
    };

    test('asks for extras in x-request-extra', () => {
      const service = createService({ useAuth: false });

      const props = service.getRequestProps({
        resource: 'tickets',
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
        extra: { facets: ['status', 'tag'], stats: true },
      });

      expect(props.headers).toHaveProperty(
        HttpExtraRequest.HEADER,
        HttpExtraRequest.toHeader({ extra: { facets: ['status', 'tag'], stats: true } }),
      );
    });

    test('sends no x-request-extra when none is asked for', () => {
      const props = createService({ useAuth: false }).getRequestProps({
        resource: 'tickets',
        applicationInfo: createApplicationInfo(),
        restDataProviderOptions: createRestDataProviderOptions(),
      });

      expect(props.headers).not.toHaveProperty(HttpExtraRequest.HEADER);
    });

    test('unwraps a marked { data, extra } list, keeping the rows and the total', async () => {
      const service = createService({ baseUrl: serverBaseUrl, useAuth: false });
      serverHandler = () =>
        Response.json(
          { data: [{ id: 'a' }], extra: { stats: { open: 3 } } },
          { headers: { 'x-response-extra': 'stats', 'content-range': 'records 0-0/9' } },
        );

      const rs = await listRequest({ service });

      expect(rs.data).toEqual([{ id: 'a' }]);
      expect(rs.total).toBe(9);
      expect(rs.extra).toEqual({ stats: { open: 3 } });
    });

    test('keeps the count beside the rows when the count rides in the body', async () => {
      const service = createService({ baseUrl: serverBaseUrl, useAuth: false });
      serverHandler = () =>
        Response.json(
          { data: [{ id: 'a' }], count: 1, extra: { stats: { open: 3 } } },
          { headers: { 'x-response-extra': 'stats', 'content-range': 'records 0-0/9' } },
        );

      const rs = await listRequest({
        service,
        requestCountData: RequestCountData.DATA_WITH_COUNT,
      });

      expect(rs.data).toEqual([{ id: 'a' }]);
      expect(rs.count).toBe(1);
      expect(rs.extra).toEqual({ stats: { open: 3 } });
    });

    test('never reads an unmarked body as extras', async () => {
      const service = createService({ baseUrl: serverBaseUrl, useAuth: false });
      serverHandler = () =>
        Response.json([{ id: 'a', data: 'own column', extra: 'own column' }], {
          headers: { 'content-range': 'records 0-0/1' },
        });

      const rs = await listRequest({ service });

      expect(rs.data).toEqual([{ id: 'a', data: 'own column', extra: 'own column' }]);
      expect(rs.extra).toBeUndefined();
    });
  });
});
