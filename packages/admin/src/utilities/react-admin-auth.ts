import { type Container, getError } from '@venizia/ignis-inversion';

import {
  CoreBindings,
  type DefaultAuthService,
  type IApplicationInfo,
  type IPermissionProvider,
  LocalStorageKeys,
} from '@venizia/ardor-kernel';
import type { IAuthProvider } from '@/common';
import type { DefaultAuthProvider } from '@/providers/auth';
import type { ILoginParams } from '@/providers/auth-types';

export class ReactAdminAuthFactory {
  /**
   * The object react-admin holds: each method calls the provider, so a subclass override is reached.
   * Throws when the auth service does not use the application's `id`.
   */
  static build(opts: {
    container: Container;
    provider: Pick<
      DefaultAuthProvider,
      | 'login'
      | 'logout'
      | 'checkError'
      | 'checkAuth'
      | 'getIdentity'
      | 'getPermissions'
      | 'getRoles'
      | 'refreshToken'
    >;
    authService: DefaultAuthService;
    permissionProvider?: IPermissionProvider;
  }): IAuthProvider {
    const { container, provider, authService } = opts;

    // A subclass of DefaultAuthService with its own constructor must forward the application info to
    // super(info): without it the service keeps the unscoped session, silently shared with every other
    // application of the origin. Refuse that here, where the application info is at hand.
    const id = container.get<IApplicationInfo>({
      key: CoreBindings.APPLICATION_INFO,
      isOptional: true,
    })?.id;

    if (id !== undefined && authService.keys.token !== LocalStorageKeys.scoped({ id }).token) {
      throw getError({
        message: `[DefaultAuthProvider] The auth service does not use the application id '${id}': a subclass of DefaultAuthService with its own constructor passes the application info to super(info)`,
      });
    }

    // A subclass with its own constructor rarely forwards the optional 4th argument to `super`.
    const permissionProvider =
      opts.permissionProvider ??
      container.get<IPermissionProvider>({
        key: CoreBindings.PERMISSION_PROVIDER,
        isOptional: true,
      });

    return {
      login: (params: ILoginParams) => provider.login(params),
      logout: (params?: unknown) => provider.logout(params),
      checkError: (error: unknown) => provider.checkError(error),
      checkAuth: (params?: unknown) => provider.checkAuth(params),
      getIdentity: (params?: unknown) => provider.getIdentity(params),
      getPermissions: (params?: unknown) => provider.getPermissions(params),
      getRoles: (params?: unknown) => provider.getRoles(params),
      refreshToken: () => provider.refreshToken(),
      // Absent without a permission provider, so react-admin keeps allowing everything.
      ...(permissionProvider
        ? {
            canAccess: (params: Parameters<IPermissionProvider['canAccess']>[0]) => {
              const { resource, action, record } = params;

              return permissionProvider.canAccess({ resource, action, record });
            },
          }
        : {}),
    };
  }
}
