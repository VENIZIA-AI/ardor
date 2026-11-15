import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { RejectionHelper } from '@venizia/dev-configs/testing';
import { HttpDataSource } from '@venizia/ignis-connectors/http';
import { getError, isApplicationError } from '@venizia/ignis-inversion';

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
  let refreshHook: (() => void) | undefined;
  const requested: Array<{ pathname: string; authorization: string | null }> = [];

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch: (req: Request): Response => {
        const url = new URL(req.url);
        requested.push({ pathname: url.pathname, authorization: req.headers.get('authorization') });

        if (url.pathname === REFRESH_PATH) {
          refreshHook?.();

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
    refreshHook = undefined;
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

  const codeOf = (error: unknown): string | undefined => {
    return isApplicationError(error) ? error.normalized.code : undefined;
  };

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

    test('the user signed out meanwhile and nobody signed in: the session changed, no refresh', async () => {
      itemsHook = () => authService.cleanUp();

      const error = await RejectionHelper.rejectionOf({ task: getItems(createService()) });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
      expect(refreshes()).toEqual([]);
    });

    test('another user signed in while the refresh was in flight: the session changed, the new session stays', async () => {
      refreshHook = () => signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      const error = await RejectionHelper.rejectionOf({ task: getItems(createService()) });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
      expect(authService.getAuth()?.value).toBe('bob-token');
    });

    test('a refreshToken override that answers true after another user signed in replays nothing', async () => {
      class CustomService extends DefaultNetworkRequestService {
        protected override async refreshToken(): Promise<boolean> {
          signIn({ userId: 8, username: 'bob', token: 'fresh' });

          return true;
        }
      }
      const service = new CustomService({
        name: 'session-switch-custom',
        baseUrl,
        authRecovery: { refreshTokenPath: REFRESH_PATH },
        authService,
      });

      const error = await RejectionHelper.rejectionOf({ task: getItems(service) });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
      expect(requested.filter((entry) => entry.authorization === 'Bearer fresh')).toEqual([]);
    });

    describe('a refresh that fails and ends the session itself', () => {
      class EndingService extends DefaultNetworkRequestService {
        protected override refreshToken(): Promise<boolean> {
          return Promise.reject(getError({ message: 'refresh refused' }));
        }

        protected override onAuthFailure(): Promise<void> {
          authService.cleanUp();

          return Promise.resolve();
        }
      }
      const createEnding = () =>
        new EndingService({
          name: 'session-switch-ending',
          baseUrl,
          authRecovery: { refreshTokenPath: REFRESH_PATH },
          authService,
        });

      test('through doRequest the 401 stands, so the provider sends the user to sign-in', async () => {
        const error = await RejectionHelper.rejectionOf({ task: getItems(createEnding()) });

        expect(isApplicationError(error)).toBe(true);
        expect(codeOf(error)).not.toBe(SESSION_CHANGED_CODE);
        expect(authService.getAuth()).toBeNull();
      });

      test('through the data source hooks the refresh answers false, not a session change', async () => {
        const auth = createEnding().getDataSourceAuth();
        const context = contextOf();

        expect(auth.authTokenResolver(context)?.value).toBe('stale');
        const isRefreshed = await auth.onUnauthorized(context);

        expect(isRefreshed).toBe(false);
      });
    });

    test('a 401 of a no-auth path is not a session change, whoever signed out meanwhile', async () => {
      itemsHook = () => authService.cleanUp();
      const service = new DefaultNetworkRequestService({
        name: 'session-switch-no-auth',
        baseUrl,
        noAuthPaths: ['items'],
        authRecovery: { refreshTokenPath: REFRESH_PATH },
        authService,
      });

      const error = await RejectionHelper.rejectionOf({ task: getItems(service) });

      expect(isApplicationError(error)).toBe(true);
      expect(codeOf(error)).not.toBe(SESSION_CHANGED_CODE);
    });
  });

  describe('a service that has no auth service, so it cannot tell who is signed in', () => {
    const createBare = (opts: { refreshes?: boolean } = {}) => {
      class BareService extends DefaultNetworkRequestService {
        protected override refreshToken(): Promise<boolean> {
          signIn({ userId: 7, username: 'alice', token: 'fresh' });

          return Promise.resolve(true);
        }
      }
      const options = {
        name: 'session-switch-bare',
        baseUrl,
        authRecovery: { refreshTokenPath: REFRESH_PATH },
      };

      return opts.refreshes ? new BareService(options) : new DefaultNetworkRequestService(options);
    };

    test('another token in the store while the request was in flight is a session change, and nothing is replayed', async () => {
      itemsHook = () => signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      const error = await RejectionHelper.rejectionOf({ task: getItems(createBare()) });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
      expect(requested.filter((entry) => entry.authorization === 'Bearer bob-token')).toEqual([]);
      expect(requested.filter((entry) => entry.pathname !== REFRESH_PATH)).toHaveLength(1);
    });

    test('through the data source hooks the same switch is a session change, and the retry carries no token', async () => {
      const auth = createBare().getDataSourceAuth();
      const context = contextOf();

      expect(auth.authTokenResolver(context)?.value).toBe('stale');
      signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      const error = await RejectionHelper.rejectionOf({ task: auth.onUnauthorized(context) });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
      expect(auth.authTokenResolver(context)).toBeUndefined();
    });

    test('a token that its own refreshToken override saved is retried, as before', async () => {
      const response = await getItems(createBare({ refreshes: true }));

      expect(response.data).toEqual({ data: 'ok' });
      expect(requested.filter((entry) => entry.authorization === 'Bearer fresh')).toHaveLength(1);
    });

    test('through the data source hooks a refresh of its own is retried with the new token', async () => {
      const auth = createBare({ refreshes: true }).getDataSourceAuth();
      const context = contextOf();

      expect(auth.authTokenResolver(context)?.value).toBe('stale');
      const isRefreshed = await auth.onUnauthorized(context);

      expect(isRefreshed).toBe(true);
      expect(auth.authTokenResolver(context)?.value).toBe('fresh');
    });
  });

  describe('through the data source hooks', () => {
    test('another user signed in between the send and the 401: no refresh and no retry', async () => {
      const auth = createService().getDataSourceAuth();
      const context = contextOf();

      auth.authTokenResolver(context);
      signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      const error = await RejectionHelper.rejectionOf({ task: auth.onUnauthorized(context) });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
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

      const error = await RejectionHelper.rejectionOf({ task: auth.onUnauthorized(context) });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
      expect(refreshes()).toEqual([]);
    });

    test('the retry of a request whose user is gone carries no token', () => {
      const auth = createService().getDataSourceAuth();
      const context = contextOf();

      expect(auth.authTokenResolver(context)?.value).toBe('stale');
      signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      expect(auth.authTokenResolver(context)).toBeUndefined();
    });

    test('through a real HttpDataSource the call rejects with the session-changed code, not the raw 401', async () => {
      const source = new HttpDataSource({
        name: 'session-switch-source',
        baseUrl,
        ...createService().getDataSourceAuth(),
      });
      itemsHook = () => signIn({ userId: 8, username: 'bob', token: 'bob-token' });

      const error = await RejectionHelper.rejectionOf({
        task: source.request({ paths: ['items'], method: 'GET' }),
      });

      expect(codeOf(error)).toBe(SESSION_CHANGED_CODE);
      expect(refreshes()).toEqual([]);
      expect(authService.getAuth()?.value).toBe('bob-token');
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
