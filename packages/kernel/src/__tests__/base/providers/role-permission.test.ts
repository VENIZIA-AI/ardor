import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { BindingScopes } from '@venizia/ignis-inversion';
import { MetadataRegistry } from '@venizia/ignis-kernel/metadata';

import { configuration, provideOption } from '@/base/metadata';
import { RolePermissionProvider } from '@/base/providers';
import { DefaultAuthService } from '@/base/services/auth';
import {
  CoreBindings,
  type IApplicationInfo,
  type IPermissionProvider,
  type IRolePermissionProviderOptions,
} from '@/common';
import { TestArdorApplication } from '../applications/test-application';

class Roles {
  static readonly ADMIN = 'admin';
  static readonly EDITOR = 'editor';
  static readonly VIEWER = 'viewer';
  static readonly AUDITOR = 'auditor';
  static readonly UNKNOWN = 'stranger';
}

class Resources {
  static readonly ORDERS = 'orders';
  static readonly STOCKS = 'stocks';
}

class Actions {
  static readonly LIST = 'list';
  static readonly SHOW = 'show';
  static readonly EDIT = 'edit';
}

const SESSION_TOKEN = { value: 'tok', type: 'Bearer' };

const signIn = (opts: { service: DefaultAuthService; userId: string; roles: Array<string> }) => {
  opts.service.saveAuth({ userId: opts.userId, token: SESSION_TOKEN, roles: opts.roles });
};

const create = (opts: IRolePermissionProviderOptions) => {
  const service = new DefaultAuthService();
  const provider = new RolePermissionProvider(service, opts);

  return { service, provider };
};

const isAllowed = (opts: { provider: IPermissionProvider; resource: string; action: string }) => {
  return opts.provider.canAccess({ resource: opts.resource, action: opts.action });
};

describe('RolePermissionProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('an exact grant allows that resource and action only', async () => {
    const { service, provider } = create({ grants: { [Roles.EDITOR]: ['orders.edit'] } });
    signIn({ service, userId: '1', roles: [Roles.EDITOR] });

    const result = await isAllowed({ provider, resource: Resources.ORDERS, action: Actions.EDIT });
    expect(result).toBe(true);
    const result2 = await isAllowed({ provider, resource: Resources.ORDERS, action: Actions.LIST });
    expect(result2).toBe(false);
    const result3 = await isAllowed({ provider, resource: Resources.STOCKS, action: Actions.EDIT });
    expect(result3).toBe(false);
  });

  test('a wildcard action allows every action of the resource', async () => {
    const { service, provider } = create({ grants: { [Roles.EDITOR]: ['orders.*'] } });
    signIn({ service, userId: '1', roles: [Roles.EDITOR] });

    const result4 = await isAllowed({ provider, resource: Resources.ORDERS, action: Actions.LIST });
    expect(result4).toBe(true);
    const result5 = await isAllowed({ provider, resource: Resources.ORDERS, action: Actions.EDIT });
    expect(result5).toBe(true);
    const result6 = await isAllowed({ provider, resource: Resources.STOCKS, action: Actions.LIST });
    expect(result6).toBe(false);
  });

  test('a wildcard resource allows the action on every resource', async () => {
    const { service, provider } = create({ grants: { [Roles.VIEWER]: ['*.list'] } });
    signIn({ service, userId: '1', roles: [Roles.VIEWER] });

    const result7 = await isAllowed({ provider, resource: Resources.ORDERS, action: Actions.LIST });
    expect(result7).toBe(true);
    const result8 = await isAllowed({ provider, resource: Resources.STOCKS, action: Actions.LIST });
    expect(result8).toBe(true);
    const result9 = await isAllowed({ provider, resource: Resources.ORDERS, action: Actions.EDIT });
    expect(result9).toBe(false);
  });

  test('"*" allows everything', async () => {
    const { service, provider } = create({ grants: { [Roles.ADMIN]: ['*'] } });
    signIn({ service, userId: '1', roles: [Roles.ADMIN] });

    const result10 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.EDIT,
    });
    expect(result10).toBe(true);
    const result11 = await isAllowed({ provider, resource: 'anything', action: 'whatever' });
    expect(result11).toBe(true);
  });

  test('the roles of a user add up: one role that allows is enough', async () => {
    const { service, provider } = create({
      grants: {
        [Roles.VIEWER]: ['orders.list'],
        [Roles.EDITOR]: ['stocks.edit'],
      },
    });
    signIn({ service, userId: '1', roles: [Roles.VIEWER, Roles.EDITOR] });

    const result12 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result12).toBe(true);
    const result13 = await isAllowed({
      provider,
      resource: Resources.STOCKS,
      action: Actions.EDIT,
    });
    expect(result13).toBe(true);
    const result14 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.EDIT,
    });
    expect(result14).toBe(false);
  });

  test('a user with no roles is denied', async () => {
    const { service, provider } = create({ grants: { [Roles.ADMIN]: ['*'] } });
    signIn({ service, userId: '1', roles: [] });

    const result15 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result15).toBe(false);
  });

  test('nobody signed in is denied', async () => {
    const { service, provider } = create({ grants: { [Roles.ADMIN]: ['*'] } });

    const result16 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result16).toBe(false);

    signIn({ service, userId: '1', roles: [Roles.ADMIN] });
    service.cleanUp();

    const result17 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result17).toBe(false);
  });

  test('a role with no entry is denied, also one named like an object member', async () => {
    const { service, provider } = create({ grants: { [Roles.ADMIN]: ['*'] } });
    signIn({
      service,
      userId: '1',
      roles: [Roles.UNKNOWN, 'constructor', 'toString', '__proto__'],
    });

    const result18 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result18).toBe(false);
  });

  test('a grant for another resource does not open this one', async () => {
    const { service, provider } = create({
      grants: { [Roles.AUDITOR]: ['stocks.list', 'stocks.show'] },
    });
    signIn({ service, userId: '1', roles: [Roles.AUDITOR] });

    const result19 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result19).toBe(false);
    const result20 = await isAllowed({
      provider,
      resource: Resources.STOCKS,
      action: Actions.SHOW,
    });
    expect(result20).toBe(true);
  });

  test('a resource that only starts like the granted one is not matched', async () => {
    const { service, provider } = create({ grants: { [Roles.VIEWER]: ['order.list'] } });
    signIn({ service, userId: '1', roles: [Roles.VIEWER] });

    const result21 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result21).toBe(false);
  });

  test('reads the roles at call time: another user gets other answers', async () => {
    const { service, provider } = create({
      grants: {
        [Roles.ADMIN]: ['*'],
        [Roles.VIEWER]: ['orders.list'],
      },
    });

    signIn({ service, userId: '1', roles: [Roles.ADMIN] });
    const result22 = await isAllowed({
      provider,
      resource: Resources.STOCKS,
      action: Actions.EDIT,
    });
    expect(result22).toBe(true);

    signIn({ service, userId: '2', roles: [Roles.VIEWER] });
    const result23 = await isAllowed({
      provider,
      resource: Resources.STOCKS,
      action: Actions.EDIT,
    });
    expect(result23).toBe(false);
    const result24 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result24).toBe(true);
  });

  test('an empty grants table denies everyone', async () => {
    const { service, provider } = create({ grants: {} });
    signIn({ service, userId: '1', roles: [Roles.ADMIN] });

    const result25 = await isAllowed({
      provider,
      resource: Resources.ORDERS,
      action: Actions.LIST,
    });
    expect(result25).toBe(false);
  });
});

describe('RolePermissionProvider refuses an invalid grant pattern when it is built', () => {
  const build = (opts: { pattern: string }) => {
    return () => create({ grants: { [Roles.EDITOR]: ['orders.list', opts.pattern] } });
  };

  test.each(['', 'orders.list.extra', 'a.b.c', '.', 'orders.', '.list'])(
    'throws for %j, naming the role and the pattern',
    (pattern) => {
      expect(build({ pattern })).toThrow(Roles.EDITOR);
      expect(build({ pattern })).toThrow(JSON.stringify(pattern));
    },
  );

  test('throws for a pattern that is not a string', () => {
    const grants: Record<string, ReadonlyArray<unknown>> = { [Roles.EDITOR]: [42] };

    // @ts-expect-error a number is not a grant pattern
    expect(() => create({ grants })).toThrow(Roles.EDITOR);
  });

  test.each(['orders.list', 'orders.*', '*.list', '*'])('accepts %j', (pattern) => {
    expect(build({ pattern })).not.toThrow();
  });
});

@configuration()
class PermissionConfiguration {
  @provideOption({ key: CoreBindings.PERMISSION_PROVIDER_OPTIONS })
  permissionOptions(): IRolePermissionProviderOptions {
    return { grants: { [Roles.EDITOR]: ['orders.*'] } };
  }
}

class PermissionApplication extends TestArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'role-permission-test', version: '1.0.0', description: 'role grants' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
      .toValue(new DefaultAuthService())
      .setScope(BindingScopes.SINGLETON);
    this.bind({ key: CoreBindings.PERMISSION_PROVIDER })
      .toClass(RolePermissionProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}

describe('RolePermissionProvider in an application', () => {
  const registry = MetadataRegistry.getInstance();
  let discovered: ReturnType<typeof registry.getDiscoveredArtifacts> = [];

  beforeEach(() => {
    localStorage.clear();
    discovered = registry.getDiscoveredArtifacts();
  });

  afterEach(() => {
    localStorage.clear();
    registry.clearDiscoveredArtifacts();

    for (const target of discovered) {
      registry.addDiscoveredArtifact({ target });
    }
  });

  test('is built by the container from the auth service and the options of its key', async () => {
    const application = new PermissionApplication();
    await application.start();

    expect(PermissionConfiguration.name).toBe('PermissionConfiguration');

    const provider = application.get<IPermissionProvider>({
      key: CoreBindings.PERMISSION_PROVIDER,
    });
    const service = application.get<DefaultAuthService>({
      key: CoreBindings.DEFAULT_AUTH_SERVICE,
    });

    expect(provider).toBeInstanceOf(RolePermissionProvider);
    expect(provider).toBe(application.get({ key: CoreBindings.PERMISSION_PROVIDER }));

    signIn({ service, userId: '1', roles: [Roles.EDITOR] });

    const result = await isAllowed({ provider, resource: Resources.ORDERS, action: Actions.EDIT });
    expect(result).toBe(true);
    const result2 = await isAllowed({ provider, resource: Resources.STOCKS, action: Actions.EDIT });
    expect(result2).toBe(false);
  });
});
