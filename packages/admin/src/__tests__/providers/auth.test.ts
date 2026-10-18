import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Container, getError, inject, type TClass } from '@venizia/ignis-inversion';

import { type IAuthProvider, type IDataProvider } from '@/common';
import { DefaultAuthProvider } from '@/providers/auth';
import { DefaultRestDataProvider } from '@/providers/rest-data';
import {
  BaseArdorApplication,
  CoreBindings,
  DefaultAuthService,
  type IApplicationInfo,
  type IAuthProviderOptions,
  type IPermissionProvider,
  LocalStorageKeys,
} from '@venizia/ardor-kernel';
import { rejectionOf } from '@/__tests__/rejection';

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
const defaultLoginBody = { userId: 7, token: { value: 'jwt', type: 'Bearer' } };
let loginBody: unknown = defaultLoginBody;
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
        return Response.json(loginBody);
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
  loginBody = defaultLoginBody;
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

// What the IGNIS JWT auth component answers: a bare token string, the user id inside its payload.
const jwtOf = (payload: object): string => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [encode({ alg: 'ES256' }), encode(payload), 'signature'].join('.');
};

describe('login against the IGNIS sign-in contract', () => {
  test('stores a bare token string as a Bearer token, with the user id read from its payload', async () => {
    const token = jwtOf({ userId: 'u-9', roles: [{ id: '1', identifier: 'admin', priority: 0 }] });
    loginBody = { token };

    await authProvider.login({ username: 'alice', password: 'secret-password' });

    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_TOKEN })).toEqual({
      value: token,
      type: 'Bearer',
      provider: '',
    });
    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_IDENTITY })).toEqual({
      userId: 'u-9',
      username: 'alice',
      referenceId: '',
      provider: '',
    });
  });

  test('reads the user id from the standard sub claim when userId is absent', async () => {
    loginBody = { token: jwtOf({ sub: 'u-3' }) };

    await authProvider.login({ username: 'alice', password: 'secret-password' });

    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_IDENTITY })).toMatchObject({
      userId: 'u-3',
    });
  });

  test('keeps the userId a backend sends next to a string token', async () => {
    loginBody = { userId: 5, token: 'opaque-token' };

    await authProvider.login({ username: 'alice', password: 'secret-password' });

    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_TOKEN })).toMatchObject({
      value: 'opaque-token',
      type: 'Bearer',
    });
    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_IDENTITY })).toMatchObject({
      userId: 5,
    });
  });

  test('sends what buildSignInBody makes of the form params', async () => {
    class IgnisAuthProvider extends DefaultAuthProvider {
      protected override buildSignInBody(params: { username: string; password: string }) {
        return {
          identifier: { scheme: 'username', value: params.username },
          credential: { scheme: 'basic', value: params.password },
        };
      }
    }

    const sent: Array<unknown> = [];
    const container = new Container();
    container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({
      send: (opts: { params: { body: unknown } }) => {
        sent.push(opts.params.body);
        return Promise.resolve({ data: { token: jwtOf({ userId: 'u-1' }) } });
      },
    });
    container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({});
    container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue(new DefaultAuthService());
    container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(IgnisAuthProvider);

    await container
      .get<IAuthProvider>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
      .login({ username: 'alice', password: 'secret-password' });

    expect(sent).toEqual([
      {
        identifier: { scheme: 'username', value: 'alice' },
        credential: { scheme: 'basic', value: 'secret-password' },
      },
    ]);
  });

  test('rejects, and stores nothing, when no user id can be found', async () => {
    loginBody = { token: 'opaque-token' };

    const error = await rejectionOf(authProvider.login({ username: 'alice', password: 'x' }));

    expect(String(error)).toContain('[login]');
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY)).toBeNull();
  });

  test('rejects, and stores nothing, when the response carries no token', async () => {
    loginBody = { userId: 7 };

    const error = await rejectionOf(authProvider.login({ username: 'alice', password: 'x' }));

    expect(String(error)).toContain('[login]');
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
  });
});

describe('checkAuth', () => {
  test('rejects with redirect to login when no token is stored', async () => {
    expect(await rejectionOf(authProvider.checkAuth({}))).toEqual({
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

    expect(await authProvider.checkAuth({})).toBeUndefined();

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

    expect(await rejectionOf(authProvider.checkAuth({}))).toEqual({
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

    expect(await rejectionOf(authProvider.checkError({ status: 401 }))).toEqual({
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

    expect(await rejectionOf(authProvider.checkError({ status: 403 }))).toEqual({
      redirectTo: '/unauthorized',
      logoutUser: false,
    });

    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).not.toBeNull();
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY)).not.toBeNull();
  });

  test('resolves successfully for other error statuses', async () => {
    expect(await authProvider.checkError({ status: 400 })).toBeUndefined();
    expect(await authProvider.checkError({ status: 404 })).toBeUndefined();
    expect(await authProvider.checkError({ status: 500 })).toBeUndefined();
  });

  test('reads statusCode from an ApplicationError thrown by the data provider', async () => {
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: 'jwt', type: 'Bearer' }),
    );

    expect(
      await rejectionOf(
        authProvider.checkError(getError({ statusCode: 403, message: 'HTTP 403' })),
      ),
    ).toEqual({ redirectTo: '/unauthorized', logoutUser: false });
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).not.toBeNull();

    expect(
      await authProvider.checkError(getError({ statusCode: 500, message: 'HTTP 500' })),
    ).toBeUndefined();

    expect(
      await rejectionOf(
        authProvider.checkError(getError({ statusCode: 401, message: 'HTTP 401' })),
      ),
    ).toEqual({ redirectTo: 'login' });
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
  });

  test('resolves when react-admin passes no error', async () => {
    expect(await authProvider.checkError(undefined)).toBeUndefined();
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

    expect(await authProvider.logout({})).toBeUndefined();

    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY)).toBeNull();
    expect(localStorage.getItem('other-app-config')).toBe('persisted-data');
  });
});

describe('getIdentity', () => {
  test('rejects when no userId is stored in identity', async () => {
    expect(authProvider.getIdentity).toBeDefined();
    if (authProvider.getIdentity !== undefined) {
      expect(await rejectionOf(authProvider.getIdentity({}))).toEqual({
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
      expect(await authProvider.getIdentity({})).toMatchObject(identityPayload);
    }
  });
});

describe('getRoles', () => {
  test('resolves with an empty set when no roles are stored', async () => {
    expect(await authProvider.getRoles({})).toEqual(new Set<string>());
  });

  test('resolves with a set of stored role strings', async () => {
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_PERMISSION,
      JSON.stringify(['admin', 'editor', 'viewer']),
    );

    expect(await authProvider.getRoles({})).toEqual(new Set<string>(['admin', 'editor', 'viewer']));
  });
});

describe('getPermissions and refreshToken', () => {
  test('resolves permissions to undefined', async () => {
    expect(await authProvider.getPermissions({})).toBeUndefined();
  });

  test('resolves refreshToken to undefined', async () => {
    expect(await authProvider.refreshToken()).toBeUndefined();
  });
});

// The app binds an IPermissionProvider and DefaultAuthProvider answers react-admin's canAccess from
// it. Unbound, there is no canAccess at all, so ra-core keeps allowing everything, as before.
describe('canAccess', () => {
  const resolveAuthProvider = (opts: {
    permissionProvider?: IPermissionProvider;
    providerClass?: TClass<DefaultAuthProvider>;
  }) => {
    const container = new Container();
    container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({});
    container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({});
    container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue({});
    container.bind({ key: 'services.Extra' }).toValue({});
    if (opts.permissionProvider) {
      container.bind({ key: CoreBindings.PERMISSION_PROVIDER }).toValue(opts.permissionProvider);
    }
    container
      .bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
      .toProvider(opts.providerClass ?? DefaultAuthProvider);

    return container.get<IAuthProvider>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER });
  };

  // The shape every BANA auth provider has: its own constructor, three arguments to `super`, and
  // another injection at the index the base uses for the permission provider.
  class ThreeArgumentAuthProvider extends DefaultAuthProvider {
    constructor(
      @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      restDataProvider: IDataProvider,
      @inject({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
      authProviderOptions: IAuthProviderOptions,
      @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
      authService: DefaultAuthService,
      @inject({ key: 'services.Extra' })
      protected extra: object,
    ) {
      super(restDataProvider, authProviderOptions, authService);
    }
  }

  test('reaches a subclass that passes only three arguments to super', async () => {
    const provider = resolveAuthProvider({
      providerClass: ThreeArgumentAuthProvider,
      permissionProvider: { canAccess: () => Promise.resolve(false) },
    });

    expect(await provider.canAccess?.({ resource: 'stocks', action: 'list' })).toBe(false);
  });

  test('stays absent for that subclass when the application binds no permission provider', () => {
    expect(
      resolveAuthProvider({ providerClass: ThreeArgumentAuthProvider }).canAccess,
    ).toBeUndefined();
  });

  test('prefers a permission provider passed to super over the bound one', async () => {
    class ExplicitAuthProvider extends DefaultAuthProvider {
      constructor(
        @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
        restDataProvider: IDataProvider,
        @inject({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
        authProviderOptions: IAuthProviderOptions,
        @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
        authService: DefaultAuthService,
      ) {
        super(restDataProvider, authProviderOptions, authService, {
          canAccess: () => Promise.resolve(true),
        });
      }
    }

    const provider = resolveAuthProvider({
      providerClass: ExplicitAuthProvider,
      permissionProvider: { canAccess: () => Promise.resolve(false) },
    });

    expect(await provider.canAccess?.({ resource: 'stocks', action: 'list' })).toBe(true);
  });

  test('is absent when the application binds no permission provider', () => {
    expect(resolveAuthProvider({}).canAccess).toBeUndefined();
  });

  test("asks the application's permission provider, with the resource, action and record", async () => {
    const asked: Array<unknown> = [];
    const provider = resolveAuthProvider({
      permissionProvider: {
        canAccess: (params) => {
          asked.push(params);
          return Promise.resolve(params.action === 'list');
        },
      },
    });

    const signal = new AbortController().signal;
    expect(
      await provider.canAccess?.({ resource: 'stocks', action: 'list', record: { id: 1 }, signal }),
    ).toBe(true);
    expect(await provider.canAccess?.({ resource: 'stocks', action: 'delete' })).toBe(false);
    expect(asked).toEqual([
      { resource: 'stocks', action: 'list', record: { id: 1 } },
      { resource: 'stocks', action: 'delete', record: undefined },
    ]);
  });
});
