import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { DefaultAuthProvider, type TSessionClearReason } from '@/providers/auth';
import {
  BrowserStorage,
  CoreBindings,
  DefaultAuthService,
  type IAuthTokenRecord,
  type IStoredAuthUser,
} from '@venizia/ardor-kernel';
import { FakeStorage } from '@venizia/ardor-kernel/testing';
import { LoggerFactory } from '@venizia/ignis-helpers/core';
import { BindingKeys, Container } from '@venizia/ignis-inversion';

class RecordingAuthProvider extends DefaultAuthProvider {
  started: Array<{ token: IAuthTokenRecord; user: IStoredAuthUser }> = [];
  cleared: Array<TSessionClearReason> = [];

  protected override onSessionStarted(opts: {
    token: IAuthTokenRecord;
    user: IStoredAuthUser;
  }): void {
    this.started.push(opts);
  }

  protected override onSessionCleared(opts: { reason: TSessionClearReason }): void {
    this.cleared.push(opts.reason);
  }
}

const storageEvent = (opts: { key: string | null; storageArea: Storage }): Event => {
  return Object.assign(new Event('storage'), opts);
};

/** What the browser tells this tab when another tab changed `localStorage`. */
const fromOtherTab = (opts: { keys: Array<string | null> }) => {
  for (const key of opts.keys) {
    globalThis.dispatchEvent(storageEvent({ key, storageArea: localStorage }));
  }
};

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

const buildProvider = (opts: { service: DefaultAuthService }): RecordingAuthProvider => {
  const container = new Container();
  container
    .bind({ key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) })
    .toValue({});
  container
    .bind({ key: BindingKeys.build<unknown>({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }) })
    .toValue({});
  container
    .bind({ key: BindingKeys.build<unknown>({ key: CoreBindings.DEFAULT_AUTH_SERVICE }) })
    .toValue(opts.service);

  return container.instantiate(RecordingAuthProvider);
};

const SESSION_KEYS = ['@app/auth/token', '@app/auth/identity', '@app/auth/permission'];

/** A storage that tells this tab of each write of another tab on its own, in the order of the writes. */
class EventPerWriteStorage extends FakeStorage {
  override setItem(key: string, value: string): void {
    super.setItem(key, value);
    fromOtherTab({ keys: [key] });
  }

  override removeItem(key: string): void {
    super.removeItem(key);
    fromOtherTab({ keys: [key] });
  }
}

describe('DefaultAuthProvider and the session of another tab', () => {
  let service: DefaultAuthService;
  let provider: ReturnType<typeof buildProvider>;

  const otherTabSignsIn = (opts: { userId: number; token: string }) => {
    new DefaultAuthService().saveAuth({
      userId: opts.userId,
      username: `user-${opts.userId}`,
      token: { value: opts.token, type: 'Bearer' },
    });
    fromOtherTab({ keys: SESSION_KEYS });
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    service = new DefaultAuthService();
    provider = buildProvider({ service });
  });

  afterEach(() => {
    provider.dispose();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('another user signing in in another tab ends the session here, clearing only the data of this tab', async () => {
    new DefaultAuthService().saveAuth({ userId: 7, token: { value: 'jwt-7', type: 'Bearer' } });
    fromOtherTab({ keys: SESSION_KEYS });
    await settle();
    sessionStorage.setItem('@app/store/tab', 'alice tab');
    // The other tab cleared alice's data and then stored its own before this tab heard the change.
    localStorage.setItem('@app/store/bob', 'bob data');

    otherTabSignsIn({ userId: 8, token: 'jwt-8' });
    await settle();

    expect(provider.cleared).toEqual(['external']);
    expect(provider.started.at(-1)?.token.value).toBe('jwt-8');
    expect(sessionStorage.getItem('@app/store/tab')).toBeNull();
    expect(localStorage.getItem('@app/store/bob')).toBe('bob data');
  });

  test('a sweep of this tab that throws is logged, and the switch still ends the session and starts the next', async () => {
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();
    const logged = spyOn(
      LoggerFactory.getLogger(['DefaultAuthProvider']),
      'error',
    ).mockImplementation(() => undefined);
    const swept = spyOn(BrowserStorage, 'removeWhere').mockImplementation(() => {
      throw new Error('boom');
    });

    try {
      otherTabSignsIn({ userId: 8, token: 'jwt-8' });
      await settle();

      expect(provider.cleared).toEqual(['external']);
      expect(provider.started.at(-1)?.token.value).toBe('jwt-8');
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining('[clearStoredData] failed, the session ends anyway'),
        expect.objectContaining({ message: 'boom' }),
      );
    } finally {
      swept.mockRestore();
      logged.mockRestore();
    }
  });

  test('a user switch written key by key starts the session once, as the new user with the new token', async () => {
    const restoreStorage = new EventPerWriteStorage().install();
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();

    new DefaultAuthService().saveAuth({
      userId: 8,
      username: 'user-8',
      token: { value: 'jwt-8', type: 'Bearer' },
      roles: ['admin'],
    });
    await settle();
    restoreStorage();

    expect(provider.started.map((call) => `${call.user.userId}|${call.token.value}`)).toEqual([
      '7|jwt-7',
      '8|jwt-8',
    ]);
  });

  test("two switches close together start the session as the last user with the last token, never as one with the other's token", async () => {
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();

    new DefaultAuthService().saveAuth({ userId: 8, token: { value: 'jwt-alice', type: 'Bearer' } });
    // The second switch has stored its identity when this tab handles the event of the first token.
    localStorage.setItem('@app/auth/identity', JSON.stringify({ userId: 9 }));
    fromOtherTab({ keys: ['@app/auth/token'] });
    await settle();

    new DefaultAuthService().saveAuth({ userId: 9, token: { value: 'jwt-bob', type: 'Bearer' } });
    fromOtherTab({ keys: ['@app/auth/token'] });
    await settle();

    expect(provider.started.map((call) => `${call.user.userId}|${call.token.value}`)).toEqual([
      '7|jwt-7',
      '9|jwt-bob',
    ]);
  });

  test('checkAuth in the middle of a switch of another tab resolves and ends no session', async () => {
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();
    new DefaultAuthService().saveAuth({ userId: 8, token: { value: 'jwt-alice', type: 'Bearer' } });
    localStorage.setItem('@app/auth/identity', JSON.stringify({ userId: 9 }));

    await provider.checkAuth();

    expect(provider.cleared).toEqual([]);
    expect(localStorage.getItem('@app/auth/token')).not.toBeNull();
  });

  test('a sign-out written key by key ends the session once and starts none', async () => {
    const restoreStorage = new EventPerWriteStorage().install();
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();
    const started = provider.started.length;

    new DefaultAuthService().cleanUp();
    await settle();
    restoreStorage();

    expect(provider.started).toHaveLength(started);
    expect(provider.cleared).toEqual(['external']);
  });

  test('a sign-in in another tab starts the session here: the hook runs with the new user', async () => {
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();

    expect(provider.started).toHaveLength(1);
    expect(provider.started[0].token.value).toBe('jwt-7');
    expect(provider.started[0].user.userId).toBe(7);
    expect(provider.cleared).toEqual([]);
  });

  test('a user switch in another tab announces the new user', async () => {
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();

    otherTabSignsIn({ userId: 8, token: 'jwt-8' });
    await settle();

    expect(provider.started.map((call) => call.user.userId)).toEqual([7, 8]);
  });

  test('a sign-out in another tab ends the session here and removes the data of the ended session', async () => {
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();
    localStorage.setItem('@app/store/draft', 'private');
    sessionStorage.setItem('@app/store/tab', 'private');
    localStorage.setItem('@app/prefs/theme', 'dark');

    new DefaultAuthService().cleanUp();
    fromOtherTab({ keys: SESSION_KEYS });
    await settle();

    expect(provider.cleared).toEqual(['external']);
    expect(localStorage.getItem('@app/store/draft')).toBeNull();
    expect(sessionStorage.getItem('@app/store/tab')).toBeNull();
    expect(localStorage.getItem('@app/prefs/theme')).toBe('dark');
  });

  test('a clear of the storage in another tab ends the session here', async () => {
    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();

    localStorage.clear();
    fromOtherTab({ keys: [null] });
    await settle();

    expect(provider.cleared).toEqual(['external']);
  });

  test('a disposed provider no longer hears the other tabs', async () => {
    provider.dispose();

    otherTabSignsIn({ userId: 7, token: 'jwt-7' });
    await settle();

    expect(provider.started).toEqual([]);
  });
});
