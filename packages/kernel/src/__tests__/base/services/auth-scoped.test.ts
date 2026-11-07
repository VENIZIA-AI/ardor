import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { Container } from '@venizia/ignis-inversion';

import { DefaultAuthService } from '@/base/services/auth';
import { DefaultNetworkRequestService } from '@/base/services/network-request';
import { CoreBindings, type IApplicationInfo, LocalStorageKeys } from '@/common';
import { FakeStorage } from '@/testing';

const info = (id?: string): IApplicationInfo => ({
  name: 'app',
  version: '1',
  description: '',
  id,
});

const serviceOf = (id?: string): DefaultAuthService => {
  const container = new Container();
  container.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(info(id));
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

describe('LocalStorageKeys.scoped', () => {
  test('without an id the keys are the constants, so a single application changes nothing', () => {
    expect(LocalStorageKeys.scoped()).toEqual({
      authPrefix: LocalStorageKeys.PREFIX_AUTH,
      storePrefix: LocalStorageKeys.PREFIX_STORE,
      token: LocalStorageKeys.KEY_AUTH_TOKEN,
      identity: LocalStorageKeys.KEY_AUTH_IDENTITY,
      permission: LocalStorageKeys.KEY_AUTH_PERMISSION,
    });
  });

  test('with an id every key sits under the prefix of that id, still under the session prefix', () => {
    const keys = LocalStorageKeys.scoped({ id: 'shop-1.eu' });

    expect(keys).toEqual({
      authPrefix: '@app/auth/shop-1.eu/',
      storePrefix: '@app/store/shop-1.eu/',
      token: '@app/auth/shop-1.eu/token',
      identity: '@app/auth/shop-1.eu/identity',
      permission: '@app/auth/shop-1.eu/permission',
    });
    expect(keys.token.startsWith(LocalStorageKeys.PREFIX_AUTH)).toBe(true);
  });

  test.each([[null], [5], [true], [['a']], [{}]])('a non-string id %p is refused', (id) => {
    expect(() => LocalStorageKeys.scoped({ id: id as unknown as string })).toThrow(
      'IApplicationInfo.id',
    );
  });

  test.each(['', '.', '..', '...', 'a/b', 'a b', '../x', 'a\\b', 'é', 'a?b', 'a#b'])(
    'the id %p is refused',
    (id) => {
      expect(() => LocalStorageKeys.scoped({ id })).toThrow('IApplicationInfo.id');
    },
  );
});

describe('DefaultAuthService with an application id', () => {
  let restore = () => {};

  let storage = new FakeStorage();

  beforeEach(() => {
    storage = new FakeStorage();
    restore = storage.install();
  });

  afterEach(() => {
    restore();
  });

  test('two applications on one storage share no session', () => {
    const shop = serviceOf('shop');
    const blog = serviceOf('blog');

    signIn(shop, 'alice');

    expect(shop.getAuth()?.value).toBe('alice-token');
    expect(blog.getAuth()).toBeNull();
    expect(blog.getUser()).toEqual({});
    expect([...blog.getRoles()]).toEqual([]);
    expect(Object.keys(storage).toSorted()).toEqual([
      '@app/auth/shop/identity',
      '@app/auth/shop/permission',
      '@app/auth/shop/token',
    ]);
  });

  test('cleanUp removes the session of its application only', () => {
    const shop = serviceOf('shop');
    const blog = serviceOf('blog');
    signIn(shop, 'alice');
    signIn(blog, 'bob');

    shop.cleanUp();

    expect(shop.getAuth()).toBeNull();
    expect(blog.getAuth()?.value).toBe('bob-token');
    expect(blog.getUser()).toMatchObject({ userId: 'bob' });
  });

  test('the roles of two applications on one storage stay apart', () => {
    const shop = serviceOf('shop');
    const blog = serviceOf('blog');
    signIn(shop, 'alice');
    signIn(blog, 'bob');

    expect([...shop.getRoles()]).toEqual(['alice-role']);
    expect([...blog.getRoles()]).toEqual(['bob-role']);
  });

  test('a subclass that forwards the application info keeps the id, one that does not has the unscoped keys', () => {
    class Forwarding extends DefaultAuthService {
      constructor(applicationInfo?: IApplicationInfo) {
        super(applicationInfo);
      }
    }
    class Forgetting extends DefaultAuthService {
      constructor() {
        super();
      }
    }

    expect(new Forwarding(info('shop')).keys.token).toBe('@app/auth/shop/token');
    expect(new Forgetting().keys.token).toBe(LocalStorageKeys.KEY_AUTH_TOKEN);
  });

  test('an id that is a prefix of another id does not reach it', () => {
    const short = serviceOf('app');
    const long = serviceOf('app-2');
    signIn(long, 'carol');

    short.cleanUp();

    expect(long.getAuth()?.value).toBe('carol-token');
  });

  test('without an id the keys are the unscoped ones, built by the container or by hand', () => {
    const byContainer = serviceOf();
    const byHand = new DefaultAuthService();

    signIn(byContainer, 'dave');

    expect(Object.keys(storage).toSorted()).toEqual([
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      LocalStorageKeys.KEY_AUTH_PERMISSION,
      LocalStorageKeys.KEY_AUTH_TOKEN,
    ]);
    expect(byHand.getAuth()?.value).toBe('dave-token');
  });

  test('an invalid id stops the service from being built', () => {
    expect(() => serviceOf('a/b')).toThrow('IApplicationInfo.id');
  });

  test('the network service sends the token of its auth service, not of another application', () => {
    const shop = serviceOf('shop');
    const blog = serviceOf('blog');
    signIn(shop, 'alice');
    signIn(blog, 'bob');

    class Probe extends DefaultNetworkRequestService {
      token() {
        return this.resolveAuthToken();
      }
    }
    const probe = (authService: DefaultAuthService) =>
      new Probe({ name: 'probe', baseUrl: 'http://x.invalid', authService }).token();

    expect(probe(shop)?.value).toBe('alice-token');
    expect(probe(blog)?.value).toBe('bob-token');
  });

  test('createAuthTokenReader reads the token of its application, as the auth service does', () => {
    const shop = serviceOf('shop');
    const blog = serviceOf('blog');
    signIn(shop, 'alice');
    signIn(blog, 'bob');

    const readShop = DefaultNetworkRequestService.createAuthTokenReader({ id: 'shop' });
    const readBlog = DefaultNetworkRequestService.createAuthTokenReader({ id: 'blog' });

    expect(readShop()?.value).toBe('alice-token');
    expect(readShop()).toEqual(shop.getAuth() ?? undefined);
    expect(readBlog()?.value).toBe('bob-token');
    // The unscoped reader does not see an application that has an id.
    expect(DefaultNetworkRequestService.readAuthTokenFromStorage()).toBeUndefined();
  });

  test('createAuthTokenReader reads at call time, and is undefined after sign-out', () => {
    const shop = serviceOf('shop');
    const read = DefaultNetworkRequestService.createAuthTokenReader({ id: 'shop' });

    expect(read()).toBeUndefined();

    signIn(shop, 'alice');
    expect(read()?.value).toBe('alice-token');

    shop.cleanUp();
    expect(read()).toBeUndefined();
  });

  test('createAuthTokenReader without an id is the unscoped reader, and an invalid id is refused', () => {
    signIn(serviceOf(), 'carol');

    expect(DefaultNetworkRequestService.createAuthTokenReader()()?.value).toBe('carol-token');
    expect(() => DefaultNetworkRequestService.createAuthTokenReader({ id: 'a/b' })).toThrow(
      'IApplicationInfo.id',
    );
  });
});
