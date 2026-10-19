---
title: Permission provider
description: Bind IPermissionProvider under CoreBindings.PERMISSION_PROVIDER to control what react-admin screens and actions are visible or blocked.
---

# Permission provider

To control who may do what in ARDOR, implement `IPermissionProvider` and bind it under `CoreBindings.PERMISSION_PROVIDER` in an application configuration class. ARDOR's `DefaultAuthProvider` exposes `canAccess` to react-admin and delegates each check to your permission provider. When no permission provider is bound, `DefaultAuthProvider` omits `canAccess`, and react-admin allows every check.

## What it does

`IPermissionProvider` defines the authorization contract for ARDOR applications. It receives access queries containing the target resource, action, and optional record, and resolves whether the current user is permitted to perform the action. `DefaultAuthProvider` discovers the provider in the container and attaches `canAccess` to the auth provider consumed by react-admin hooks (`useCanAccess`) and components (`<CanAccess>`).

| Export | Kind | Package | Purpose |
|---|---|---|---|
| `IPermissionProvider` | interface | `@venizia/ardor-kernel` | Contract for authorization checks: `canAccess({ resource, action, record })` |
| `CoreBindings.PERMISSION_PROVIDER` | const | `@venizia/ardor-kernel` | Container key (`@app/application/permission/provider`) where the provider is bound |
| `DefaultAuthProvider` | class | `@venizia/ardor-admin` | Auth provider that delegates `canAccess` to the bound `IPermissionProvider` |
| `IReactAdminAuthProvider` | interface | `@venizia/ardor-admin` | React-admin auth provider contract including optional `canAccess` |
| `IAuthProvider` | interface | `@venizia/ardor-admin` | ARDOR auth provider extending `IReactAdminAuthProvider` with `getRoles` and `refreshToken` |
| `DefaultAuthService` | class | `@venizia/ardor-kernel` | Service providing `getRoles()` to inspect the signed-in user's roles |

## How to provide it

ARDOR ships no default permission provider class. Unlike data or authentication providers, permission rules depend on your application's domain, role model, and business rules.

To enforce permissions, create a provider class that implements `IPermissionProvider` and bind it under `CoreBindings.PERMISSION_PROVIDER` using a `@provide` method in a `@configuration()` class. The configuration class is the main way to configure ARDOR: a `@configuration()` class whose `@provide({ key })` methods return the options or the provider instances; `start()` binds each as a lazy SINGLETON.

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

The configuration relies on the following defaults and container keys:
- Default class: None - ARDOR ships no default permission provider class; the application implements `IPermissionProvider`.
- Provider key: `CoreBindings.PERMISSION_PROVIDER` (`@app/application/permission/provider`).
- Options key: None - ARDOR defines no options type or options key for this provider.

## Options

ARDOR defines no options type or options binding key for `IPermissionProvider`: `CoreBindings` binds `IPermissionProvider` directly without an options type, and react-admin passes parameters to `canAccess` on each check.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `resource` | `string` | None (required) | The react-admin resource name (for example `'orders'`, `'users'`) |
| `action` | `string` | None (required) | The action being attempted (for example `'list'`, `'show'`, `'create'`, `'edit'`, `'delete'`) |
| `record` | `unknown` | `undefined` | The record being accessed; present for record-level actions and omitted for resource-level actions |
| `signal` | `AbortSignal` | `undefined` | React-admin query cancellation signal; received by `IReactAdminAuthProvider.canAccess` and not forwarded to `IPermissionProvider.canAccess` by `DefaultAuthProvider.value()` in `packages/admin/src/providers/auth.ts` |

## Example

The following complete example implements a role-based permission provider. It injects `CoreBindings.DEFAULT_AUTH_SERVICE` in the constructor to read the signed-in user's roles via `getRoles()`, grants full access to administrators, allows editors to perform all actions except deleting, and restricts viewers to read-only views (`'list'` and `'show'`).

Authentication and role storage are configured through the auth provider - see [Add sign-in](../guides/tutorials/add-sign-in) for how `login` extracts and persists roles.

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthService,
  type IPermissionProvider,
  inject,
  provide,
} from '@venizia/ardor';

export class RolePermissionProvider implements IPermissionProvider {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
    private readonly authService: DefaultAuthService,
  ) {}

  async canAccess(opts: { resource: string; action: string; record?: unknown }): Promise<boolean> {
    const roles = this.authService.getRoles();

    if (roles.has('admin')) {
      return true;
    }

    if (roles.has('editor')) {
      return opts.action !== 'delete';
    }

    if (roles.has('viewer')) {
      return opts.action === 'list' || opts.action === 'show';
    }

    return false;
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
    return this.application.instantiate(RolePermissionProvider);
  }
}
```

## How react-admin consumes canAccess

ra-core's `useCanAccess` queries the auth provider with `queryKey: ['auth', 'canAccess', { ...restParams, recordId: record?.id, resource }]`.

React-admin evaluates access rules through hooks such as `useCanAccess` and components such as `<CanAccess>`. When mounted, react-admin queries the auth provider's `canAccess` method and caches responses under query keys prefixed with `['auth', 'canAccess', ...]`.

When the user switches tenant, account, or workspace, the cached authorization results must be cleared so react-admin re-checks permissions against the new context. Because React Query matches query keys hierarchically, calling `invalidateQueries({ queryKey: ['auth'] })` marks all authentication queries, including every cached `canAccess` check, as stale and triggers refetches:

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

When an application subclasses `DefaultAuthProvider` and declares its own constructor, it does not need to forward four arguments to `super`. Inside `DefaultAuthProvider.value()`, the provider checks `this.permissionProvider` first; if unset, it resolves `CoreBindings.PERMISSION_PROVIDER` from the container with `isOptional: true`.

An explicit permission provider passed as the fourth argument to `super(...)` takes precedence over the container binding.

## Common pitfalls

- **Unbound provider:** Calling `useCanAccess` and seeing every action permitted means `CoreBindings.PERMISSION_PROVIDER` was not bound in the container; without it, `DefaultAuthProvider` omits `canAccess` and react-admin allows every check.
- **Stale cached queries:** After switching roles, sign-in sessions, or workspaces, react-admin retains cached `canAccess` results until the `['auth']` queries are invalidated with `invalidateQueries({ queryKey: ['auth'] })`.
- **Circular constructor injection:** In `packages/admin/src/providers/auth.ts`, `DefaultAuthProvider`'s constructor injects `CoreBindings.PERMISSION_PROVIDER` (optional). If a permission provider injects `CoreBindings.DEFAULT_AUTH_PROVIDER` in its constructor, the container encounters a circular dependency during resolution. Inject `CoreBindings.DEFAULT_AUTH_SERVICE` instead to inspect roles, or resolve `CoreBindings.DEFAULT_AUTH_PROVIDER` lazily inside `canAccess()` where `DefaultAuthProvider` is already constructed.

## Related

- [Application](./application) - The container lifecycle and configuration registration
- [Binding keys](./binding-keys) - Container keys in `CoreBindings`, including `CoreBindings.PERMISSION_PROVIDER`
- [Auth provider](./auth-provider) - `DefaultAuthProvider`, `getRoles`, and `canAccess` integration
- [Features](./features) - `IFeatureBase.permissions` is declared for a role editor; ARDOR enforces nothing (`packages/kernel/src/common/types.ts`)
- [Add sign-in](../guides/tutorials/add-sign-in) - Setting up authentication, sessions, and roles
