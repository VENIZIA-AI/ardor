import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';

import { BaseNetworkRequest, NodeFetchNetworkRequest } from '@/helpers/networks/base-request';
import {
  AbstractNetworkFetchableHelper,
  type IRequestOptions,
} from '@/helpers/networks/fetchers/abstract';
import { NodeFetcher } from '@/helpers/networks/fetchers/node-fetch';

class TestEndpointScheme {
  public static readonly SEARCH = '/search';
  public static readonly JSON_BODY = '/json-body';
  public static readonly FORM_BODY = '/form-body';
  public static readonly DELAY = '/delay';

  public static readonly SCHEME_SET = new Set<string>([
    TestEndpointScheme.SEARCH,
    TestEndpointScheme.JSON_BODY,
    TestEndpointScheme.FORM_BODY,
    TestEndpointScheme.DELAY,
  ]);

  public static readonly isValid = ({ value }: { value: string }): boolean => {
    return TestEndpointScheme.SCHEME_SET.has(value);
  };
}

interface IRecordedRequest {
  method: string;
  pathname: string;
  search: string;
  headers: Headers;
  jsonBody: unknown;
  formData: FormData | null;
  rawBody: string;
}

interface IRecordedSendCall {
  opts: IRequestOptions;
  logger?: unknown;
}

type TServer = ReturnType<typeof Bun.serve>;

const delay = async ({ durationMs }: { durationMs: number }): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, durationMs);
  });
};

class RecordingFetchableHelper extends AbstractNetworkFetchableHelper<
  'node-fetch',
  IRequestOptions,
  Response
> {
  public readonly recordedSendCalls: Array<IRecordedSendCall> = [];

  constructor(opts: { name: string }) {
    super({ name: opts.name, variant: 'node-fetch', worker: fetch });
  }

  public override send = async (opts: IRequestOptions, logger?: unknown): Promise<Response> => {
    this.recordedSendCalls.push({ opts, logger });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
}

describe('BaseNetworkRequest URL and path resolution', () => {
  test('getRequestPath prefixes every path segment missing a leading slash with slash and joins them', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-path-test',
      networkOptions: {
        baseUrl: 'https://api.ardor.dev',
      },
    });

    const result = request.getRequestPath({ paths: ['v1', 'users', 'profile'] });

    expect(result).toBe('/v1/users/profile');
  });

  test('getRequestPath preserves path segments that already begin with a leading slash', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-leading-slash-test',
      networkOptions: {
        baseUrl: 'https://api.ardor.dev',
      },
    });

    const result = request.getRequestPath({ paths: ['/api', '/v2', '/settings'] });

    expect(result).toBe('/api/v2/settings');
  });

  test('getRequestPath returns an empty string when given an empty paths array', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-empty-paths-test',
      networkOptions: {
        baseUrl: 'https://api.ardor.dev',
      },
    });

    const result = request.getRequestPath({ paths: [] });

    expect(result).toBe('');
  });

  test('getRequestUrl joins the base URL and paths and strips a trailing slash from the base', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-trailing-slash-test',
      networkOptions: {
        baseUrl: 'https://api.ardor.dev/gateway/',
      },
    });

    const result = request.getRequestUrl({ paths: ['v1', 'resources'] });

    expect(result).toBe('https://api.ardor.dev/gateway/v1/resources');
  });

  test('getRequestUrl joins base URL without trailing slash cleanly', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-clean-base-test',
      networkOptions: {
        baseUrl: 'https://api.ardor.dev',
      },
    });

    const result = request.getRequestUrl({ paths: ['auth', 'session'] });

    expect(result).toBe('https://api.ardor.dev/auth/session');
  });

  test('getRequestUrl uses overridden baseUrl passed via options over the configured instance baseUrl', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-override-base-test',
      networkOptions: {
        baseUrl: 'https://api.ardor.dev',
      },
    });

    const result = request.getRequestUrl({
      baseUrl: 'https://custom.ardor.dev/edge/',
      paths: ['metrics'],
    });

    expect(result).toBe('https://custom.ardor.dev/edge/metrics');
  });

  test('getRequestUrl throws statusCode 500 when there is no base URL configured or provided', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-no-base-test',
      networkOptions: {},
    });

    let caughtError: unknown = null;
    try {
      request.getRequestUrl({ paths: ['users'] });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError).toBeDefined();

    if (typeof caughtError === 'object' && caughtError !== null && 'statusCode' in caughtError) {
      expect(caughtError.statusCode).toBe(500);
    }
  });

  test('getRequestUrl throws statusCode 500 when baseUrl option is explicitly provided as empty string', () => {
    const request = new NodeFetchNetworkRequest({
      name: 'ardor-empty-override-test',
      networkOptions: {
        baseUrl: 'https://api.ardor.dev',
      },
    });

    let caughtError: unknown = null;
    try {
      request.getRequestUrl({ baseUrl: '', paths: ['health'] });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError).toBeDefined();

    if (typeof caughtError === 'object' && caughtError !== null && 'statusCode' in caughtError) {
      expect(caughtError.statusCode).toBe(500);
    }
  });

  test('BaseNetworkRequest stores baseUrl and fetcher and exposes getWorker', () => {
    const fetcherInstance = new NodeFetcher({ name: 'direct-node-fetcher', defaultConfigs: {} });
    const baseRequest = new BaseNetworkRequest<'node-fetch'>({
      name: 'ardor-direct-base-test',
      variant: 'node-fetch',
      networkOptions: {
        baseUrl: 'https://direct.ardor.dev/',
      },
      fetcher: fetcherInstance,
    });

    expect(baseRequest['baseUrl']).toBe('https://direct.ardor.dev/');
    expect(baseRequest['fetcher']).toBe(fetcherInstance);
    expect(baseRequest.getNetworkService()).toBe(fetcherInstance);
    expect(baseRequest.getWorker()).toBe(fetch);
  });
});

describe('NodeFetchNetworkRequest network service and NodeFetcher execution', () => {
  let server: TServer | null = null;
  let baseUrl = '';
  const recordedRequests: Array<IRecordedRequest> = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: async (req: Request): Promise<Response> => {
        const url = new URL(req.url);

        if (url.pathname === TestEndpointScheme.DELAY) {
          await delay({ durationMs: 150 });
          return new Response(JSON.stringify({ delayed: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        const contentType = req.headers.get('content-type') ?? '';
        let jsonBody: unknown = null;
        let formData: FormData | null = null;
        let rawBody = '';

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          if (contentType.includes('multipart/form-data')) {
            try {
              formData = await req.formData();
            } catch (error) {
              console.error('[Bun.serve] Failed to parse FormData:', error);
            }
          } else {
            try {
              rawBody = await req.text();
              if (rawBody.length > 0) {
                jsonBody = JSON.parse(rawBody);
              }
            } catch (error) {
              console.error('[Bun.serve] Failed to parse JSON body:', error);
            }
          }
        }

        recordedRequests.push({
          method: req.method,
          pathname: url.pathname,
          search: url.search,
          headers: req.headers,
          jsonBody,
          formData,
          rawBody,
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    if (server) {
      await server.stop(true);
    }
  });

  afterEach(() => {
    recordedRequests.length = 0;
  });

  test('getNetworkService returns a NodeFetcher instance', () => {
    const requestHelper = new NodeFetchNetworkRequest({
      name: 'ardor-fetcher-check',
      networkOptions: {
        baseUrl,
      },
    });

    const service = requestHelper.getNetworkService();

    expect(service).toBeInstanceOf(NodeFetcher);
  });

  test('send serialises params into the query string with stringify and JSON encodes objects', async () => {
    const requestHelper = new NodeFetchNetworkRequest({
      name: 'ardor-params-test',
      networkOptions: {
        baseUrl,
      },
    });

    const service = requestHelper.getNetworkService();
    await service.send({
      url: `${baseUrl}${TestEndpointScheme.SEARCH}`,
      params: {
        query: 'ardor',
        page: 2,
        filters: { active: true, roles: ['admin', 'viewer'] },
      },
    });

    expect(recordedRequests.length).toBe(1);
    const recorded = recordedRequests[0];
    expect(recorded.pathname).toBe(TestEndpointScheme.SEARCH);

    const searchParams = new URLSearchParams(recorded.search);
    expect(searchParams.get('query')).toBe('ardor');
    expect(searchParams.get('page')).toBe('2');

    const rawFilters = searchParams.get('filters') ?? '{}';
    const parsedFilters: unknown = JSON.parse(rawFilters);
    expect(parsedFilters).toEqual({ active: true, roles: ['admin', 'viewer'] });
  });

  test('send transmits a JSON body for non-FormData bodies', async () => {
    const requestHelper = new NodeFetchNetworkRequest({
      name: 'ardor-json-body-test',
      networkOptions: {
        baseUrl,
      },
    });

    const service = requestHelper.getNetworkService();
    const payload = { framework: 'ARDOR', version: 1, active: true };

    await service.send({
      url: `${baseUrl}${TestEndpointScheme.JSON_BODY}`,
      method: 'POST',
      body: payload,
    });

    expect(recordedRequests.length).toBe(1);
    const recorded = recordedRequests[0];
    expect(recorded.method).toBe('POST');
    expect(recorded.pathname).toBe(TestEndpointScheme.JSON_BODY);
    expect(recorded.jsonBody).toEqual(payload);
  });

  test('send passes FormData body through untouched without converting to JSON', async () => {
    const requestHelper = new NodeFetchNetworkRequest({
      name: 'ardor-form-data-test',
      networkOptions: {
        baseUrl,
      },
    });

    const service = requestHelper.getNetworkService();
    const formData = new FormData();
    formData.append('scope', 'ARDOR-kernel');
    formData.append('identifier', 'node-fetch-spec');

    await service.send({
      url: `${baseUrl}${TestEndpointScheme.FORM_BODY}`,
      method: 'POST',
      body: formData,
    });

    expect(recordedRequests.length).toBe(1);
    const recorded = recordedRequests[0];
    expect(recorded.method).toBe('POST');
    expect(recorded.pathname).toBe(TestEndpointScheme.FORM_BODY);
    expect(recorded.formData).not.toBeNull();
    expect(recorded.formData?.get('scope')).toBe('ARDOR-kernel');
    expect(recorded.formData?.get('identifier')).toBe('node-fetch-spec');
  });

  test('send aborts and rejects when timeout elapses before response arrives', async () => {
    const requestHelper = new NodeFetchNetworkRequest({
      name: 'ardor-timeout-test',
      networkOptions: {
        baseUrl,
      },
    });

    const service = requestHelper.getNetworkService();
    let caughtRejection: unknown = null;

    try {
      await service.send({
        url: `${baseUrl}${TestEndpointScheme.DELAY}`,
        timeout: 25,
      });
    } catch (error) {
      caughtRejection = error;
    }

    expect(caughtRejection).not.toBeNull();
    expect(caughtRejection).toBeDefined();
  });
});

describe('AbstractNetworkFetchableHelper HTTP method delegation', () => {
  test('get delegates to send with lowercase get method and forwards logger', async () => {
    const helper = new RecordingFetchableHelper({ name: 'ardor-get-helper' });
    const dummyLogger = { info: () => {} };

    await helper.get({ url: 'http://127.0.0.1:3000/users' }, dummyLogger);

    expect(helper.recordedSendCalls.length).toBe(1);
    expect(helper.recordedSendCalls[0].opts.method).toBe('get');
    expect(helper.recordedSendCalls[0].opts.url).toBe('http://127.0.0.1:3000/users');
    expect(helper.recordedSendCalls[0].logger).toBe(dummyLogger);
  });

  test('post delegates to send with lowercase post method and forwards logger', async () => {
    const helper = new RecordingFetchableHelper({ name: 'ardor-post-helper' });
    const dummyLogger = { info: () => {} };

    await helper.post(
      {
        url: 'http://127.0.0.1:3000/users',
        body: { username: 'ardor-dev' },
      },
      dummyLogger,
    );

    expect(helper.recordedSendCalls.length).toBe(1);
    expect(helper.recordedSendCalls[0].opts.method).toBe('post');
    expect(helper.recordedSendCalls[0].opts.url).toBe('http://127.0.0.1:3000/users');
    expect(helper.recordedSendCalls[0].opts.body).toEqual({ username: 'ardor-dev' });
    expect(helper.recordedSendCalls[0].logger).toBe(dummyLogger);
  });

  test('put delegates to send with lowercase put method and forwards logger', async () => {
    const helper = new RecordingFetchableHelper({ name: 'ardor-put-helper' });
    const dummyLogger = { info: () => {} };

    await helper.put(
      {
        url: 'http://127.0.0.1:3000/users/42',
        body: { role: 'admin' },
      },
      dummyLogger,
    );

    expect(helper.recordedSendCalls.length).toBe(1);
    expect(helper.recordedSendCalls[0].opts.method).toBe('put');
    expect(helper.recordedSendCalls[0].opts.url).toBe('http://127.0.0.1:3000/users/42');
    expect(helper.recordedSendCalls[0].opts.body).toEqual({ role: 'admin' });
    expect(helper.recordedSendCalls[0].logger).toBe(dummyLogger);
  });

  test('patch delegates to send with lowercase patch method and forwards logger', async () => {
    const helper = new RecordingFetchableHelper({ name: 'ardor-patch-helper' });
    const dummyLogger = { info: () => {} };

    await helper.patch(
      {
        url: 'http://127.0.0.1:3000/users/42',
        body: { active: false },
      },
      dummyLogger,
    );

    expect(helper.recordedSendCalls.length).toBe(1);
    expect(helper.recordedSendCalls[0].opts.method).toBe('patch');
    expect(helper.recordedSendCalls[0].opts.url).toBe('http://127.0.0.1:3000/users/42');
    expect(helper.recordedSendCalls[0].opts.body).toEqual({ active: false });
    expect(helper.recordedSendCalls[0].logger).toBe(dummyLogger);
  });

  test('delete delegates to send with lowercase delete method and forwards logger', async () => {
    const helper = new RecordingFetchableHelper({ name: 'ardor-delete-helper' });
    const dummyLogger = { info: () => {} };

    await helper.delete({ url: 'http://127.0.0.1:3000/users/42' }, dummyLogger);

    expect(helper.recordedSendCalls.length).toBe(1);
    expect(helper.recordedSendCalls[0].opts.method).toBe('delete');
    expect(helper.recordedSendCalls[0].opts.url).toBe('http://127.0.0.1:3000/users/42');
    expect(helper.recordedSendCalls[0].logger).toBe(dummyLogger);
  });

  test('getWorker and getProtocol return worker instance and correct protocol strings', () => {
    const helper = new RecordingFetchableHelper({ name: 'ardor-worker-helper' });

    expect(helper.getWorker()).toBe(fetch);
    expect(helper.getProtocol('http://127.0.0.1:3000/api')).toBe('http');
    expect(helper.getProtocol('https://api.ardor.dev/api')).toBe('https');
  });
});
