---
title: Permission provider
description: Bind IPermissionProvider under CoreBindings.PERMISSION_PROVIDER to control what react-admin screens and actions are visible or blocked.
---

# Permission provider

To control who may do what in ARDOR, implement `IPermissionProvider` and bind it under `CoreBindings.PERMISSION_PROVIDER` in an application configuration class. ARDOR's `DefaultAuthProvider` exposes `canAccess` to react-admin and delegates each check to your permission provider; when unbound, `DefaultAuthProvider` omits `canAccess`, and react-admin allows every check.

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
| `IReactAdminAuthProvider` | interface | `@venizia/ardor-admin` | React-admin auth provider contract including optional `canAccess` |
| `IAuthProvider` | interface | `@venizia/ardor-admin` | ARDOR auth provider extending `IReactAdminAuthProvider` with `getRoles` and `refreshToken` |
| `DefaultAuthService` | class | `@venizia/ardor-kernel` | Service providing `getRoles()` to inspect the signed-in user's roles |

## Options

ARDOR defines no options binding key for `IPermissionProvider`. Parameters are passed to `canAccess` on each check:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `resource` | `string` | None (required) | The react-admin resource name (for example `'orders'`, `'users'`) |
| `action` | `string` | None (required) | The action being attempted (for example `'list'`, `'show'`, `'create'`, `'edit'`, `'delete'`) |
| `record` | `unknown` | `undefined` | The record being accessed; present for record-level actions and omitted for resource-level actions |
| `signal` | `AbortSignal` | `undefined` | React-admin query cancellation signal; received by `IReactAdminAuthProvider.canAccess` and not forwarded to `IPermissionProvider.canAccess` by `DefaultAuthProvider.value()` in `packages/admin/src/providers/auth.ts` |

## How react-admin consumes canAccess

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
