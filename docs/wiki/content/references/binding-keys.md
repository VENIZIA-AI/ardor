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
| `DEFAULT_REST_DATA_PROVIDER` | `@app/application/data/rest/default` | Application (`@provide`) | `ArdorApplication`, `DefaultAuthProvider`, `useRequestHeaderLocale` | Required |
| `AUTH_PROVIDER_OPTIONS` | `@app/application/options/auth` | Application (`@provide`) | `DefaultAuthProvider` | Required when `DEFAULT_AUTH_PROVIDER` is bound |
| `DEFAULT_AUTH_SERVICE` | `@app/application/service/auth/default` | Application (`@provide`) | `DefaultAuthProvider`; `DefaultRestDataProvider` (optional) | Required when `DEFAULT_AUTH_PROVIDER` is bound |
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
| `KEY_AUTH_PERMISSION` | `@app/auth/permission` | Stored user roles, a JSON array of names |
| `PREFIX_AUTH` | `@app/auth/` | Prefix of the session keys of an application with no `id` |
| `PREFIX_STORE` | `@app/store/` | The namespace for the data of the signed-in user |

`DefaultAuthService.cleanUp` removes everything under `keys.authPrefix` (`PREFIX_AUTH`, or `@app/auth/<id>/`). Sign-out removes everything under `PREFIX_STORE`. Keep what must outlive a sign-out (a theme) under `@app/prefs/<name>`, which no constant names.

The three `KEY_AUTH_*` keys belong to `LocalStorageKeys.SCHEME_SET` and can be verified with `LocalStorageKeys.isValid(value)`; the two `PREFIX_*` constants do not.

```ts
import { LocalStorageKeys } from '@venizia/ardor';

export const readStoredToken = (): string | null => {
  return localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
};
```

### Two applications on one origin

Browser storage is shared by every page of an origin. Two ARDOR applications served from one origin, say under `/shop` and `/blog`, would share one session and one `@app/store/` namespace. Give each an `id` in its application info (`IApplicationInfo.id`, letters, digits, `.`, `_` and `-`):

```ts
const info = { name: 'Shop', version: '1.0.0', description: 'The shop', id: 'shop' };
```

`LocalStorageKeys.scoped({ id })` answers the keys of one application: with the id `shop` the session is `@app/auth/shop/token`, `@app/auth/shop/identity` and `@app/auth/shop/permission`, and the store prefix is `@app/store/shop/`. `DefaultAuthService` takes the id from `CoreBindings.APPLICATION_INFO` and exposes the keys as `authService.keys`; its `cleanUp`, the auth provider's sign-out sweep and the request service's token all use them, so a sign-out in one application leaves the other's session and data alone. Name your own store keys with `authService.keys.storePrefix`. Without an `id` the keys are the ones in the table above, so an application that is alone on its origin changes nothing. An application without an `id` on a shared origin still sweeps all of `@app/auth/` and `@app/store/`, the others' keys included: give every application of an origin an `id`. The session keys all stay under `@app/auth/`, which `BrowserStorage` refuses to write.

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
  list(): Array<string> {
    return [];
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
