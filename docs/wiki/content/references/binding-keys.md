---
title: Binding keys
description: Every CoreBindings and LocalStorageKeys constant in ARDOR, who binds each key, who reads it, required or optional status, and useInjectable key resolution.
---

# Binding keys

`CoreBindings` defines the eleven keys used in the ARDOR container for application instances, options, providers, and features. `LocalStorageKeys` defines the keys used in browser storage for authentication state.

```ts
import { CoreBindings, useInjectable, type IDataProvider } from '@venizia/ardor';

export const useRestDataProvider = () => {
  return useInjectable<IDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });
};
```

## CoreBindings

`CoreBindings` is defined in `packages/kernel/src/common/keys.ts`.

| Constant | Value | Bound by | Read by | Status |
|---|---|---|---|---|
| `APPLICATION_INSTANCE` | `@app/application/instance` | Framework (`preConfigure()`) | Services, configurations, components | Always bound |
| `APPLICATION_INFO` | `@app/application/info` | Framework (`preConfigure()`) | `DefaultRestDataProvider`, network request tracing | Always bound |
| `DEFAULT_AUTH_PROVIDER` | `@app/application/auth/default` | Application (`@provide`) | `ArdorApplication` | Optional |
| `DEFAULT_I18N_PROVIDER` | `@app/application/i18n/default` | Application (`@provide`) | `ArdorApplication` | Required |
| `DEFAULT_REST_DATA_PROVIDER` | `@app/application/data/rest/default` | Application (`@provide`) | `ArdorApplication`, `DefaultAuthProvider` | Required |
| `AUTH_PROVIDER_OPTIONS` | `@app/application/options/auth` | Application (`@provide`) | `DefaultAuthProvider` | Required when `DEFAULT_AUTH_PROVIDER` is bound |
| `DEFAULT_AUTH_SERVICE` | `@app/application/service/auth/default` | Application (`@provide`) | `DefaultAuthProvider` | Required when `DEFAULT_AUTH_PROVIDER` is bound |
| `REST_DATA_PROVIDER_OPTIONS` | `@app/application/options/rest/data` | Application (`@provide`) | `DefaultRestDataProvider` | Required by `DefaultRestDataProvider` |
| `I18N_PROVIDER_OPTIONS` | `@app/application/options/i18n` | Application (`@provide`) | `DefaultI18nProvider` | Required by `DefaultI18nProvider` |
| `FEATURES` | `@app/application/features` | Framework (`preConfigure()`) | `ArdorApplication`, `DefaultI18nProvider` | Always bound |
| `PERMISSION_PROVIDER` | `@app/application/permission/provider` | Application (`@provide`) | `DefaultAuthProvider`, `canAccess` | Optional |

For binding order in the application lifecycle, see [The bind order in Configuration](../guides/core-concepts/configuration#the-bind-order) and [Application](application).

## LocalStorageKeys

`LocalStorageKeys` (defined in `packages/kernel/src/common/keys.ts`) provides keys for browser local storage.

| Constant | Value | Role |
|---|---|---|
| `KEY_AUTH_TOKEN` | `@app/auth/token` | Serialized authentication token record (`IAuthTokenRecord`) |
| `KEY_AUTH_IDENTITY` | `@app/auth/identity` | Stored user identity |
| `KEY_AUTH_PERMISSION` | `@app/auth/permission` | Stored user permissions and roles |

Each key belongs to `LocalStorageKeys.SCHEME_SET` and can be verified with `LocalStorageKeys.isValid(value)`.

```ts
import { LocalStorageKeys } from '@venizia/ardor';

export const readStoredToken = (): string | null => {
  return localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
};
```

## Key resolution in useInjectable

`useInjectable` accepts keys from the `TUseInjectableKeys` union:

- `TUseInjectableKeysDefault`: union of all string values on `CoreBindings`.
- `IUseInjectableKeysOverrides`: interface augmented to register custom keys.
- `TUseInjectableKeys`: `TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides`.

To resolve custom keys such as service namespaces (`services.<ClassName>`), augment `IUseInjectableKeysOverrides`:

```tsx
import { useInjectable } from '@venizia/ardor';

declare module '@venizia/ardor' {
  interface IUseInjectableKeysOverrides {
    'services.UserService': true;
  }
}

class UserService {
  list() {
    return [] as Array<string>;
  }
}

export const useUserService = () => {
  return useInjectable<UserService>({ key: 'services.UserService' });
};
```

## Related

- [Configuration](../guides/core-concepts/configuration) - declaring `@configuration()` classes and `@provide` methods
- [Application](application) - `preConfigure()`, `bindContext()`, and application lifecycle
- [Hooks](hooks) - `useInjectable` hook reference
- [Module augmentation](../best-practices/module-augmentation) - augmenting `IUseInjectableKeysOverrides`
