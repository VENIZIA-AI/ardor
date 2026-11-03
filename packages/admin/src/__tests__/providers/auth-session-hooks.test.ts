import { afterAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { LoggerFactory } from '@venizia/ignis-helpers/core';
import { Container } from '@venizia/ignis-inversion';

import type { IAuthProvider } from '@/common';
import {
  DefaultAuthProvider,
  SessionClearReasons,
  type TSessionClearReason,
} from '@/providers/auth';
import {
  type AnyType,
  CoreBindings,
  DefaultAuthService,
  type IAuthTokenRecord,
  type ISignInSession,
  LocalStorageKeys,
} from '@venizia/ardor-kernel';
import { RejectionHelper } from '@venizia/dev-configs/testing';

interface IStartedCall {
  readonly token: IAuthTokenRecord;
  readonly user: AnyType;
}

interface IHooks {
  events: Array<string>;
  started: Array<IStartedCall>;
  cleared: Array<TSessionClearReason>;
  storedAtClear: Array<string | null>;
  onStarted: () => void | Promise<void>;
  onCleared: () => void | Promise<void>;
  timeout: number;
}

interface IApi {
  signIn: unknown;
  whoamiHasData: boolean;
  checkCalls: number;
  refreshed: boolean;
  refreshResult: boolean;
  whoamiDelay: number;
}

/** What the subclass below records, and how its hooks behave in the test at hand. */
const hooks: IHooks = {
  events: [],
  started: [],
  cleared: [],
  storedAtClear: [],
  onStarted: () => undefined,
  onCleared: () => undefined,
  timeout: 1000,
};

const api: IApi = {
  signIn: { userId: 7, token: { value: 'jwt-1', type: 'Bearer' }, roles: ['admin'] },
  whoamiHasData: true,
  checkCalls: 0,
  refreshed: false,
  refreshResult: true,
  whoamiDelay: 0,
};

class RecordingAuthProvider extends DefaultAuthProvider {
  protected override get sessionHookTimeout(): number {
    return hooks.timeout;
  }

  protected override async onSessionStarted(opts: IStartedCall): Promise<void> {
    hooks.events.push('started:begin');
    hooks.started.push(opts);
    await hooks.onStarted();
    hooks.events.push('started:end');
  }

  protected override async onSessionCleared(opts: { reason: TSessionClearReason }): Promise<void> {
    hooks.events.push(`cleared:${opts.reason}`);
    hooks.cleared.push(opts.reason);
    hooks.storedAtClear.push(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN));
    await hooks.onCleared();
  }
}

/** The same provider with `saveSession` doing nothing: an app that keeps the session elsewhere. */
class SessionKeptElsewhereProvider extends RecordingAuthProvider {
  protected override saveSession(_opts: { session: ISignInSession; username: string }): void {
    // The session is not kept here.
  }
}

const buildProvider = (opts?: {
  providerClass?: typeof DefaultAuthProvider;
  withCheckPath?: boolean;
}): IAuthProvider => {
  const container = new Container();
  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({
    send: (request: { resource: string }) => {
      if (request.resource === '/auth/whoami') {
        api.checkCalls += 1;
        const answer = { data: api.whoamiHasData ? { id: 7 } : null };
        return new Promise((resolve) => setTimeout(() => resolve(answer), api.whoamiDelay));
      }
      return Promise.resolve({ data: api.signIn });
    },
    getNetworkService: () => ({
      refresh: () => {
        api.refreshed = true;
        return Promise.resolve(api.refreshResult);
      },
    }),
  });
  container
    .bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
    .toValue(opts?.withCheckPath === false ? {} : { paths: { checkAuth: '/auth/whoami' } });
  container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue(new DefaultAuthService());
  container
    .bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
    .toProvider(opts?.providerClass ?? RecordingAuthProvider);

  return container.get<IAuthProvider>({ key: CoreBindings.DEFAULT_AUTH_PROVIDER });
};

const storeSession = (opts: { token: string; userId: number }) => {
  new DefaultAuthService().saveAuth({
    token: { value: opts.token, type: 'Bearer' },
    userId: opts.userId,
    username: 'alice',
  });
};

const signIn = (provider: IAuthProvider) => {
  return provider.login({ username: 'alice', password: 'secret' });
};

beforeEach(() => {
  localStorage.clear();
  hooks.events = [];
  hooks.started = [];
  hooks.cleared = [];
  hooks.storedAtClear = [];
  hooks.onStarted = () => undefined;
  hooks.onCleared = () => undefined;
  api.signIn = { userId: 7, token: { value: 'jwt-1', type: 'Bearer' }, roles: ['admin'] };
  api.whoamiHasData = true;
  api.checkCalls = 0;
  api.refreshed = false;
  api.refreshResult = true;
  api.whoamiDelay = 0;
  hooks.timeout = 1000;
});

describe('onSessionStarted', () => {
  test('login hands the saved token and the stored identity to the hook, once', async () => {
    const provider = buildProvider();

    await signIn(provider);

    expect(hooks.started).toHaveLength(1);
    expect(hooks.started[0].token.value).toBe('jwt-1');
    expect(hooks.started[0].token.type).toBe('Bearer');
    expect(hooks.started[0].user).toEqual({
      userId: 7,
      username: 'alice',
      referenceId: '',
      provider: '',
    });
    expect(hooks.cleared).toEqual([]);
  });

  test('login still announces the session when saveSession keeps nothing in the store', async () => {
    const provider = buildProvider({ providerClass: SessionKeptElsewhereProvider });

    await signIn(provider);

    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
    expect(hooks.started).toHaveLength(1);
    expect(hooks.started[0].token.value).toBe('jwt-1');
    expect(hooks.started[0].user).toEqual({ userId: 7, username: 'alice' });
  });

  test('the first checkAuth of a page that finds a stored session announces it', async () => {
    storeSession({ token: 'stored', userId: 3 });
    const provider = buildProvider();

    await provider.checkAuth({});

    expect(hooks.started).toHaveLength(1);
    expect(hooks.started[0].token.value).toBe('stored');
    expect(hooks.started[0].user.userId).toBe(3);
  });

  test('a checkAuth that leaves the session unchanged does not announce it again', async () => {
    storeSession({ token: 'stored', userId: 3 });
    const provider = buildProvider();

    await provider.checkAuth({});
    await provider.checkAuth({});
    await provider.checkAuth({});

    expect(api.checkCalls).toBe(3);
    expect(hooks.started).toHaveLength(1);
  });

  test('a login after a checkAuth of the same session does not announce it again', async () => {
    const provider = buildProvider();
    await signIn(provider);

    await provider.checkAuth({});

    expect(hooks.started).toHaveLength(1);
  });

  test('parallel checkAuth calls announce the session once', async () => {
    storeSession({ token: 'stored', userId: 3 });
    const provider = buildProvider();
    hooks.onStarted = () => new Promise((resolve) => setTimeout(resolve, 5));

    await Promise.all([provider.checkAuth({}), provider.checkAuth({}), provider.checkAuth({})]);

    expect(hooks.started).toHaveLength(1);
  });

  test('a refresh that swaps the token announces the new token, and a refresh that does not swap it stays silent', async () => {
    const provider = buildProvider();
    await signIn(provider);

    await provider.refreshToken();
    expect(hooks.started).toHaveLength(1);

    storeSession({ token: 'jwt-2', userId: 7 });
    const isRefreshed = await provider.refreshToken();

    expect(isRefreshed).toBe(true);
    expect(hooks.started.map((call) => call.token.value)).toEqual(['jwt-1', 'jwt-2']);
  });

  test('a refresh that made none announces nothing', async () => {
    storeSession({ token: 'stored', userId: 3 });
    api.refreshResult = false;
    const provider = buildProvider();

    const isRefreshed = await provider.refreshToken();

    expect(isRefreshed).toBe(false);
    expect(hooks.started).toEqual([]);
  });

  test('a checkAuth with no session stored announces nothing', async () => {
    const provider = buildProvider();

    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });

    expect(hooks.started).toEqual([]);
  });

  test('a session that signs in again after it was cleared is announced again', async () => {
    const provider = buildProvider();
    await signIn(provider);
    await provider.logout({});

    await signIn(provider);

    expect(
      hooks.events.filter((event) => event.endsWith(':begin') || event.startsWith('cleared')),
    ).toEqual(['started:begin', 'cleared:logout', 'started:begin']);
  });
});

describe('onSessionCleared', () => {
  test('logout clears the store first, then calls the hook with the reason logout, once', async () => {
    const provider = buildProvider();
    await signIn(provider);

    await provider.logout({});
    await provider.logout({});

    expect(hooks.cleared).toEqual([SessionClearReasons.LOGOUT]);
    expect(hooks.storedAtClear).toEqual([null]);
  });

  test('the 401 branch of checkError clears the store, calls the hook with unauthorized and rejects', async () => {
    const provider = buildProvider();
    await signIn(provider);

    const rejection = await RejectionHelper.rejectionOf({
      task: provider.checkError({ status: 401 }),
    });

    expect(rejection).toEqual({ redirectTo: '/login' });
    expect(hooks.cleared).toEqual([SessionClearReasons.UNAUTHORIZED]);
    expect(hooks.storedAtClear).toEqual([null]);
  });

  test('a 403 and any other status leave the session and call no hook', async () => {
    const provider = buildProvider();
    await signIn(provider);

    await RejectionHelper.rejectionOf({ task: provider.checkError({ status: 403 }) });
    await provider.checkError({ status: 500 });

    expect(hooks.cleared).toEqual([]);
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).not.toBeNull();
  });

  test('a checkAuth whose server answer has no data calls the hook with rejected, once, and leaves the stored token', async () => {
    const provider = buildProvider();
    await signIn(provider);
    api.whoamiHasData = false;

    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });
    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });

    expect(hooks.cleared).toEqual([SessionClearReasons.REJECTED]);
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).not.toBeNull();
  });

  test('a checkAuth with the token gone calls the hook with rejected once for a session that was announced', async () => {
    const provider = buildProvider();
    await signIn(provider);
    localStorage.clear();

    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });
    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });

    expect(hooks.cleared).toEqual([SessionClearReasons.REJECTED]);
  });

  test('a clear for a session that was never announced calls no hook', async () => {
    const provider = buildProvider();

    await provider.logout({});
    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });
    await RejectionHelper.rejectionOf({ task: provider.checkError({ status: 401 }) });

    expect(hooks.cleared).toEqual([]);
  });

  test('a sign-in is not announced as started when the same session is confirmed after a rejected check', async () => {
    const provider = buildProvider();
    await signIn(provider);
    api.whoamiHasData = false;
    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });
    api.whoamiHasData = true;

    await provider.checkAuth({});

    expect(
      hooks.events.filter((event) => event.endsWith(':begin') || event.startsWith('cleared')),
    ).toEqual(['started:begin', 'cleared:rejected', 'started:begin']);
  });
});

describe('a hook that throws or is async', () => {
  const logged = {
    error: spyOn(LoggerFactory.getLogger(['DefaultAuthProvider']), 'error'),
  };

  beforeEach(() => {
    logged.error.mockReset();
    logged.error.mockImplementation(() => undefined);
  });

  afterAll(() => {
    logged.error.mockRestore();
  });

  test('a throwing onSessionStarted does not break login', async () => {
    hooks.onStarted = () => {
      throw new Error('socket is down');
    };
    const provider = buildProvider();

    const result = await signIn(provider);

    expect(result).toEqual(expect.objectContaining({ redirectTo: '/' }));
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).not.toBeNull();
  });

  test('a hook that throws is logged with its name', async () => {
    hooks.onStarted = () => {
      throw new Error('socket is down');
    };
    const provider = buildProvider();

    await signIn(provider);

    expect(logged.error).toHaveBeenCalledTimes(1);
    expect(logged.error.mock.calls[0][1]).toBe('onSessionStarted');
  });

  test('a rejecting onSessionCleared does not break logout or the 401 rejection', async () => {
    hooks.onCleared = () => Promise.reject(new Error('socket is down'));
    const provider = buildProvider();
    await signIn(provider);
    await provider.logout({});
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();

    await signIn(provider);
    const rejection = await RejectionHelper.rejectionOf({
      task: provider.checkError({ status: 401 }),
    });

    expect(rejection).toEqual({ redirectTo: '/login' });
  });

  test('a hook that never settles is released by the timeout, and logged', async () => {
    hooks.timeout = 20;
    hooks.onStarted = () => new Promise(() => undefined);
    const provider = buildProvider();

    const result = await signIn(provider);

    expect(result).toEqual(expect.objectContaining({ redirectTo: '/' }));
    expect(logged.error).toHaveBeenCalledTimes(1);
    expect(logged.error.mock.calls[0][1]).toBe('onSessionStarted');
  });

  test('a hook that calls a provider method waits behind itself only until the timeout', async () => {
    hooks.timeout = 20;
    const provider = buildProvider();
    hooks.onStarted = async () => {
      await provider.logout({});
    };

    const result = await signIn(provider);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(result).toEqual(expect.objectContaining({ redirectTo: '/' }));
    expect(hooks.cleared).toEqual([SessionClearReasons.LOGOUT]);
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();
  });

  test('login resolves after an async onSessionStarted has finished', async () => {
    let finished = false;
    hooks.onStarted = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      finished = true;
    };
    const provider = buildProvider();

    await signIn(provider);

    expect(finished).toBe(true);
  });

  test('a slow onSessionStarted finishes before a later onSessionCleared begins', async () => {
    storeSession({ token: 'stored', userId: 3 });
    hooks.onStarted = () => new Promise((resolve) => setTimeout(resolve, 15));
    const provider = buildProvider();

    const checking = provider.checkAuth({});
    while (!hooks.events.includes('started:begin')) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    const loggingOut = provider.logout({});
    await Promise.all([checking, loggingOut]);

    expect(hooks.events).toEqual(['started:begin', 'started:end', 'cleared:logout']);
  });
});

describe('the order react-admin and the network can produce', () => {
  test('a checkAuth that loses to an announced session resolves after the hook of the one that won', async () => {
    storeSession({ token: 'stored', userId: 3 });
    hooks.onStarted = () => new Promise((resolve) => setTimeout(resolve, 15));
    const provider = buildProvider();

    const first = provider.checkAuth({}).then(() => hooks.events.push('first'));
    const second = provider.checkAuth({}).then(() => hooks.events.push('second'));
    await Promise.all([first, second]);

    expect(hooks.events.indexOf('started:end')).toBeLessThan(hooks.events.indexOf('first'));
    expect(hooks.events.indexOf('started:end')).toBeLessThan(hooks.events.indexOf('second'));
  });

  test('a slow rejected checkAuth does not clear a session that started while it was out', async () => {
    const provider = buildProvider();
    await signIn(provider);
    api.whoamiHasData = false;
    api.whoamiDelay = 30;

    const checking = RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });
    storeSession({ token: 'jwt-2', userId: 7 });
    await provider.refreshToken();
    const rejection = await checking;

    expect(rejection).toEqual({ redirectTo: '/login' });
    expect(hooks.started.map((call) => call.token.value)).toEqual(['jwt-1', 'jwt-2']);
    expect(hooks.cleared).toEqual([]);
  });

  test('a 401 followed by logout, the order of react-admin, clears the session once', async () => {
    const provider = buildProvider();
    await signIn(provider);

    await RejectionHelper.rejectionOf({ task: provider.checkError({ status: 401 }) });
    await provider.logout({});

    expect(hooks.cleared).toEqual([SessionClearReasons.UNAUTHORIZED]);
  });
});

describe('without paths.checkAuth', () => {
  test('checkAuth announces the stored session once, and rejects as rejected when the token is gone', async () => {
    storeSession({ token: 'stored', userId: 3 });
    const provider = buildProvider({ withCheckPath: false });

    await provider.checkAuth({});
    await provider.checkAuth({});
    expect(api.checkCalls).toBe(0);
    expect(hooks.started).toHaveLength(1);

    localStorage.clear();
    await RejectionHelper.rejectionOf({ task: provider.checkAuth({}) });

    expect(hooks.cleared).toEqual([SessionClearReasons.REJECTED]);
  });
});
