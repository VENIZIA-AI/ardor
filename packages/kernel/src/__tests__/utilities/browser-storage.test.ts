import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { type IStorageCodec, LocalStorageKeys, StorageAreas } from '@/common';
import { BrowserStorage } from '@/utilities/browser-storage';

class StorageStub implements Storage {
  [name: string]: unknown;

  get length(): number {
    return Object.keys(this).length;
  }

  getItem(key: string): string | null {
    const value = Object.getOwnPropertyDescriptor(this, key)?.value;
    return typeof value === 'string' ? value : null;
  }

  setItem(key: string, value: string): void {
    this[key] = value;
  }

  removeItem(key: string): void {
    delete this[key];
  }

  clear(): void {
    for (const key of Object.keys(this)) {
      delete this[key];
    }
  }

  key(index: number): string | null {
    return Object.keys(this)[index] ?? null;
  }
}

class QuotaStorage extends StorageStub {
  override setItem(_key: string, _value: string): void {
    throw new DOMException('The quota has been exceeded', 'QuotaExceededError');
  }
}

class BlockedStorage extends StorageStub {
  override getItem(_key: string): string | null {
    throw new DOMException('Access is denied', 'SecurityError');
  }

  override removeItem(_key: string): void {
    throw new DOMException('Access is denied', 'SecurityError');
  }
}

class UnlistableStorage extends StorageStub {
  override get length(): number {
    throw new DOMException('Access is denied', 'SecurityError');
  }
}

const upperCase: IStorageCodec<string> = {
  encode: (value) => value.toUpperCase(),
  decode: (text) => text.toLowerCase(),
};

const install = (opts: {
  name: 'localStorage' | 'sessionStorage';
  storage: Storage | undefined;
}) => {
  Object.defineProperty(globalThis, opts.name, {
    value: opts.storage,
    configurable: true,
    writable: true,
  });
};

const originalLocal = globalThis.localStorage;

const storageEvent = (opts: { key: string | null; storageArea: Storage }): Event => {
  return Object.assign(new Event('storage'), opts);
};

beforeEach(() => {
  install({ name: 'localStorage', storage: new StorageStub() });
  install({ name: 'sessionStorage', storage: new StorageStub() });
});

afterEach(() => {
  install({ name: 'localStorage', storage: originalLocal });
  install({ name: 'sessionStorage', storage: undefined });
});

describe('BrowserStorage.get', () => {
  test('reads a JSON value, and the fallback for a key that is not there', () => {
    localStorage.setItem('@app/store/theme', JSON.stringify({ mode: 'dark' }));

    expect(BrowserStorage.get({ key: '@app/store/theme', fallback: { mode: 'light' } })).toEqual({
      mode: 'dark',
    });
    expect(BrowserStorage.get({ key: '@app/store/none', fallback: 3 })).toBe(3);
  });

  test('gives the fallback for text the codec cannot decode', () => {
    localStorage.setItem('@app/store/theme', '{not json');

    expect(BrowserStorage.get({ key: '@app/store/theme', fallback: 'light' })).toBe('light');
  });

  test('gives the fallback when the accessor throws', () => {
    install({ name: 'localStorage', storage: new BlockedStorage() });

    expect(BrowserStorage.get({ key: '@app/store/theme', fallback: 'light' })).toBe('light');
  });

  test('gives the fallback when the area does not exist, as on a server', () => {
    install({ name: 'sessionStorage', storage: undefined });

    expect(
      BrowserStorage.get({
        key: '@app/store/theme',
        fallback: 'light',
        storage: StorageAreas.SESSION,
      }),
    ).toBe('light');
  });

  test('reads the area named by storage, and decodes with a custom codec', () => {
    sessionStorage.setItem('@app/store/name', 'ALICE');
    localStorage.setItem('@app/store/name', 'BOB');

    expect(
      BrowserStorage.get({
        key: '@app/store/name',
        fallback: '',
        storage: StorageAreas.SESSION,
        codec: upperCase,
      }),
    ).toBe('alice');
    expect(BrowserStorage.get({ key: '@app/store/name', fallback: '', codec: upperCase })).toBe(
      'bob',
    );
  });
});

describe('BrowserStorage.set', () => {
  test('stores a JSON value and answers true', () => {
    const stored = BrowserStorage.set({ key: '@app/store/theme', value: { mode: 'dark' } });

    expect(stored).toBe(true);
    expect(localStorage.getItem('@app/store/theme')).toBe('{"mode":"dark"}');
  });

  test('stores in the named area with a custom codec', () => {
    BrowserStorage.set({
      key: '@app/store/name',
      value: 'alice',
      storage: StorageAreas.SESSION,
      codec: upperCase,
    });

    expect(sessionStorage.getItem('@app/store/name')).toBe('ALICE');
    expect(localStorage.getItem('@app/store/name')).toBeNull();
  });

  test('answers false, and never throws, when the quota is exceeded', () => {
    install({ name: 'localStorage', storage: new QuotaStorage() });

    expect(BrowserStorage.set({ key: '@app/store/theme', value: 'dark' })).toBe(false);
  });

  test('answers false for a value the codec cannot encode', () => {
    expect(BrowserStorage.set({ key: '@app/store/theme', value: undefined })).toBe(false);
    expect(localStorage.getItem('@app/store/theme')).toBeNull();
  });

  test('answers false when the area does not exist', () => {
    install({ name: 'sessionStorage', storage: undefined });

    expect(
      BrowserStorage.set({ key: '@app/store/theme', value: 1, storage: StorageAreas.SESSION }),
    ).toBe(false);
  });

  test('refuses a key under the session prefix and leaves the session alone', () => {
    localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, 'real-token');

    const stored = BrowserStorage.set({ key: LocalStorageKeys.KEY_AUTH_TOKEN, value: 'forged' });

    expect(stored).toBe(false);
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBe('real-token');
  });
});

describe('BrowserStorage.remove', () => {
  test('removes a key and answers true', () => {
    localStorage.setItem('@app/store/theme', '"dark"');

    expect(BrowserStorage.remove({ key: '@app/store/theme' })).toBe(true);
    expect(localStorage.getItem('@app/store/theme')).toBeNull();
  });

  test('answers false, and never throws, when the accessor throws', () => {
    install({ name: 'localStorage', storage: new BlockedStorage() });

    expect(BrowserStorage.remove({ key: '@app/store/theme' })).toBe(false);
  });

  test('refuses a key under the session prefix', () => {
    localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, 'real-token');

    expect(BrowserStorage.remove({ key: LocalStorageKeys.KEY_AUTH_TOKEN })).toBe(false);
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBe('real-token');
  });
});

describe('BrowserStorage.keys', () => {
  beforeEach(() => {
    localStorage.setItem('@app/store/theme', '"dark"');
    localStorage.setItem('@app/store/old/a', '1');
    localStorage.setItem('@app/store/old/b', '2');
    sessionStorage.setItem('@app/store/old/session', '3');
  });

  test('lists every key of the area, and only the keys with the prefix when one is given', () => {
    expect(BrowserStorage.keys().sort()).toEqual([
      '@app/store/old/a',
      '@app/store/old/b',
      '@app/store/theme',
    ]);
    expect(BrowserStorage.keys({ prefix: '@app/store/old/' }).sort()).toEqual([
      '@app/store/old/a',
      '@app/store/old/b',
    ]);
    expect(BrowserStorage.keys({ prefix: '@app/store/none' })).toEqual([]);
  });

  test('reads the area named by storage', () => {
    expect(BrowserStorage.keys({ storage: StorageAreas.SESSION })).toEqual([
      '@app/store/old/session',
    ]);
  });

  test('lists the session keys too, because listing writes nothing', () => {
    localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, 'real-token');

    expect(BrowserStorage.keys({ prefix: LocalStorageKeys.PREFIX_AUTH })).toEqual([
      LocalStorageKeys.KEY_AUTH_TOKEN,
    ]);
  });

  test('answers [], and never throws, when the area is missing or cannot be listed', () => {
    install({ name: 'sessionStorage', storage: undefined });
    expect(BrowserStorage.keys({ storage: StorageAreas.SESSION })).toEqual([]);

    install({ name: 'localStorage', storage: new UnlistableStorage() });
    expect(BrowserStorage.keys()).toEqual([]);
  });
});

describe('BrowserStorage.removeWhere', () => {
  beforeEach(() => {
    localStorage.setItem('@app/store/theme', '"dark"');
    localStorage.setItem('@app/store/old/a', '1');
    localStorage.setItem('@app/store/old/b', '2');
    sessionStorage.setItem('@app/store/old/session', '3');
  });

  test('removes every key with the prefix, answers how many, and leaves the others', () => {
    expect(BrowserStorage.removeWhere({ prefix: '@app/store/old/' })).toBe(2);
    expect(BrowserStorage.keys()).toEqual(['@app/store/theme']);
    expect(sessionStorage.getItem('@app/store/old/session')).toBe('3');
  });

  test('works in the area named by storage', () => {
    expect(
      BrowserStorage.removeWhere({ prefix: '@app/store/old/', storage: StorageAreas.SESSION }),
    ).toBe(1);
    expect(localStorage.getItem('@app/store/old/a')).toBe('1');
  });

  test('answers 0 for a prefix nothing has', () => {
    expect(BrowserStorage.removeWhere({ prefix: '@app/store/none' })).toBe(0);
    expect(BrowserStorage.keys()).toHaveLength(3);
  });

  test('an empty prefix removes nothing, so a call cannot clear an area by leaving the prefix out', () => {
    expect(BrowserStorage.removeWhere({ prefix: '' })).toBe(0);
    expect(BrowserStorage.keys()).toHaveLength(3);
  });

  test('never removes a key under the session prefix, even when the prefix reaches it', () => {
    localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, 'real-token');

    expect(BrowserStorage.removeWhere({ prefix: '@app/' })).toBe(3);
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBe('real-token');
    expect(BrowserStorage.removeWhere({ prefix: LocalStorageKeys.PREFIX_AUTH })).toBe(0);
    expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBe('real-token');
  });

  test('notifies the subscribers of each removed key, and of no other', () => {
    const calls: Array<string> = [];
    const stops = [
      BrowserStorage.subscribe({ key: '@app/store/old/a', listener: () => calls.push('a') }),
      BrowserStorage.subscribe({ key: '@app/store/old/b', listener: () => calls.push('b') }),
      BrowserStorage.subscribe({ key: '@app/store/theme', listener: () => calls.push('theme') }),
    ];

    BrowserStorage.removeWhere({ prefix: '@app/store/old/' });
    for (const stop of stops) {
      stop();
    }

    expect(calls.sort()).toEqual(['a', 'b']);
  });

  test('answers 0, and never throws, when the area is missing, cannot be listed or refuses removals', () => {
    install({ name: 'sessionStorage', storage: undefined });
    expect(BrowserStorage.removeWhere({ prefix: '@app/', storage: StorageAreas.SESSION })).toBe(0);

    install({ name: 'localStorage', storage: new UnlistableStorage() });
    expect(BrowserStorage.removeWhere({ prefix: '@app/' })).toBe(0);

    const blocked = new BlockedStorage();
    blocked.setItem('@app/store/old/a', '1');
    install({ name: 'localStorage', storage: blocked });
    expect(BrowserStorage.removeWhere({ prefix: '@app/' })).toBe(0);
  });
});

describe('BrowserStorage.subscribe in one tab', () => {
  test('a set and a remove through BrowserStorage notify the subscribers of that key and area only', () => {
    const calls: Array<string> = [];
    const stops = [
      BrowserStorage.subscribe({ key: '@app/store/a', listener: () => calls.push('a') }),
      BrowserStorage.subscribe({ key: '@app/store/b', listener: () => calls.push('b') }),
      BrowserStorage.subscribe({
        key: '@app/store/a',
        storage: StorageAreas.SESSION,
        listener: () => calls.push('a-session'),
      }),
    ];

    BrowserStorage.set({ key: '@app/store/a', value: 1 });
    BrowserStorage.remove({ key: '@app/store/a' });

    expect(calls).toEqual(['a', 'a']);
    for (const stop of stops) {
      stop();
    }
  });

  test('a write that failed notifies nobody', () => {
    install({ name: 'localStorage', storage: new QuotaStorage() });
    const calls: Array<string> = [];
    const stop = BrowserStorage.subscribe({ key: '@app/store/a', listener: () => calls.push('a') });

    BrowserStorage.set({ key: '@app/store/a', value: 1 });

    expect(calls).toEqual([]);
    stop();
  });

  test('stops notifying after the returned function is called', () => {
    const calls: Array<string> = [];
    const stop = BrowserStorage.subscribe({ key: '@app/store/a', listener: () => calls.push('a') });
    stop();

    BrowserStorage.set({ key: '@app/store/a', value: 1 });

    expect(calls).toEqual([]);
  });

  test('a listener that throws does not break the write or the other listeners', () => {
    const calls: Array<string> = [];
    const stops = [
      BrowserStorage.subscribe({
        key: '@app/store/a',
        listener: () => {
          throw new Error('listener failed');
        },
      }),
      BrowserStorage.subscribe({ key: '@app/store/a', listener: () => calls.push('second') }),
    ];

    const stored = BrowserStorage.set({ key: '@app/store/a', value: 1 });

    expect(stored).toBe(true);
    expect(calls).toEqual(['second']);
    for (const stop of stops) {
      stop();
    }
  });
});

describe('BrowserStorage.subscribe across tabs', () => {
  test('a storage event of the same area and key notifies, and another key or area does not', () => {
    const calls: Array<string> = [];
    const stop = BrowserStorage.subscribe({ key: '@app/store/a', listener: () => calls.push('a') });

    globalThis.dispatchEvent(storageEvent({ key: '@app/store/a', storageArea: localStorage }));
    globalThis.dispatchEvent(storageEvent({ key: '@app/store/b', storageArea: localStorage }));
    globalThis.dispatchEvent(storageEvent({ key: '@app/store/a', storageArea: sessionStorage }));

    expect(calls).toEqual(['a']);
    stop();
  });

  test('a storage event for a clear (key null) notifies every subscriber of that area', () => {
    const calls: Array<string> = [];
    const stops = [
      BrowserStorage.subscribe({ key: '@app/store/a', listener: () => calls.push('a') }),
      BrowserStorage.subscribe({ key: '@app/store/b', listener: () => calls.push('b') }),
    ];

    globalThis.dispatchEvent(storageEvent({ key: null, storageArea: localStorage }));

    expect(calls).toEqual(['a', 'b']);
    for (const stop of stops) {
      stop();
    }
  });

  test('one window listener serves all subscribers and is removed with the last one', () => {
    const add = spyOn(globalThis, 'addEventListener');
    const remove = spyOn(globalThis, 'removeEventListener');
    const first = BrowserStorage.subscribe({ key: '@app/store/a', listener: () => undefined });
    const second = BrowserStorage.subscribe({ key: '@app/store/b', listener: () => undefined });

    expect(add.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);

    first();
    expect(remove.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(0);
    second();
    expect(remove.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);

    add.mockRestore();
    remove.mockRestore();
  });
});
