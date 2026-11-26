import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { RejectionUtility } from '@venizia/dev-configs/testing';

import { DefaultAuthService } from '@/base/services/auth';
import { DefaultNetworkRequestService } from '@/base/services/network-request';
import { RequestMethods, RequestTypes } from '@/common';
import { FakeStorage } from '@/testing';
import { LogWatch } from '../../log-watch';

afterEach(() => LogWatch.restore());

interface IRecorded {
  method: string;
  pathname: string;
  authorization: string | null;
  provider: string | null;
  body: string;
  headers: Record<string, string>;
}

const REFRESH_PATH = '/auth/refresh';
const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

describe('DefaultNetworkRequestService default token refresh', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = '';
  let refreshAnswer: () => Response;
  let itemsHook: (() => void) | undefined;
  const recorded: Array<IRecorded> = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: async (req: Request): Promise<Response> => {
        const url = new URL(req.url);
        const body = await req.text();
        recorded.push({
          method: req.method,
          pathname: url.pathname,
          authorization: req.headers.get('authorization'),
          provider: req.headers.get('x-auth-provider'),
          body,
          headers: Object.fromEntries(req.headers),
        });

        if (url.pathname === REFRESH_PATH) {
          return refreshAnswer();
        }

        itemsHook?.();

        return req.headers.get('authorization') === 'Bearer fresh'
          ? Response.json({ data: 'ok' })
          : Response.json({ error: 'expired' }, { status: 401 });
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.stop(true);
  });

  let authService: DefaultAuthService;

  beforeEach(() => {
    recorded.length = 0;
    itemsHook = undefined;
    refreshAnswer = () =>
      Response.json({
        token: { value: 'fresh', type: 'Bearer' },
        userId: 7,
        roles: [{ identifier: 'ignored' }],
      });
    Object.defineProperty(globalThis, 'localStorage', {
      value: new FakeStorage(),
      configurable: true,
      writable: true,
    });
    authService = new DefaultAuthService();
    authService.saveAuth({
      userId: 7,
      username: 'alice',
      provider: 'ldap',
      referenceId: 'ref-1',
      token: { value: 'stale', type: 'Bearer' },
      roles: ['admin', 'editor'],
    });
  });

  afterEach(() => {
    if (originalLocal) {
      Object.defineProperty(globalThis, 'localStorage', originalLocal);
    }
  });

  const createService = (
    opts: { refreshTokenPath?: string; withAuthService?: boolean } = {},
  ): DefaultNetworkRequestService => {
    const { refreshTokenPath = REFRESH_PATH, withAuthService = true } = opts;

    return new DefaultNetworkRequestService({
      name: 'refresh-test',
      baseUrl,
      authRecovery: { refreshTokenPath },
      authService: withAuthService ? authService : undefined,
    });
  };

  const getItems = (service: DefaultNetworkRequestService) => {
    return service.doRequest<{ data: string }>({
      paths: ['items'],
      method: RequestMethods.GET,
      type: RequestTypes.GET_ONE,
      headers: service.getRequestHeader({ resource: 'items' }),
    });
  };

  test('a 401 refreshes through refreshTokenPath with no body and the old token, then retries with the new one', async () => {
    const response = await getItems(createService());

    expect(response.data).toEqual({ data: 'ok' });
    const refreshes = recorded.filter((entry) => entry.pathname === REFRESH_PATH);
    expect(refreshes).toHaveLength(1);
    expect(refreshes[0]).toMatchObject({
      method: 'POST',
      authorization: 'Bearer stale',
      body: '',
    });
    expect(recorded.at(-1)).toMatchObject({ pathname: '/items', authorization: 'Bearer fresh' });
    expect(authService.getAuth()?.value).toBe('fresh');
  });

  test('keeps the roles, the identity and the provider header of the session', async () => {
    await getItems(createService());

    expect(authService.getRoles()).toEqual(new Set(['admin', 'editor']));
    expect(authService.getUser()).toEqual({
      userId: 7,
      username: 'alice',
      referenceId: 'ref-1',
      provider: 'ldap',
    });
    expect(recorded.at(-1)?.provider).toBe('ldap');
  });

  test('keeps the same user whatever id the response names, and reads the token as a plain string', async () => {
    refreshAnswer = () => Response.json({ token: 'fresh', userId: 9 });

    await getItems(createService());

    expect(authService.getUser().userId).toBe(7);
    expect(authService.getRoles()).toEqual(new Set(['admin', 'editor']));
    expect(authService.getAuth()).toMatchObject({ value: 'fresh', type: 'Bearer' });
  });

  test('a sign-out during the refresh saves no token, and the 401 stands', async () => {
    refreshAnswer = () => {
      authService.cleanUp();

      return Response.json({ token: 'fresh' });
    };

    const error = await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(authService.getAuth()).toBeNull();
    expect(authService.getUser()).toEqual({});
  });

  test('the answer belongs to the session that asked: another user signed in meanwhile gets no token', async () => {
    const logged = LogWatch.on({ scope: 'DefaultNetworkRequestService', method: 'warn' });

    refreshAnswer = () => {
      authService.cleanUp();
      authService.saveAuth({
        userId: 8,
        username: 'bob',
        token: { value: 'bob-token', type: 'Bearer' },
      });

      return Response.json({ token: 'fresh' });
    };

    const error = await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(authService.getAuth()?.value).toBe('bob-token');
    expect(authService.getUser()).toMatchObject({ userId: 8, username: 'bob' });

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('its answer is dropped'));
  });

  test('the same user signed in again meanwhile keeps the new session, not the old refresh', async () => {
    const logged = LogWatch.on({ scope: 'DefaultNetworkRequestService', method: 'warn' });

    refreshAnswer = () => {
      authService.cleanUp();
      authService.saveAuth({
        userId: 7,
        username: 'alice',
        token: { value: 'second-login', type: 'Bearer' },
      });

      return Response.json({ token: 'fresh' });
    };

    await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(authService.getAuth()?.value).toBe('second-login');

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('its answer is dropped'));
  });

  test('a token saved by another tab meanwhile is not overwritten', async () => {
    const logged = LogWatch.on({ scope: 'DefaultNetworkRequestService', method: 'warn' });

    refreshAnswer = () => {
      authService.saveAuth({
        userId: 7,
        username: 'alice',
        token: { value: 'other-tab', type: 'Bearer' },
      });

      return Response.json({ token: 'fresh' });
    };

    await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(authService.getAuth()?.value).toBe('other-tab');

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('its answer is dropped'));
  });

  test('a refresh that fails after the session changed is not a failure of the new session', async () => {
    const failures: Array<number> = [];

    class FailureService extends DefaultNetworkRequestService {
      protected override onAuthFailure(): Promise<void> {
        failures.push(1);

        return Promise.resolve();
      }
    }
    const service = new FailureService({
      name: 'failing',
      baseUrl,
      authRecovery: { refreshTokenPath: REFRESH_PATH },
      authService,
    });

    refreshAnswer = () => {
      authService.cleanUp();
      authService.saveAuth({
        userId: 8,
        username: 'bob',
        token: { value: 'bob-token', type: 'Bearer' },
      });

      return new Response('nope', { status: 500 });
    };

    const error = await RejectionUtility.rejectionOf({ task: getItems(service) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(failures).toEqual([]);
    expect(authService.getAuth()?.value).toBe('bob-token');
  });

  test('another tab that refreshed the same user meanwhile: its token is used for the retry, nothing is overwritten', async () => {
    const logged = LogWatch.on({ scope: 'DefaultNetworkRequestService', method: 'warn' });

    refreshAnswer = () => {
      authService.saveAuth({
        userId: 7,
        username: 'alice',
        token: { value: 'fresh', type: 'Bearer' },
      });

      return Response.json({ token: 'from-this-refresh' });
    };

    const response = await getItems(createService());

    expect(response.data).toEqual({ data: 'ok' });
    expect(authService.getAuth()?.value).toBe('fresh');

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('its answer is dropped'));
  });

  test('a 401 that arrives after another user signed in starts no refresh and spares that session', async () => {
    itemsHook = () => {
      authService.cleanUp();
      authService.saveAuth({
        userId: 8,
        username: 'bob',
        token: { value: 'bob-token', type: 'Bearer' },
      });
    };

    const error = await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toEqual([]);
    expect(authService.getAuth()?.value).toBe('bob-token');
  });

  test('another user with the very same token is still another session', async () => {
    const logged = LogWatch.on({ scope: 'DefaultNetworkRequestService', method: 'warn' });

    refreshAnswer = () => {
      authService.cleanUp();
      authService.saveAuth({
        userId: 8,
        username: 'bob',
        token: { value: 'stale', type: 'Bearer' },
      });

      return Response.json({ token: 'fresh' });
    };

    await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(authService.getAuth()?.value).toBe('stale');
    expect(authService.getUser()).toMatchObject({ userId: 8 });

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('its answer is dropped'));
  });

  test('the same user id written as a string instead of a number is the same session', async () => {
    refreshAnswer = () => {
      authService.saveAuth({
        userId: '7',
        username: 'alice',
        token: { value: 'stale', type: 'Bearer' },
      });

      return Response.json({ token: 'fresh' });
    };

    const response = await getItems(createService());

    expect(response.data).toEqual({ data: 'ok' });
    expect(authService.getAuth()?.value).toBe('fresh');
  });

  test('a refresh request that is answered 401 does not start another refresh', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });

    refreshAnswer = () => Response.json({ error: 'expired' }, { status: 401 });

    const error = await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(1);
    expect(authService.getAuth()?.value).toBe('stale');

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: 'HTTP 401' }),
    );
  });

  test('without refreshTokenPath the 401 stands and no refresh is sent', async () => {
    const service = new DefaultNetworkRequestService({ name: 'no-path', baseUrl, authService });
    const error = await RejectionUtility.rejectionOf({ task: getItems(service) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(0);
    expect(authService.getAuth()?.value).toBe('stale');
  });

  test('without an auth service the 401 stands and no refresh is sent', async () => {
    const service = createService({ withAuthService: false });
    const error = await RejectionUtility.rejectionOf({ task: getItems(service) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(0);
  });

  test('a failed refresh leaves the session as it was and runs onAuthFailure once', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });

    const failures: Array<number> = [];

    class FailureService extends DefaultNetworkRequestService {
      protected override onAuthFailure(): Promise<void> {
        failures.push(1);

        return Promise.resolve();
      }
    }
    const service = new FailureService({
      name: 'failing',
      baseUrl,
      authRecovery: { refreshTokenPath: REFRESH_PATH },
      authService,
    });
    refreshAnswer = () => new Response('nope', { status: 500 });
    const error = await RejectionUtility.rejectionOf({ task: getItems(service) });

    expect(error).toMatchObject({ statusCode: 401 });

    expect(failures).toHaveLength(1);
    expect(authService.getAuth()?.value).toBe('stale');
    expect(authService.getRoles()).toEqual(new Set(['admin', 'editor']));

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: 'HTTP 500' }),
    );
  });

  test('a response without a token is a failed refresh', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });

    refreshAnswer = () => Response.json({ userId: 7 });
    const error = await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });

    expect(authService.getAuth()?.value).toBe('stale');

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: '[refreshToken] The refresh response carries no token' }),
    );
  });

  test('a burst of 401s makes one refresh, and a subscriber of the auth service hears it once', async () => {
    const heard: Array<number> = [];
    const stop = authService.subscribe({ listener: () => heard.push(1) });
    const service = createService();

    await Promise.all([getItems(service), getItems(service), getItems(service)]);
    stop();

    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(1);
    expect(heard).toHaveLength(1);
  });

  test('a retry that answers 401 again is thrown: one refresh, one retry, no second refresh', async () => {
    // The refresh succeeds, but the server still refuses the token it handed out.
    refreshAnswer = () =>
      Response.json({ token: { value: 'still-bad', type: 'Bearer' }, userId: 7 });
    const error = await RejectionUtility.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });

    expect(recorded.map((entry) => [entry.pathname, entry.authorization])).toEqual([
      ['/items', 'Bearer stale'],
      [REFRESH_PATH, 'Bearer stale'],
      ['/items', 'Bearer still-bad'],
    ]);
    expect(authService.getAuth()?.value).toBe('still-bad');
  });

  test('a failed refresh ends the session when the application clears it in onAuthFailure', async () => {
    const logged = LogWatch.on({ scope: 'AuthRecoveryHelper', method: 'error' });

    const heard: Array<boolean> = [];
    const stop = authService.subscribe({ listener: () => heard.push(!!authService.getAuth()) });

    class EndingService extends DefaultNetworkRequestService {
      protected override onAuthFailure(): Promise<void> {
        authService.cleanUp();

        return Promise.resolve();
      }
    }
    const service = new EndingService({
      name: 'ending',
      baseUrl,
      authRecovery: { refreshTokenPath: REFRESH_PATH },
      authService,
    });
    refreshAnswer = () => new Response('nope', { status: 500 });
    const error = await RejectionUtility.rejectionOf({ task: getItems(service) });
    stop();

    expect(error).toMatchObject({ statusCode: 401 });

    expect(authService.getAuth()).toBeNull();
    expect(authService.getRoles()).toEqual(new Set());
    expect(Object.keys(localStorage)).toEqual([]);
    expect(heard).toEqual([false]);
    // The request that failed is not retried.
    expect(recorded.filter((entry) => entry.pathname === '/items')).toHaveLength(1);

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('[refresh] refreshToken failed'),
      expect.objectContaining({ message: 'HTTP 500' }),
    );
  });

  describe('the retry of a call with no headers', () => {
    const itemsRequests = () => recorded.filter((entry) => entry.pathname === '/items');

    test('a JSON body keeps its content type and the service headers on the retry', async () => {
      const service = new DefaultNetworkRequestService({
        name: 'retry-headers',
        baseUrl,
        headers: { 'X-Static': 'static-1' },
        authRecovery: { refreshTokenPath: REFRESH_PATH },
        authService,
      });
      service.setHeaders({ headers: { 'x-tenant': 't-1' } });

      await service.doRequest({
        paths: ['items'],
        method: RequestMethods.POST,
        type: RequestTypes.CREATE,
        body: JSON.stringify({ title: 'a' }),
      });

      const [first, retry] = itemsRequests();
      expect(itemsRequests()).toHaveLength(2);
      expect(retry!.authorization).toBe('Bearer fresh');
      expect(retry!.headers['content-type']).toBe(first!.headers['content-type']);
      expect(retry!.headers['content-type']).toContain('application/json');
      expect(retry!.headers['x-static']).toBe('static-1');
      expect(retry!.headers['x-tenant']).toBe('t-1');
      expect(retry!.body).toBe('{"title":"a"}');
    });

    test('a FormData body is sent again with a multipart boundary', async () => {
      const service = createService();
      const body = new FormData();
      body.append('name', 'a');

      await service.doRequest({
        paths: ['items'],
        method: RequestMethods.POST,
        type: RequestTypes.CREATE,
        body,
      });

      const [, retry] = itemsRequests();
      expect(itemsRequests()).toHaveLength(2);
      expect(retry!.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
      expect(retry!.body).toContain('name="name"');
    });

    test('a fresh token with no provider removes the provider the call carried', async () => {
      class NoProviderService extends DefaultNetworkRequestService {
        override getRequestAuthorizationHeader() {
          return { token: 'Bearer fresh', provider: undefined };
        }
      }
      const service = new NoProviderService({
        name: 'retry-provider',
        baseUrl,
        authRecovery: { refreshTokenPath: REFRESH_PATH },
        authService,
      });

      await service.doRequest({
        paths: ['items'],
        method: RequestMethods.GET,
        type: RequestTypes.GET_ONE,
        headers: { authorization: 'Bearer stale', 'x-auth-provider': 'ldap' },
      });

      const [first, retry] = itemsRequests();
      expect(itemsRequests()).toHaveLength(2);
      expect(first!.provider).toBe('ldap');
      expect(retry!.authorization).toBe('Bearer fresh');
      expect(retry!.provider).toBeNull();
    });

    test('a ReadableStream body is refused with a clear error, not an unclear TypeError', async () => {
      const service = createService();
      const body = new ReadableStream({
        start: (controller) => {
          controller.enqueue(new TextEncoder().encode('payload'));
          controller.close();
        },
      });

      const error = await RejectionUtility.rejectionOf({
        task: service.doRequest({
          paths: ['items'],
          method: RequestMethods.POST,
          type: RequestTypes.CREATE,
          body,
        }),
      });

      expect(error instanceof Error ? error.message : '').toContain(
        'a ReadableStream body cannot be sent a second time',
      );
      expect(itemsRequests()).toHaveLength(1);
      expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(1);
    });
  });
});
