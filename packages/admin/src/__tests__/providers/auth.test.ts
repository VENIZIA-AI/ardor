import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { type IAuthProvider } from '@/common';
import { DefaultAuthProvider } from '@/providers/auth';
import { DefaultRestDataProvider } from '@/providers/rest-data';
import {
  BaseArdorApplication,
  CoreBindings,
  DefaultAuthService,
  type IApplicationInfo,
  LocalStorageKeys,
} from '@venizia/ardor-kernel';

interface IRecordedRequest {
  readonly method: string;
  readonly pathname: string;
  readonly search: string;
  readonly headers: Headers;
  readonly body: unknown;
}

interface ITestAppContextOptions {
  readonly serverUrl: string;
}

interface ITestAppContext {
  readonly application: BaseArdorApplication;
  readonly authProvider: IAuthProvider;
}

type TServer = ReturnType<typeof Bun.serve>;

let server: TServer;
let whoamiReturnsData = true;
const recordedRequests: Array<IRecordedRequest> = [];

let application: BaseArdorApplication;
let authProvider: IAuthProvider;

const createTestApplication = async (options: ITestAppContextOptions): Promise<ITestAppContext> => {
  class TestApplication extends BaseArdorApplication {
    private readonly baseUrl: string;

    constructor(appOptions: { readonly baseUrl: string }) {
      super();
      this.baseUrl = appOptions.baseUrl;
    }

    override bindContext = (): void => {
      this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
        url: this.baseUrl,
        useAuth: true,
        noAuthPaths: ['/auth/login'],
      });

      this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({
        paths: { signIn: '/auth/login', checkAuth: '/auth/whoami' },
        endpoints: { afterLogin: '/dashboard' },
      });

      this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toClass(DefaultAuthService);
      this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(
        DefaultRestDataProvider,
      );
      this.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(DefaultAuthProvider);
    };

    override getAppInfo = (): IApplicationInfo => {
      return {
        name: 'test-admin',
        version: '1.0.0',
        description: 'test-admin description',
      };
    };
  }

  const app = new TestApplication({ baseUrl: options.serverUrl });
  await app.start();

  const provider = app.get<IAuthProvider>({
    key: CoreBindings.DEFAULT_AUTH_PROVIDER,
  });

  return { application: app, authProvider: provider };
};

const readStorageJson = (options: { readonly key: string }): unknown => {
  const item = localStorage.getItem(options.key);
  if (item === null || item.length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(item);
    return parsed;
  } catch (error) {
    console.error('Failed to parse localStorage JSON for key:', options.key, error);
    return null;
  }
};

const hasRedirectTo = (options: {
  readonly value: unknown;
}): options is { readonly value: { readonly redirectTo: string } } => {
  if (typeof options.value !== 'object' || options.value === null) {
    return false;
  }
  return 'redirectTo' in options.value && typeof options.value.redirectTo === 'string';
};

beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    fetch: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const text = await request.text();
      let body: unknown = null;
      if (text.length > 0) {
        try {
          const parsed: unknown = JSON.parse(text);
          body = parsed;
        } catch (error) {
          console.error('Failed to parse request JSON body in test server stub:', error);
        }
      }

      recordedRequests.push({
        method: request.method,
        pathname: url.pathname,
        search: url.search,
        headers: request.headers,
        body,
      });

      if (url.pathname === '/auth/login') {
        return Response.json({
          userId: 7,
          token: { value: 'jwt', type: 'Bearer' },
        });
      }

      if (url.pathname === '/auth/whoami') {
        if (whoamiReturnsData) {
          return Response.json({ id: 7 });
        }
        return Response.json(null);
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  const setupResult = await createTestApplication({
    serverUrl: `http://127.0.0.1:${server.port}`,
  });
  application = setupResult.application;
  authProvider = setupResult.authProvider;
});

afterAll(async () => {
  await server.stop(true);
});

beforeEach(() => {
  localStorage.clear();
  recordedRequests.length = 0;
  whoamiReturnsData = true;
});

describe('BaseArdorApplication container wiring', () => {
  test('binds application info during application start', () => {
    const appInfo = application.get<IApplicationInfo>({
      key: CoreBindings.APPLICATION_INFO,
    });
    expect(appInfo.name).toBe('test-admin');
    expect(appInfo.version).toBe('1.0.0');
  });

  test('resolves the auth provider from the container', () => {
    const provider = application.get<IAuthProvider>({
      key: CoreBindings.DEFAULT_AUTH_PROVIDER,
    });
    expect(provider).toBeDefined();
    expect(typeof provider.login).toBe('function');
    expect(typeof provider.logout).toBe('function');
    expect(typeof provider.checkAuth).toBe('function');
    expect(typeof provider.checkError).toBe('function');
    expect(typeof provider.getIdentity).toBe('function');
    expect(typeof provider.getPermissions).toBe('function');
    expect(typeof provider.getRoles).toBe('function');
    expect(typeof provider.refreshToken).toBe('function');
  });
});

describe('login', () => {
  test('posts credentials to the sign-in path and resolves with redirect path without double slashes', async () => {
    const loginResult: unknown = await authProvider.login({
      username: 'alice',
      password: 'secret-password',
    });

    expect(recordedRequests).toHaveLength(1);
    const loginRequest = recordedRequests[0];
    expect(loginRequest.pathname).toBe('/auth/login');
    expect(loginRequest.method).toBe('POST');
    expect(loginRequest.body).toEqual({
      username: 'alice',
      password: 'secret-password',
    });

    const loginOutcome = { value: loginResult };
    expect(hasRedirectTo(loginOutcome)).toBe(true);
    if (hasRedirectTo(loginOutcome)) {
      expect(loginOutcome.value.redirectTo).toBe('/dashboard');
    }
  });

  test('persists auth token and identity in localStorage via DefaultAuthService', async () => {
    await authProvider.login({
      username: 'alice',
      password: 'secret-password',
    });

    const storedToken = readStorageJson({ key: LocalStorageKeys.KEY_AUTH_TOKEN });
    expect(storedToken).toEqual({
      value: 'jwt',
      type: 'Bearer',
      provider: '',
    });

    const storedIdentity = readStorageJson({ key: LocalStorageKeys.KEY_AUTH_IDENTITY });
    expect(storedIdentity).toEqual({
      userId: 7,
      username: 'alice',
      referenceId: '',
      provider: '',
    });
  });
});

describe('checkAuth', () => {
  test('rejects with redirect to login when no token is stored', async () => {
    await expect(authProvider.checkAuth({})).rejects.toEqual({
      redirectTo: 'login',
    });
    expect(recordedRequests).toHaveLength(0);
  });

  test('calls whoami endpoint with stored token and resolves on truthy response body', async () => {
    await authProvider.login({
      username: 'alice',
      password: 'secret-password',
    });
    recordedRequests.length = 0;
    whoamiReturnsData = true;

    await expect(authProvider.checkAuth({})).resolves.toBeUndefined();

    expect(recordedRequests).toHaveLength(1);
    const whoamiRequest = recordedRequests[0];
    expect(whoamiRequest.pathname).toBe('/auth/whoami');
    expect(whoamiRequest.method).toBe('GET');
  });

  test('calls whoami endpoint with stored token and rejects to login on falsy response body', async () => {
    await authProvider.login({
      username: 'alice',
      password: 'secret-password',
    });
    recordedRequests.length = 0;
    whoamiReturnsData = false;

    await expect(authProvider.checkAuth({})).rejects.toEqual({
      redirectTo: 'login',
    });

    expect(recordedRequests).toHaveLength(1);
    const whoamiRequest = recordedRequests[0];
    expect(whoamiRequest.pathname).toBe('/auth/whoami');
    expect(whoamiRequest.method).toBe('GET');
  });
});

describe('checkError', () => {
  test('clears stored session and rejects with redirect to login on 401 status', async () => {
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: 'jwt', type: 'Bearer' }),
    );
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      JSON.stringify({ userId: 7, username: 'alice' }),
    );

    await expect(authProvider.checkError({ status: 401 })).rejects.toEqual({
      redirectTo: 'login',
    });

    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY)).toBeNull();
  });

  test('rejects with redirect to unauthorized and preserves session on 403 status', async () => {
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: 'jwt', type: 'Bearer' }),
    );
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      JSON.stringify({ userId: 7, username: 'alice' }),
    );

    await expect(authProvider.checkError({ status: 403 })).rejects.toEqual({
      redirectTo: '/unauthorized',
      logoutUser: false,
    });

    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).not.toBeNull();
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY)).not.toBeNull();
  });

  test('resolves successfully for other error statuses', async () => {
    await expect(authProvider.checkError({ status: 400 })).resolves.toBeUndefined();
    await expect(authProvider.checkError({ status: 404 })).resolves.toBeUndefined();
    await expect(authProvider.checkError({ status: 500 })).resolves.toBeUndefined();
  });
});

describe('logout', () => {
  test('clears stored auth session keys while preserving unrelated localStorage entries', async () => {
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: 'jwt', type: 'Bearer' }),
    );
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      JSON.stringify({ userId: 7, username: 'alice' }),
    );
    localStorage.setItem('other-app-config', 'persisted-data');

    await expect(authProvider.logout({})).resolves.toBeUndefined();

    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY)).toBeNull();
    expect(localStorage.getItem('other-app-config')).toBe('persisted-data');
  });
});

describe('getIdentity', () => {
  test('rejects when no userId is stored in identity', async () => {
    expect(authProvider.getIdentity).toBeDefined();
    if (authProvider.getIdentity !== undefined) {
      await expect(authProvider.getIdentity({})).rejects.toEqual({
        message: '[getIdentity] No userId to get user identity!',
      });
    }
  });

  test('resolves stored user identity when userId is present', async () => {
    expect(authProvider.getIdentity).toBeDefined();
    if (authProvider.getIdentity !== undefined) {
      const identityPayload = {
        userId: 42,
        username: 'bob',
        referenceId: 'ref-42',
        provider: 'local',
      };
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_IDENTITY, JSON.stringify(identityPayload));

      // `getIdentity` returns what `saveAuth` stored, which carries `userId` rather than react-admin's
      // `id`; the type says UserIdentity, the wire object says userId - a seam this test records.
      await expect(authProvider.getIdentity({})).resolves.toMatchObject(identityPayload);
    }
  });
});

describe('getRoles', () => {
  test('resolves with an empty set when no roles are stored', async () => {
    await expect(authProvider.getRoles({})).resolves.toEqual(new Set<string>());
  });

  test('resolves with a set of stored role strings', async () => {
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_PERMISSION,
      JSON.stringify(['admin', 'editor', 'viewer']),
    );

    await expect(authProvider.getRoles({})).resolves.toEqual(
      new Set<string>(['admin', 'editor', 'viewer']),
    );
  });
});

describe('getPermissions and refreshToken', () => {
  test('resolves permissions to undefined', async () => {
    await expect(authProvider.getPermissions({})).resolves.toBeUndefined();
  });

  test('resolves refreshToken to undefined', async () => {
    await expect(authProvider.refreshToken()).resolves.toBeUndefined();
  });
});
