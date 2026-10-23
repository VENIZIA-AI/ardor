import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Container, getError, inject, type TClass } from '@venizia/ignis-inversion';

import type { IAuthProvider, IDataProvider } from '@/common';
import { DefaultAuthProvider } from '@/providers/auth';
import { DefaultRestDataProvider } from '@/providers/rest-data';
import {
  type AnyType,
  BaseArdorApplication,
  CoreBindings,
  DefaultAuthService,
  type IApplicationInfo,
  type IAuthProviderOptions,
  type ISignInSession,
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
        noAuthPaths: ['/auth/sign-in'],
      });

      this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({
        paths: { checkAuth: '/auth/whoami', afterLogin: '/dashboard' },
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

      if (url.pathname === '/auth/sign-in') {
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
  test('posts the IGNIS sign-in body to /auth/sign-in and resolves with redirect path without double slashes', async () => {
    const loginResult: unknown = await authProvider.login({
      username: 'alice',
      password: 'secret-password',
    });

    expect(recordedRequests).toHaveLength(1);
    const loginRequest = recordedRequests[0];
    expect(loginRequest.pathname).toBe('/auth/sign-in');
    expect(loginRequest.method).toBe('POST');
    expect(loginRequest.body).toEqual({
      identifier: { scheme: 'username', value: 'alice' },
      credential: { scheme: 'basic', value: 'secret-password' },
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

interface SentRequest {
  resource: string;
  body: unknown;
}

const defaultSession = { userId: 7, roles: ['admin'], token: { value: 'jwt', type: 'Bearer' } };

/** A provider built on a data provider stub: what it posts lands in `sent`, and it answers `data`. */
const signInWith = (opts: {
  providerClass?: TClass<DefaultAuthProvider>;
  options?: IAuthProviderOptions;
  data?: unknown;
  sent?: Array<SentRequest>;
}) => {
  const container = new Container();
  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({
    send: (request: { resource: string; params: { body: unknown } }) => {
      opts.sent?.push({ resource: request.resource, body: request.params.body });
      return Promise.resolve({ data: opts.data ?? defaultSession });
    },
  });
  container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue(opts.options ?? {});
  container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue(new DefaultAuthService());
  container
    .bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
    .toProvider(opts.providerClass ?? DefaultAuthProvider);

  return container.get<IAuthProvider>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER });
};

// A sign-in response that is only a bare token string, the user id and roles inside its payload.
const jwtOf = (payload: object): string => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [encode({ alg: 'ES256' }), encode(payload), 'signature'].join('.');
};

describe('login against the sign-in response shapes', () => {
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

  test('sends what a buildSignInBody override makes of the form params', async () => {
    class EmailAuthProvider extends DefaultAuthProvider {
      protected override buildSignInBody(opts: { params: { email: string; password: string } }) {
        return {
          identifier: { scheme: 'email', value: opts.params.email },
          credential: { scheme: 'basic', value: opts.params.password },
          clientId: 'admin',
        };
      }
    }

    const sent: Array<SentRequest> = [];
    await signInWith({ providerClass: EmailAuthProvider, sent }).login({
      email: 'alice@example.com',
      password: 'secret-password',
    });

    expect(sent).toEqual([
      {
        resource: '/auth/sign-in',
        body: {
          identifier: { scheme: 'email', value: 'alice@example.com' },
          credential: { scheme: 'basic', value: 'secret-password' },
          clientId: 'admin',
        },
      },
    ]);
  });

  // The pre-IGNIS contract: a path in the options, the body in a hook.
  test('posts the form as it is to /auth/login: paths.signIn and a buildSignInBody that returns params', async () => {
    class FormAuthProvider extends DefaultAuthProvider {
      protected override buildSignInBody(opts: { params: unknown }) {
        return opts.params;
      }
    }

    const sent: Array<SentRequest> = [];
    await signInWith({
      providerClass: FormAuthProvider,
      options: { paths: { signIn: '/auth/login' } },
      sent,
    }).login({ username: 'alice', password: 'secret-password' });

    expect(sent).toEqual([
      { resource: '/auth/login', body: { username: 'alice', password: 'secret-password' } },
    ]);
  });

  test('stores the roles of the response where getRoles reads them', async () => {
    loginBody = {
      userId: 7,
      roles: ['admin', { id: '2', identifier: 'editor', priority: 1 }, { name: 'viewer' }],
      token: { value: 'jwt', type: 'Bearer' },
    };

    await authProvider.login({ username: 'alice', password: 'secret-password' });

    expect(await authProvider.getRoles()).toEqual(new Set(['admin', 'editor', 'viewer']));
  });

  test('falls back to the roles claim of the token, and prefers the roles of the response', async () => {
    const token = jwtOf({ userId: 'u-9', roles: [{ id: '1', identifier: 'admin', priority: 0 }] });

    loginBody = { token };
    await authProvider.login({ username: 'alice', password: 'secret-password' });
    expect(await authProvider.getRoles()).toEqual(new Set(['admin']));

    loginBody = { roles: ['auditor'], token };
    await authProvider.login({ username: 'alice', password: 'secret-password' });
    expect(await authProvider.getRoles()).toEqual(new Set(['auditor']));
  });

  test('replaces the roles of the last user, and skips an entry it cannot read', async () => {
    loginBody = { userId: 1, roles: ['admin'], token: { value: 'jwt', type: 'Bearer' } };
    await authProvider.login({ username: 'alice', password: 'secret-password' });

    loginBody = {
      userId: 2,
      roles: [{ id: '3' }, 42, 'viewer'],
      token: { value: 'jwt', type: 'Bearer' },
    };
    await authProvider.login({ username: 'bob', password: 'secret-password' });
    expect(await authProvider.getRoles()).toEqual(new Set(['viewer']));

    loginBody = defaultLoginBody;
    await authProvider.login({ username: 'carol', password: 'secret-password' });
    expect(await authProvider.getRoles()).toEqual(new Set());
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
      redirectTo: '/login',
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
      redirectTo: '/login',
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
      redirectTo: '/login',
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
    ).toEqual({ redirectTo: '/login' });
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

  test('refreshToken asks the network service to refresh: false when the service has no refresh', async () => {
    expect(await authProvider.refreshToken()).toBe(false);
  });

  test('refreshToken is the network service refresh, the one place a refresh is made', async () => {
    let refreshed = 0;
    const container = new Container();
    container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({
      getNetworkService: () => ({
        refresh: () => {
          refreshed += 1;
          return Promise.resolve(true);
        },
      }),
    });
    container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({});
    container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue(new DefaultAuthService());
    container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(DefaultAuthProvider);

    const provider = container.get<IAuthProvider>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER });

    expect(await provider.refreshToken()).toBe(true);
    expect(refreshed).toBe(1);
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
        canAccess: params => {
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

describe('login hooks', () => {
  const isNothingStored = () => {
    return [
      LocalStorageKeys.KEY_AUTH_TOKEN,
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      LocalStorageKeys.KEY_AUTH_PERMISSION,
    ].every(key => localStorage.getItem(key) === null);
  };

  test('beforeSaveSession gets the session and the form params, before anything is saved', async () => {
    const calls: Array<{ session: unknown; params: unknown; wasStored: boolean }> = [];

    class SpyAuthProvider extends DefaultAuthProvider {
      protected override beforeSaveSession(opts: { session: ISignInSession; params: unknown }) {
        calls.push({ ...opts, wasStored: !isNothingStored() });
        return Promise.resolve();
      }
    }

    await signInWith({ providerClass: SpyAuthProvider }).login({
      username: 'alice',
      password: 'secret-password',
    });

    expect(calls).toEqual([
      {
        session: { userId: 7, roles: ['admin'], token: { value: 'jwt', type: 'Bearer' } },
        params: { username: 'alice', password: 'secret-password' },
        wasStored: false,
      },
    ]);
    expect(isNothingStored()).toBe(false);
  });

  test('a throw in beforeSaveSession rejects login and saves nothing', async () => {
    class AdminOnlyAuthProvider extends DefaultAuthProvider {
      protected override beforeSaveSession(opts: { session: ISignInSession }) {
        if (!opts.session.roles.includes('superuser')) {
          throw new Error('[beforeSaveSession] Forbidden');
        }
        return Promise.resolve();
      }
    }

    const error = await rejectionOf(
      signInWith({ providerClass: AdminOnlyAuthProvider }).login({ username: 'alice' }),
    );

    expect(String(error)).toContain('[beforeSaveSession] Forbidden');
    expect(isNothingStored()).toBe(true);
  });

  test('a rejection from beforeSaveSession rejects login and saves nothing', async () => {
    class RefusingAuthProvider extends DefaultAuthProvider {
      protected override async beforeSaveSession() {
        await Promise.resolve();
        throw new Error('[beforeSaveSession] Forbidden');
      }
    }

    const error = await rejectionOf(
      signInWith({ providerClass: RefusingAuthProvider }).login({ username: 'alice' }),
    );

    expect(String(error)).toContain('[beforeSaveSession] Forbidden');
    expect(isNothingStored()).toBe(true);
  });

  test('beforeSaveSession is awaited before the session is saved', async () => {
    let wasStoredAfterWait = true;

    class SlowAuthProvider extends DefaultAuthProvider {
      protected override async beforeSaveSession() {
        await new Promise(resolve => setTimeout(resolve, 5));
        wasStoredAfterWait = !isNothingStored();
      }
    }

    await signInWith({ providerClass: SlowAuthProvider }).login({ username: 'alice' });

    expect(wasStoredAfterWait).toBe(false);
    expect(isNothingStored()).toBe(false);
  });

  test('a saveSession that does nothing leaves storage empty, and login still resolves', async () => {
    const seen: Array<unknown> = [];

    class ElsewhereAuthProvider extends DefaultAuthProvider {
      protected override beforeSaveSession(opts: { session: ISignInSession }) {
        seen.push(opts.session.token.value);
        return Promise.resolve();
      }

      protected override saveSession() {
        // The session is kept elsewhere.
      }
    }

    const result = await signInWith({
      providerClass: ElsewhereAuthProvider,
      options: { paths: { afterLogin: '/dashboard' } },
    }).login({ username: 'alice' });

    expect(seen).toEqual(['jwt']);
    expect(isNothingStored()).toBe(true);
    expect(result).toMatchObject({ redirectTo: '/dashboard' });
  });

  test('saveSession gets the session and the resolved username', async () => {
    const saved: Array<unknown> = [];

    class RecordingAuthProvider extends DefaultAuthProvider {
      protected override saveSession(opts: { session: ISignInSession; username: string }) {
        saved.push(opts);
      }
    }

    await signInWith({ providerClass: RecordingAuthProvider }).login({ username: 'alice' });

    expect(saved).toEqual([
      {
        session: { userId: 7, roles: ['admin'], token: { value: 'jwt', type: 'Bearer' } },
        username: 'alice',
      },
    ]);
  });

  test('resolveUsername is the username that is stored; the default is params.username', async () => {
    class IdentifierAuthProvider extends DefaultAuthProvider {
      protected override resolveUsername(opts: { params: { identifier: { value: string } } }) {
        return opts.params.identifier.value;
      }
    }

    await signInWith({ providerClass: IdentifierAuthProvider }).login({
      identifier: { scheme: 'username', value: 'alice' },
    });
    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_IDENTITY })).toMatchObject({
      username: 'alice',
    });

    localStorage.clear();
    await signInWith({}).login({ username: 'bob' });
    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_IDENTITY })).toMatchObject({
      username: 'bob',
    });
  });
});

describe('paths as protected getters', () => {
  class RenamedAuthProvider extends DefaultAuthProvider {
    protected override get signInPath() {
      return '/v2/sign-in';
    }

    protected override get loginPagePath() {
      return '/sign-in-page';
    }

    protected override get unauthorizedPagePath() {
      return '/no-access';
    }
  }

  test('signInPath defaults to /auth/sign-in and follows paths.signIn; a subclass may override it', async () => {
    const sent: Array<SentRequest> = [];

    await signInWith({ sent }).login({ username: 'alice' });
    await signInWith({ sent, options: { paths: { signIn: '/api/login' } } }).login({
      username: 'a',
    });
    await signInWith({ sent, providerClass: RenamedAuthProvider }).login({ username: 'a' });

    expect(sent.map(request => request.resource)).toEqual([
      '/auth/sign-in',
      '/api/login',
      '/v2/sign-in',
    ]);
  });

  test('afterLogin defaults to / and follows paths.afterLogin', async () => {
    expect(await signInWith({}).login({ username: 'a' })).toMatchObject({ redirectTo: '/' });
    expect(
      await signInWith({ options: { paths: { afterLogin: '/home' } } }).login({ username: 'a' }),
    ).toMatchObject({ redirectTo: '/home' });
  });

  test('the login page and the unauthorized page are overridable', async () => {
    const provider = signInWith({ providerClass: RenamedAuthProvider });

    expect(await rejectionOf(provider.checkAuth({}))).toEqual({ redirectTo: '/sign-in-page' });
    expect(await rejectionOf(provider.checkError({ status: 401 }))).toEqual({
      redirectTo: '/sign-in-page',
    });
    expect(await rejectionOf(provider.checkError({ status: 403 }))).toEqual({
      redirectTo: '/no-access',
      logoutUser: false,
    });
  });
});

describe('readSignInSession as a hook', () => {
  test('a subclass reads a sign-in response of its own shape', async () => {
    class WrappedResponseAuthProvider extends DefaultAuthProvider {
      protected override readSignInSession(opts: { data: unknown }) {
        const { result } = opts.data as { result: { id: string; jwt: string } };
        return {
          userId: result.id,
          token: { value: result.jwt, type: 'Bearer' },
          roles: ['wrapped'],
        };
      }
    }

    await signInWith({
      providerClass: WrappedResponseAuthProvider,
      data: { result: { id: 'u-5', jwt: 'wrapped-token' } },
    }).login({ username: 'alice' });

    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_IDENTITY })).toMatchObject({
      userId: 'u-5',
    });
    expect(readStorageJson({ key: LocalStorageKeys.KEY_AUTH_PERMISSION })).toEqual(['wrapped']);
  });
});

// A type-level guard, checked by `bun check` (typecheck covers the tests): 0.1.4-3 typed `login`
// as `(params) => Promise<unknown>`, and a subclass that overrides it so must keep compiling.
describe('login signature', () => {
  class LegacyLoginAuthProvider extends DefaultAuthProvider {
    override async login(params: AnyType): Promise<unknown> {
      return super.login(params);
    }
  }

  test('a subclass overriding login with the 0.1.4-3 signature compiles and runs', async () => {
    const result = await signInWith({ providerClass: LegacyLoginAuthProvider }).login({
      username: 'alice',
    });

    expect(result).toMatchObject({ redirectTo: '/' });
  });
});
