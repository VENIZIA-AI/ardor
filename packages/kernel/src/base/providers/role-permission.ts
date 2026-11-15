import { BaseHelper } from '@venizia/ignis-helpers/core';
import { getError, inject } from '@venizia/ignis-inversion';

import {
  CoreBindings,
  type IPermissionProvider,
  type IRolePermissionProviderOptions,
} from '@/common';
import type { DefaultAuthService } from '../services/auth';

interface IGrant {
  resource: string;
  action: string;
}

class GrantPattern {
  static readonly WILDCARD = '*';
  static readonly SEPARATOR = '.';

  /** Splits a grant pattern into its resource and action; throws, naming the role and the pattern, when it is not one. */
  static parse(opts: { role: string; pattern: unknown }): IGrant {
    const { role, pattern } = opts;

    if (typeof pattern === 'string') {
      if (pattern === this.WILDCARD) {
        return { resource: this.WILDCARD, action: this.WILDCARD };
      }

      const parts = pattern.split(this.SEPARATOR);
      const [resource, action] = parts;

      if (parts.length === 2 && resource && action) {
        return { resource, action };
      }
    }

    throw getError({
      message: `[RolePermissionProvider] Invalid grant ${JSON.stringify(pattern)} for role '${role}': use '<resource>.<action>', '<resource>.*', '*.<action>' or '*'`,
    });
  }

  static matches(opts: { grant: IGrant; resource: string; action: string }): boolean {
    const { grant, resource, action } = opts;

    return (
      (grant.resource === this.WILDCARD || grant.resource === resource) &&
      (grant.action === this.WILDCARD || grant.action === action)
    );
  }
}

/**
 * An `IPermissionProvider` over a table the application writes: each role name holds grant patterns,
 * and a user may do what any of the roles from `DefaultAuthService.getRoles` grants. Nothing else is
 * allowed: no signed-in user, no roles, or a role without an entry is denied. The roles are read at
 * every call and are the ones stored at sign-in; a token refresh keeps them.
 *
 * It is opt-in: ARDOR binds none, and unbound means every check passes. An application with other
 * needs writes its own `IPermissionProvider` and binds that under `CoreBindings.PERMISSION_PROVIDER`.
 * The roles are data in the browser: this decides what the interface shows, never what a user may
 * do, and the backend must check every request.
 *
 * @example
 * ```ts
 * import { BindingScopes } from '@venizia/ignis-inversion';
 * import {
 *   BaseArdorApplication,
 *   configuration,
 *   CoreBindings,
 *   provideOption,
 *   RolePermissionProvider,
 *   type IApplicationInfo,
 *   type IRolePermissionProviderOptions,
 * } from '@venizia/ardor';
 *
 * @configuration()
 * export class PermissionConfiguration {
 *   @provideOption({ key: CoreBindings.PERMISSION_PROVIDER_OPTIONS })
 *   permissionOptions(): IRolePermissionProviderOptions {
 *     return { grants: { admin: ['*'], editor: ['orders.*', 'stocks.list'] } };
 *   }
 * }
 *
 * export class Application extends BaseArdorApplication {
 *   getAppInfo(): IApplicationInfo {
 *     return { name: 'shop', version: '1.0.0', description: 'A shop back office' };
 *   }
 *
 *   bindContext(): void {
 *     this.bind({ key: CoreBindings.PERMISSION_PROVIDER })
 *       .toClass(RolePermissionProvider)
 *       .setScope(BindingScopes.SINGLETON);
 *   }
 * }
 * ```
 */
export class RolePermissionProvider extends BaseHelper implements IPermissionProvider {
  private readonly grants = new Map<string, ReadonlyArray<IGrant>>();

  constructor(
    @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
    private readonly authService: DefaultAuthService,
    @inject({ key: CoreBindings.PERMISSION_PROVIDER_OPTIONS })
    options: IRolePermissionProviderOptions,
  ) {
    super({ scope: RolePermissionProvider.name });

    for (const [role, patterns] of Object.entries(options.grants)) {
      this.grants.set(
        role,
        patterns.map((pattern) => GrantPattern.parse({ role, pattern })),
      );
    }
  }

  async canAccess(opts: { resource: string; action: string; record?: unknown }): Promise<boolean> {
    const { resource, action } = opts;

    for (const role of this.authService.getRoles()) {
      const grants = this.grants.get(role) ?? [];

      if (grants.some((grant) => GrantPattern.matches({ grant, resource, action }))) {
        return true;
      }
    }

    return false;
  }
}
