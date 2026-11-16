import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { BindingScopes } from '@venizia/ignis-inversion';
import { MetadataRegistry } from '@venizia/ignis-kernel/metadata';

import { BaseArdorApplication } from '@/applications';
import type { IAuthProvider } from '@/common';
import {
  configuration,
  CoreBindings,
  type DefaultAuthService,
  type IApplicationInfo,
  type IRolePermissionProviderOptions,
  provide,
  RolePermissionProvider,
} from '@venizia/ardor-kernel';

class Roles {
  static readonly EDITOR = 'editor';
  static readonly VIEWER = 'viewer';
}

class Resources {
  static readonly ORDERS = 'orders';
  static readonly STOCKS = 'stocks';
}

class Actions {
  static readonly LIST = 'list';
  static readonly EDIT = 'edit';
}

@configuration()
class PermissionConfiguration {
  @provide({ key: CoreBindings.PERMISSION_PROVIDER_OPTIONS })
  permissionOptions(): IRolePermissionProviderOptions {
    return {
      grants: {
        [Roles.EDITOR]: ['orders.*'],
        [Roles.VIEWER]: ['*.list'],
      },
    };
  }
}

class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'role grants through the auth provider' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: 'http://localhost/api',
    });
    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({ use: true });
    this.bind({ key: CoreBindings.PERMISSION_PROVIDER })
      .toClass(RolePermissionProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}

class PlainApplication extends ShopApplication {
  override bindContext(): void {
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: 'http://localhost/api',
    });
    this.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({ use: true });
  }
}

describe('the auth provider answers canAccess through RolePermissionProvider', () => {
  const registry = MetadataRegistry.getInstance();
  let discovered: ReadonlyArray<object> = [];

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

  const signIn = (opts: { application: BaseArdorApplication; roles: Array<string> }) => {
    opts.application
      .get<DefaultAuthService>({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
      .saveAuth({ userId: 1, token: { value: 'jwt', type: 'Bearer' }, roles: opts.roles });
  };

  test('follows the roles of whoever is signed in', async () => {
    const application = new ShopApplication();
    await application.start();

    expect(PermissionConfiguration.name).toBe('PermissionConfiguration');

    const authProvider = application.get<IAuthProvider>({
      key: CoreBindings.DEFAULT_AUTH_PROVIDER,
    });

    expect(authProvider.canAccess).toBeFunction();

    signIn({ application, roles: [Roles.EDITOR] });
    const result = await authProvider.canAccess?.({
      resource: Resources.ORDERS,
      action: Actions.EDIT,
    });
    expect(result).toBe(true);
    const result2 = await authProvider.canAccess?.({
      resource: Resources.STOCKS,
      action: Actions.EDIT,
    });
    expect(result2).toBe(false);

    signIn({ application, roles: [Roles.VIEWER] });
    const result3 = await authProvider.canAccess?.({
      resource: Resources.STOCKS,
      action: Actions.LIST,
    });
    expect(result3).toBe(true);
    const result4 = await authProvider.canAccess?.({
      resource: Resources.ORDERS,
      action: Actions.EDIT,
    });
    expect(result4).toBe(false);

    application.get<DefaultAuthService>({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).cleanUp();
    const result5 = await authProvider.canAccess?.({
      resource: Resources.STOCKS,
      action: Actions.LIST,
    });
    expect(result5).toBe(false);
  });

  test('without a permission provider bound the auth provider has no canAccess', async () => {
    const application = new PlainApplication();
    await application.start();

    const authProvider = application.get<IAuthProvider>({
      key: CoreBindings.DEFAULT_AUTH_PROVIDER,
    });

    expect(authProvider.canAccess).toBeUndefined();
  });
});
