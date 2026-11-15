import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { RejectionHelper } from '@venizia/dev-configs/testing';
import { isApplicationError } from '@venizia/ignis-inversion';

import { DefaultAuthService } from '@/base/services/auth';
import {
  DefaultNetworkRequestService,
  SESSION_CHANGED_CODE,
} from '@/base/services/network-request';
import { type IDataSourceRequestContext, RequestMethods, RequestTypes } from '@/common';
import { FakeStorage } from '@/testing';

const REFRESH_PATH = '/auth/refresh';
const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

describe('DefaultNetworkRequestService, a 401 that answers a request of a session that is gone', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = '';
  let itemsHook: (() => void) | undefined;
  const requested: Array<{ pathname: string; authorization: string | null }> = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: (req: Request): Response => {
        const url = new URL(req.url);
        requested.push({ pathname: url.pathname, authorization: req.headers.get('authorization') });

        if (url.pathname === REFRESH_PATH) {
          return Response.json({ token: { value: 'fresh', type: 'Bearer' } });
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

  const signIn = (opts: { userId: number; username: string; token: string }) => {
    authService.cleanUp();
    authService.saveAuth({
      userId: opts.userId,
      username: opts.username,
      token: { value: opts.token, type: 'Bearer' },
    });
  };

  beforeEach(() => {
    requested.length = 0;
    itemsHook = undefined;
    Object.defineProperty(globalThis, 'localStorage', {
      value: new FakeStorage(),
      configurable: true,
      writable: true,
    });
    authService = new DefaultAuthService();
    signIn({ userId: 7, username: 'alice', token: 'stale' });
  });

  afterEach(() => {
    if (originalLocal) {
      Object.defineProperty(globalThis, 'localStorage', originalLocal);
    }
  });

  const createService = (): DefaultNetworkRequestService => {
    return new DefaultNetworkRequestService({
      name: 'session-switch-test',
      baseUrl,
      authRecovery: { refreshTokenPath: REFRESH_PATH },
      authService,
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

  const refreshes = () => requested.filter((entry) => entry.pathname === REFRESH_PATH);

  const contextOf = (): IDataSourceRequestContext => ({ paths: ['orders'] });

  describe('through doRequest', () => {
    test('another user signed in meanwhile: the error says the session changed, no refresh, the new session stays', async () => {
      itemsHook = () => signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      const error = await RejectionHelper.rejectionOf({ task: getItems(createService()) });

      expect(isApplicationError(error)).toBe(true);
      expect(error).toMatchObject({ statusCode: 401 });
      expect(isApplicationError(error) ? error.normalized.code : undefined).toBe(
        SESSION_CHANGED_CODE,
      );
      expect(refreshes()).toEqual([]);
      expect(authService.getAuth()?.value).toBe('bob-token');
    });

    test('the same user signed in again meanwhile: the retry uses the new token, with no refresh', async () => {
      itemsHook = () => signIn({ userId: 7, username: 'alice', token: 'fresh' });

      const response = await getItems(createService());

      expect(response.data).toEqual({ data: 'ok' });
      expect(refreshes()).toEqual([]);
      expect(authService.getAuth()?.value).toBe('fresh');
    });

    test('the session that sent is still signed in: the 401 refreshes and retries as before', async () => {
      const response = await getItems(createService());

      expect(refreshes()).toHaveLength(1);
      expect(response.data).toEqual({ data: 'ok' });
    });
  });

  describe('through the data source hooks', () => {
    test('another user signed in between the send and the 401: no refresh and no retry', async () => {
      const auth = createService().getDataSourceAuth();
      const context = contextOf();

      auth.authTokenResolver(context);
      signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      const result = await auth.onUnauthorized(context);
      expect(result).toBe(false);
      expect(refreshes()).toEqual([]);
      expect(authService.getAuth()?.value).toBe('bob-token');
    });

    test('the same user holds another token now: retry with it, no refresh', async () => {
      const auth = createService().getDataSourceAuth();
      const context = contextOf();

      auth.authTokenResolver(context);
      signIn({ userId: 7, username: 'alice', token: 'fresh' });

      const result2 = await auth.onUnauthorized(context);
      expect(result2).toBe(true);
      expect(refreshes()).toEqual([]);
    });

    test('the same user signed out and nobody signed in: no refresh, no retry', async () => {
      const auth = createService().getDataSourceAuth();
      const context = contextOf();

      auth.authTokenResolver(context);
      authService.cleanUp();

      const result3 = await auth.onUnauthorized(context);
      expect(result3).toBe(false);
      expect(refreshes()).toEqual([]);
    });

    test('the session that sent is still signed in: the 401 joins the shared refresh', async () => {
      const auth = createService().getDataSourceAuth();
      const context = contextOf();

      auth.authTokenResolver(context);

      const result4 = await auth.onUnauthorized(context);
      expect(result4).toBe(true);
      expect(refreshes()).toHaveLength(1);
      expect(authService.getAuth()?.value).toBe('fresh');
    });

    test('a request that was never sent through the hooks is judged as before', async () => {
      const auth = createService().getDataSourceAuth();

      const result5 = await auth.onUnauthorized(contextOf());
      expect(result5).toBe(true);
      expect(refreshes()).toHaveLength(1);
    });
  });
});
