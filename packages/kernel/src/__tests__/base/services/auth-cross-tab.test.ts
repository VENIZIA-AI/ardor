import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { Container } from '@venizia/ignis-inversion';

import { DefaultAuthService } from '@/base/services/auth';
import { CoreBindings, type IApplicationInfo } from '@/common';
import { FakeStorage } from '@/testing';

const serviceOf = (id?: string): DefaultAuthService => {
  const info: IApplicationInfo = { name: 'app', version: '1', description: '', id };
  const container = new Container();
  container.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(info);
  container.bind({ key: 'services.Auth' }).toClass(DefaultAuthService);

  return container.get<DefaultAuthService>({ key: 'services.Auth' });
};

const signIn = (service: DefaultAuthService, name: string) => {
  service.saveAuth({
    userId: name,
    username: name,
    token: { value: `${name}-token`, type: 'Bearer' },
    roles: [`${name}-role`],
  });
};

const storageEvent = (opts: { key: string | null; storageArea: Storage }): Event => {
  return Object.assign(new Event('storage'), opts);
};

/** What another tab's write does to this tab: the event of each key it changed. */
const fromOtherTab = (opts: { keys: Array<string | null>; area?: Storage }) => {
  for (const key of opts.keys) {
    globalThis.dispatchEvent(storageEvent({ key, storageArea: opts.area ?? localStorage }));
  }
};

/** The storage of a browser: each write of another tab reaches this tab as its own event, in order. */
const eventPerWrite = (): (() => void) => {
  const setItem = spyOn(localStorage, 'setItem');
  const removeItem = spyOn(localStorage, 'removeItem');
  const area = localStorage;

  setItem.mockImplementation((key: string, value: string) => {
    FakeStorage.prototype.setItem.call(area, key, value);
    fromOtherTab({ keys: [key] });
  });
  removeItem.mockImplementation((key: string) => {
    FakeStorage.prototype.removeItem.call(area, key);
    fromOtherTab({ keys: [key] });
  });

  return () => {
    setItem.mockRestore();
    removeItem.mockRestore();
  };
};

describe('DefaultAuthService and the session of another tab', () => {
  let restore = () => {};

  let storage = new FakeStorage();

  beforeEach(() => {
    storage = new FakeStorage();
    restore = storage.install();
  });

  afterEach(() => {
    restore();
  });

  test('a sign-in in another tab reaches the subscribers of this one, once', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    const calls: Array<string> = [];
    const stop = tab.subscribe({
      listener: () => calls.push(tab.getAuth()?.value ?? 'signed-out'),
    });

    signIn(otherTab, 'alice');
    fromOtherTab({ keys: ['@app/auth/token', '@app/auth/identity', '@app/auth/permission'] });

    expect(calls).toEqual(['alice-token']);
    stop();
  });

  test('a user switch in another tab is announced once, when its token is written, as the new user with the new token', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    signIn(tab, 'alice');
    const seen: Array<string> = [];
    const stop = tab.subscribe({
      listener: () => seen.push(`${tab.getUser().userId}|${tab.getAuth()?.value}`),
    });
    const stopEvents = eventPerWrite();

    signIn(otherTab, 'bob');

    stopEvents();
    expect(seen).toEqual(['bob|bob-token']);
    stop();
  });

  test('a sign-out in another tab is announced once, when its token is removed, not as an identity without a token', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    signIn(tab, 'alice');
    const seen: Array<string> = [];
    const stop = tab.subscribe({
      listener: () => seen.push(`${tab.getUser().userId}|${tab.getAuth()?.value}`),
    });
    const stopEvents = eventPerWrite();

    otherTab.cleanUp();

    stopEvents();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEndWith('|undefined');
    stop();
  });

  test('saveAuth writes the token after the identity and the roles, and cleanUp removes the token first', () => {
    const tab = serviceOf();
    const order: Array<string> = [];
    const setItem = spyOn(localStorage, 'setItem');
    const removeItem = spyOn(localStorage, 'removeItem');
    setItem.mockImplementation((key: string, value: string) => {
      order.push(`set ${key}`);
      FakeStorage.prototype.setItem.call(localStorage, key, value);
    });
    removeItem.mockImplementation((key: string) => {
      order.push(`remove ${key}`);
      FakeStorage.prototype.removeItem.call(localStorage, key);
    });

    signIn(tab, 'alice');
    tab.cleanUp();
    setItem.mockRestore();
    removeItem.mockRestore();

    expect(order).toEqual([
      'set @app/auth/identity',
      'set @app/auth/permission',
      'set @app/auth/token',
      'remove @app/auth/token',
      'remove @app/auth/identity',
      'remove @app/auth/permission',
    ]);
  });

  test('a token of another user than the stored identity is not announced nor read until the pair is whole', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    signIn(tab, 'alice');
    const seen: Array<string> = [];
    const stop = tab.subscribe({
      listener: () => seen.push(`${tab.getUser().userId}|${tab.getAuth()?.value}`),
    });

    // The other tab switched twice: the identity of the second user is stored while this tab handles the event of the first token.
    signIn(otherTab, 'bob');
    localStorage.setItem('@app/auth/identity', JSON.stringify({ userId: 'carol' }));
    fromOtherTab({ keys: ['@app/auth/token'] });

    expect(seen).toEqual([]);
    expect(tab.getAuth()).toBeNull();

    signIn(otherTab, 'carol');
    fromOtherTab({ keys: ['@app/auth/token'] });

    expect(seen).toEqual(['carol|carol-token']);
    stop();
  });

  test('a page that comes back from the back-forward cache announces the session that changed meanwhile', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    signIn(tab, 'alice');
    const seen: Array<string> = [];
    const stop = tab.subscribe({
      listener: () => seen.push(`${tab.getUser().userId}|${tab.getAuth()?.value}`),
    });

    signIn(otherTab, 'bob');
    globalThis.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    expect(seen).toEqual([]);

    globalThis.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(seen).toEqual(['bob|bob-token']);
    stop();
  });

  test('a token stored without a userId is read as before', () => {
    const tab = serviceOf();
    storage.setItem('@app/auth/identity', JSON.stringify({ userId: 'alice' }));
    storage.setItem('@app/auth/token', JSON.stringify({ value: 'old-token', type: 'Bearer' }));

    expect(tab.getAuth()?.value).toBe('old-token');
  });

  test('a listener learns whether the change came from another tab', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    const external: Array<boolean> = [];
    const stop = tab.subscribe({ listener: (change) => external.push(change.isExternal) });

    signIn(tab, 'alice');
    signIn(otherTab, 'bob');
    fromOtherTab({ keys: ['@app/auth/token', '@app/auth/identity', '@app/auth/permission'] });

    expect(external).toEqual([false, true]);
    stop();
  });

  test('a sign-out in another tab reaches the subscribers of this one', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    signIn(tab, 'alice');
    const calls: Array<string> = [];
    const stop = tab.subscribe({
      listener: () => calls.push(tab.getAuth()?.value ?? 'signed-out'),
    });

    otherTab.cleanUp();
    fromOtherTab({ keys: ['@app/auth/token', '@app/auth/identity', '@app/auth/permission'] });

    expect(calls).toEqual(['signed-out']);
    stop();
  });

  test('a user switch in another tab reaches the subscribers of this one', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    signIn(tab, 'alice');
    const users: Array<unknown> = [];
    const stop = tab.subscribe({ listener: () => users.push(tab.getUser().userId) });

    signIn(otherTab, 'bob');
    fromOtherTab({ keys: ['@app/auth/token', '@app/auth/identity', '@app/auth/permission'] });

    expect(users).toEqual(['bob']);
    stop();
  });

  test('a clear of the storage (key null) in another tab reaches the subscribers', () => {
    const tab = serviceOf();
    signIn(tab, 'alice');
    const calls: Array<string> = [];
    const stop = tab.subscribe({
      listener: () => calls.push(tab.getAuth()?.value ?? 'signed-out'),
    });

    storage.clear();
    fromOtherTab({ keys: [null] });

    expect(calls).toEqual(['signed-out']);
    stop();
  });

  test('an event of a key that is not a session key is ignored', () => {
    const tab = serviceOf();
    let calls = 0;
    const stop = tab.subscribe({ listener: () => calls++ });

    fromOtherTab({ keys: ['@app/store/theme', '@app/prefs/theme', 'other', '@app/auth/'] });

    expect(calls).toBe(0);
    stop();
  });

  test('a scoped service ignores the keys of other applications, and an unscoped one those of scoped ones', () => {
    const shop = serviceOf('shop');
    const anonymous = serviceOf();
    const shopCalls: Array<string> = [];
    const anonymousCalls: Array<string> = [];
    const stops = [
      shop.subscribe({ listener: () => shopCalls.push('shop') }),
      anonymous.subscribe({ listener: () => anonymousCalls.push('anonymous') }),
    ];

    signIn(serviceOf('blog'), 'bob');
    fromOtherTab({
      keys: ['@app/auth/blog/token', '@app/auth/blog/identity', '@app/auth/blog/permission'],
    });

    expect(shopCalls).toEqual([]);
    expect(anonymousCalls).toEqual([]);

    signIn(serviceOf('shop'), 'alice');
    fromOtherTab({
      keys: ['@app/auth/shop/token', '@app/auth/shop/identity', '@app/auth/shop/permission'],
    });

    expect(shopCalls).toEqual(['shop']);
    expect(anonymousCalls).toEqual([]);

    for (const stop of stops) {
      stop();
    }
  });

  test('an event of the sessionStorage is ignored', () => {
    const sessionStorageFake = new FakeStorage();
    const restoreSession = sessionStorageFake.install('session');
    const tab = serviceOf();
    let calls = 0;
    const stop = tab.subscribe({ listener: () => calls++ });

    signIn(serviceOf(), 'alice');
    fromOtherTab({ keys: ['@app/auth/token'], area: sessionStorage });

    expect(calls).toBe(0);
    stop();
    restoreSession();
  });

  test('a change that the subscribers already know is not announced again', () => {
    const tab = serviceOf();
    let calls = 0;
    const stop = tab.subscribe({ listener: () => calls++ });

    signIn(tab, 'alice');
    expect(calls).toBe(1);
    fromOtherTab({ keys: ['@app/auth/token'] });

    expect(calls).toBe(1);
    stop();
  });

  test('handling the event of another tab writes nothing back', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    const stop = tab.subscribe({ listener: () => undefined });
    signIn(otherTab, 'alice');
    const keysBefore = Object.keys(storage).toSorted();
    const writesBefore = storage.writes.length;
    const setItem = spyOn(storage, 'setItem');
    const removeItem = spyOn(storage, 'removeItem');

    fromOtherTab({ keys: ['@app/auth/token', '@app/auth/identity', '@app/auth/permission', null] });

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(storage.writes.length).toBe(writesBefore);
    expect(Object.keys(storage).toSorted()).toEqual(keysBefore);
    stop();
  });

  test('a listener that calls cleanUp on the event of another tab is called once more, not forever', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    signIn(tab, 'alice');
    let calls = 0;
    const stop = tab.subscribe({
      listener: () => {
        calls++;

        if (calls === 1) {
          tab.cleanUp();
        }
      },
    });

    otherTab.cleanUp();
    fromOtherTab({ keys: ['@app/auth/token', '@app/auth/identity', '@app/auth/permission'] });

    // One for the event, one for the cleanUp the listener made.
    expect(calls).toBe(2);
    stop();
  });

  test('stops listening when the last subscriber leaves, and not before', () => {
    const tab = serviceOf();
    const otherTab = serviceOf();
    const first: Array<string> = [];
    const second: Array<string> = [];
    const stopFirst = tab.subscribe({ listener: () => first.push('first') });
    const stopSecond = tab.subscribe({ listener: () => second.push('second') });

    stopFirst();
    signIn(otherTab, 'alice');
    fromOtherTab({ keys: ['@app/auth/token'] });
    expect(first).toEqual([]);
    expect(second).toEqual(['second']);

    stopSecond();
    otherTab.cleanUp();
    fromOtherTab({ keys: ['@app/auth/token'] });
    expect(second).toEqual(['second']);
  });

  test('adds one window listener for any number of services and removes it with the last subscriber', () => {
    const add = spyOn(globalThis, 'addEventListener');
    const remove = spyOn(globalThis, 'removeEventListener');
    const storageCalls = (spy: typeof add) => spy.mock.calls.filter(([type]) => type === 'storage');
    const services = [serviceOf(), serviceOf(), serviceOf('shop')];

    expect(storageCalls(add)).toHaveLength(0);

    const stops = services.map((service) => service.subscribe({ listener: () => undefined }));
    // A second subscriber of one service does not add a subscription either.
    stops.push(services[0].subscribe({ listener: () => undefined }));

    expect(storageCalls(add)).toHaveLength(1);

    for (const stop of stops.slice(0, -1)) {
      stop();
    }

    expect(storageCalls(remove)).toHaveLength(0);
    stops[stops.length - 1]();
    expect(storageCalls(remove)).toHaveLength(1);

    // Leaving twice changes nothing.
    stops[stops.length - 1]();
    expect(storageCalls(remove)).toHaveLength(1);

    add.mockRestore();
    remove.mockRestore();
  });

  test('a service that is built and never subscribed to adds no window listener', () => {
    const add = spyOn(globalThis, 'addEventListener');

    serviceOf();

    expect(add.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(0);
    add.mockRestore();
  });
});

describe('DefaultAuthService outside a browser', () => {
  const originalLocal = globalThis.localStorage;
  const originalAdd = Object.getOwnPropertyDescriptor(globalThis, 'addEventListener');
  const originalRemove = Object.getOwnPropertyDescriptor(globalThis, 'removeEventListener');

  const define = (opts: { name: string; value: unknown }) => {
    Object.defineProperty(globalThis, opts.name, {
      value: opts.value,
      configurable: true,
      writable: true,
    });
  };

  afterEach(() => {
    define({ name: 'localStorage', value: originalLocal });

    if (originalAdd) {
      Object.defineProperty(globalThis, 'addEventListener', originalAdd);
    }

    if (originalRemove) {
      Object.defineProperty(globalThis, 'removeEventListener', originalRemove);
    }
  });

  test('subscribing and leaving does nothing and does not throw without localStorage', () => {
    define({ name: 'localStorage', value: undefined });
    const service = new DefaultAuthService();

    const stop = service.subscribe({ listener: () => undefined });

    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });

  test('subscribing and leaving does not throw without a window to listen on', () => {
    define({ name: 'localStorage', value: undefined });
    define({ name: 'addEventListener', value: undefined });
    define({ name: 'removeEventListener', value: undefined });
    const service = new DefaultAuthService();

    const stop = service.subscribe({ listener: () => undefined });

    expect(() => stop()).not.toThrow();
  });
});
