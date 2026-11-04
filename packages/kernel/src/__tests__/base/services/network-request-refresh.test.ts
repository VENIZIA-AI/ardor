import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { RejectionHelper } from '@venizia/dev-configs/testing';

import { DefaultAuthService } from '@/base/services/auth';
import { DefaultNetworkRequestService } from '@/base/services/network-request';
import { RequestMethods, RequestTypes } from '@/common';

class StorageStub implements Storage {
  [name: string]: unknown;
  private readonly items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
}

interface IRecorded {
  method: string;
  pathname: string;
  authorization: string | null;
  provider: string | null;
  body: string;
}

const REFRESH_PATH = '/auth/refresh';
const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

describe('DefaultNetworkRequestService default token refresh', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = '';
  let refreshAnswer: () => Response;
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
        });

        if (url.pathname === REFRESH_PATH) {
          return refreshAnswer();
        }

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
    refreshAnswer = () =>
      Response.json({
        token: { value: 'fresh', type: 'Bearer' },
        userId: 7,
        roles: [{ identifier: 'ignored' }],
      });
    Object.defineProperty(globalThis, 'localStorage', {
      value: new StorageStub(),
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

  test('a refresh request that is answered 401 does not start another refresh', async () => {
    refreshAnswer = () => Response.json({ error: 'expired' }, { status: 401 });

    const error = await RejectionHelper.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(1);
    expect(authService.getAuth()?.value).toBe('stale');
  });

  test('without refreshTokenPath the 401 stands and no refresh is sent', async () => {
    const service = new DefaultNetworkRequestService({ name: 'no-path', baseUrl, authService });
    const error = await RejectionHelper.rejectionOf({ task: getItems(service) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(0);
    expect(authService.getAuth()?.value).toBe('stale');
  });

  test('without an auth service the 401 stands and no refresh is sent', async () => {
    const service = createService({ withAuthService: false });
    const error = await RejectionHelper.rejectionOf({ task: getItems(service) });

    expect(error).toMatchObject({ statusCode: 401 });
    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(0);
  });

  test('a failed refresh leaves the session as it was and runs onAuthFailure once', async () => {
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
    const error = await RejectionHelper.rejectionOf({ task: getItems(service) });

    expect(error).toMatchObject({ statusCode: 401 });

    expect(failures).toHaveLength(1);
    expect(authService.getAuth()?.value).toBe('stale');
    expect(authService.getRoles()).toEqual(new Set(['admin', 'editor']));
  });

  test('a response without a token is a failed refresh', async () => {
    refreshAnswer = () => Response.json({ userId: 7 });
    const error = await RejectionHelper.rejectionOf({ task: getItems(createService()) });

    expect(error).toMatchObject({ statusCode: 401 });

    expect(authService.getAuth()?.value).toBe('stale');
  });

  test('a burst of 401s makes one refresh, and a subscriber of the auth service hears it once', async () => {
    const heard: Array<number> = [];
    authService.subscribe({ listener: () => heard.push(1) });
    const service = createService();

    await Promise.all([getItems(service), getItems(service), getItems(service)]);

    expect(recorded.filter((entry) => entry.pathname === REFRESH_PATH)).toHaveLength(1);
    expect(heard).toHaveLength(1);
  });
});
