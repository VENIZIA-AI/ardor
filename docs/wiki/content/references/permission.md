---
title: Permission provider
description: Bind IPermissionProvider under CoreBindings.PERMISSION_PROVIDER to control what react-admin screens and actions are visible or blocked.
---

# Permission provider

> [!WARNING]
> The permission provider decides what the interface shows, not what a user may do. The roles are kept in browser storage and the provider runs in the browser, so anyone who controls the browser can change both. The backend must check every permission on every request; treat the interface as a convenience, never as the check.

ARDOR asks a permission provider whether the signed-in user may do an `action` on a `resource`. There are two ways to plug one in:

| You have | Use | You write |
|---|---|---|
| A table of roles and what each role may do | `RolePermissionProvider` | The table, as options, and one `bind` line |
| Another source of truth, or rules a table cannot say | Your own `IPermissionProvider` | The class, and one binding |

Both are bound under `CoreBindings.PERMISSION_PROVIDER`. `DefaultAuthProvider` hands every `canAccess` of react-admin to the bound provider. **An unbound provider allows everything:** `DefaultAuthProvider` then has no `canAccess`, and react-admin allows every check. ARDOR binds none by default.

## A role table with RolePermissionProvider

The roles of the signed-in user are the role names the auth service stored at sign-in (`DefaultAuthService.getRoles()`). `RolePermissionProvider` allows a check when any of those roles holds a grant that matches it. The first block is the whole setup: the role names, the table, and the one line that binds the provider. Sign-in must be on, because the roles come from the session ([Add sign-in](../guides/tutorials/add-sign-in)).

```ts
import { BindingScopes } from '@venizia/ignis-inversion';
import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  provideOption,
  RolePermissionProvider,
  type IApplicationInfo,
  type IRolePermissionProviderOptions,
  type TAuthProviderOptions,
} from '@venizia/ardor';

export class Roles {
  static readonly ADMIN = 'admin';
  static readonly EDITOR = 'editor';
  static readonly AUDITOR = 'auditor';
}

@configuration()
export class PermissionConfiguration {
  @provideOption({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authOptions(): TAuthProviderOptions {
    return { use: true };
  }

  @provideOption({ key: CoreBindings.PERMISSION_PROVIDER_OPTIONS })
  permissionOptions(): IRolePermissionProviderOptions {
    return {
      grants: {
        [Roles.ADMIN]: ['*'],
        [Roles.EDITOR]: ['orders.*'],
        [Roles.AUDITOR]: ['*.list', '*.show'],
      },
    };
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'A shop back office' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.PERMISSION_PROVIDER })
      .toClass(RolePermissionProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}
```

A route or resource then asks for what it needs. This feature route renders only for a user whose roles grant `audit.list`: here `admin` through `*` and `auditor` through `*.list`, not `editor`. See [A route that needs permission](./features#a-route-that-needs-permission).

```tsx
import React from 'react';
import { Features, type TFeature } from '@venizia/ardor';

const AuditPage: React.FC = () => <h1>Audit log</h1>;

export const AuditFeature: TFeature = Features.define({
  name: 'audit',
  routes: [{ path: '/audit', element: <AuditPage />, access: { resource: 'audit', action: 'list' } }],
});
```

To show or hide something in a component, ask react-admin with `useCanAccess` from `ra-core`, or read the roles with [`useRoles`](./hooks#useroles).

### Grant patterns

Each grant is a string with a resource and an action, joined by one dot:

| Pattern | Allows |
|---|---|
| `'orders.edit'` | The `edit` action on the `orders` resource |
| `'orders.*'` | Every action on `orders` |
| `'*.list'` | The `list` action on every resource |
| `'*'` | Everything |

Rules the provider follows:

- A user may do what any of their roles grants: the grants of several roles add up.
- Nothing else is allowed. A user with no roles, nobody signed in, and a role with no entry in the table are all denied. There is no deny grant.
- The roles are read on every check, so a new sign-in changes the answers at once.
- A pattern is checked when the provider is built. An empty string, a pattern with more than one dot, or an empty resource or action (`'orders.'`) throws an error that names the role and the pattern.
- A resource name must not contain a dot.

> [!NOTE]
> Roles are read at sign-in only. A token refresh keeps the roles it stored, so a role that changes on the server reaches the interface at the next sign-in. `RolePermissionProvider` does not ask the server for grants: the table is written in the application.

## Your own provider

Write a class that implements `IPermissionProvider` when the answer does not come from a role table: a permission list from your own endpoint, a check on the `record`, or a rule over several fields. Bind it under the same key:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  type IPermissionProvider,
  inject,
  provide,
} from '@venizia/ardor';

export class AppPermissionProvider implements IPermissionProvider {
  async canAccess(opts: { resource: string; action: string; record?: unknown }): Promise<boolean> {
    if (opts.resource === 'admin' && opts.action === 'delete') {
      return false;
    }
    return true;
  }
}

@configuration()
export class PermissionConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.PERMISSION_PROVIDER })
  permissionProvider(): IPermissionProvider {
    return this.application.instantiate(AppPermissionProvider);
  }
}
```

## What it does

| Export | Kind | Package | Purpose |
|---|---|---|---|
| `IPermissionProvider` | interface | `@venizia/ardor-kernel` | Contract for authorization checks: `canAccess({ resource, action, record })` |
| `CoreBindings.PERMISSION_PROVIDER` | const | `@venizia/ardor-kernel` | Container key (`@app/application/permission/provider`) where the provider is bound |
| `DefaultAuthProvider` | class | `@venizia/ardor-admin` | Auth provider that delegates `canAccess` to the bound `IPermissionProvider` |
| `IReactAdminAuthProvider` | type | `@venizia/ardor-admin` | React-admin auth provider contract including optional `canAccess` |
| `IAuthProvider` | interface | `@venizia/ardor-admin` | ARDOR auth provider extending `IReactAdminAuthProvider` with `getRoles` and `refreshToken` |
| `DefaultAuthService` | class | `@venizia/ardor-kernel` | Service providing `getRoles()` to inspect the signed-in user's roles |
| `RolePermissionProvider` | class | `@venizia/ardor-kernel` | Opt-in `IPermissionProvider` over a table of role grants; ARDOR binds none by default |
| `IRolePermissionProviderOptions` | interface | `@venizia/ardor-kernel` | The table: `{ grants }`, role name to grant patterns |
| `CoreBindings.PERMISSION_PROVIDER_OPTIONS` | const | `@venizia/ardor-kernel` | Container key (`@app/application/options/permission`) of that table |
| `useRoles` | hook | `@venizia/ardor-admin` | The roles of the signed-in user as a `ReadonlySet<string>`, kept current |

## Options

`IPermissionProvider` has no options of its own; `RolePermissionProvider` reads `{ grants }` from `CoreBindings.PERMISSION_PROVIDER_OPTIONS`. Parameters are passed to `canAccess` on each check:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `resource` | `string` | None (required) | The react-admin resource name (for example `'orders'`, `'users'`) |
| `action` | `string` | None (required) | The action being attempted (for example `'list'`, `'show'`, `'create'`, `'edit'`, `'delete'`) |
| `record` | `unknown` | `undefined` | The record being accessed; present for record-level actions and omitted for resource-level actions |
| `signal` | `AbortSignal` | `undefined` | React-admin query cancellation signal |

`signal` is received by `IReactAdminAuthProvider.canAccess` and not forwarded to `IPermissionProvider.canAccess` by `DefaultAuthProvider.value()` in `packages/admin/src/providers/auth.ts`.

## How react-admin consumes canAccess

react-admin asks `canAccess` for its own resource pages, and for a custom route only when the route declares `access`. A route without `access` is open to anyone who types its path, signed in or not, unless the application sets `requireAuth`. The feature route [above](#a-role-table-with-rolepermissionprovider) asks for `audit` and `list` before it renders; see [A route that needs permission](./features#a-route-that-needs-permission).

A feature's `menu` entries take the same `access`: `useMenuEntries()` lists an entry only once `canAccess` allows it. See [Menu entries](./features#menu-entries).

`IFeatureBase.permissions` enforces nothing. It is descriptive metadata: the permission names a feature's pages use, for a role editor to list. Only `access` on a route or a menu entry asks `canAccess`.

ra-core's `useCanAccess` queries the auth provider with `queryKey: ['auth', 'canAccess', { ...restParams, recordId: record?.id, resource }]`.

When switching tenant, account, or workspace, call `invalidateQueries({ queryKey: ['auth'] })` to clear cached authorization results:

```tsx
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';

export const ResetPermissionsButton: React.FC = () => {
  const queryClient = useQueryClient();

  const handleReset = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['auth'] });
  };

  return (
    <button type="button" onClick={handleReset}>
      Reset permissions
    </button>
  );
};
```

## Auth provider subclassing

`DefaultAuthProvider` accepts `permissionProvider` as an optional fourth constructor argument (`@inject({ key: CoreBindings.PERMISSION_PROVIDER, isOptional: true })`).

When an application subclasses `DefaultAuthProvider` and declares its own constructor, it does not need to forward four arguments to `super`. Inside `DefaultAuthProvider.value()`, the provider checks `this.permissionProvider` first; if unset, it resolves `CoreBindings.PERMISSION_PROVIDER` from the container with `isOptional: true`. An explicit permission provider passed as the fourth argument to `super(...)` takes precedence over the container binding.

> [!WARNING]
> In `packages/admin/src/providers/auth.ts`, `DefaultAuthProvider`'s constructor injects `CoreBindings.PERMISSION_PROVIDER` (optional). If a permission provider injects `CoreBindings.DEFAULT_AUTH_PROVIDER` in its constructor, the container encounters a circular dependency during resolution. Inject `CoreBindings.DEFAULT_AUTH_SERVICE` instead to inspect roles, or resolve `CoreBindings.DEFAULT_AUTH_PROVIDER` lazily inside `canAccess()` where `DefaultAuthProvider` is already constructed.

## Related

- [Application](./application) - The container lifecycle and configuration registration
- [Binding keys](./binding-keys) - Container keys in `CoreBindings`, including `CoreBindings.PERMISSION_PROVIDER`
- [Auth provider](./auth-provider) - `DefaultAuthProvider`, `getRoles`, and `canAccess` integration
- [Add sign-in](../guides/tutorials/add-sign-in) - Setting up authentication, sessions, and roles
