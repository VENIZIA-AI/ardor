---
title: Binding keys
description: Every CoreBindings and LocalStorageKeys constant - who binds it, who reads it, whether it is required, and how to resolve a class or a value with no class.
---

# Binding keys

`CoreBindings` defines the twelve keys used in the ARDOR container for application instances, options, providers, and features. `LocalStorageKeys` defines the keys used in browser storage for authentication state. A class you register is never resolved by a key: use its stereotype and `{ target }`. A key is for a value with no class, such as the ones below. Examples read hooks through `Ardor.useX`, the same functions as the bare `useX` exports.

```ts
import { Ardor, CoreBindings } from '@venizia/ardor';

// The key holds the IDataProvider the provider returns; its type needs no generic.
export const useRestDataProvider = () => {
  return Ardor.useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER });
};
```

## CoreBindings

`CoreBindings` is defined in `packages/kernel/src/common/keys.ts`.

| Constant | Value | Bound by | Read by | Status |
|---|---|---|---|---|
| `APPLICATION_INSTANCE` | `@app/application/instance` | Framework (`preConfigure()`) | Services, configurations, components | Always bound |
| `APPLICATION_INFO` | `@app/application/info` | Framework (`preConfigure()`) | `DefaultRestDataProvider`, `DefaultAuthService`, `DefaultAuthProvider`, `DefaultI18nProvider` | Always bound |
| `DEFAULT_AUTH_PROVIDER` | `@app/application/auth/default` | `BaseArdorApplication` (`DefaultAuthProvider`) | `ArdorApplication`, when sign-in is on | Bound by default |
| `DEFAULT_I18N_PROVIDER` | `@app/application/i18n/default` | `BaseArdorApplication` (`DefaultI18nProvider`) | `ArdorApplication` | Bound by default |
| `DEFAULT_REST_DATA_PROVIDER` | `@app/application/data/rest/default` | `BaseArdorApplication` (`DefaultRestDataProvider`) | `ArdorApplication`, `DefaultAuthProvider`, `useRequestHeaderLocale` | Bound by default |
| `AUTH_PROVIDER_OPTIONS` | `@app/application/options/auth` | Application (`@provide`) | `DefaultAuthProvider`, `ArdorApplication` | `{ use: true }` signs in; unbound is `{ use: false }` |
| `DEFAULT_AUTH_SERVICE` | `@app/application/service/auth/default` | `BaseArdorApplication` (`DefaultAuthService`) | `DefaultAuthProvider`, `RolePermissionProvider`, `useRoles`; optional: `ArdorApplication`, `DefaultRestDataProvider` | Bound by default |
| `REST_DATA_PROVIDER_OPTIONS` | `@app/application/options/rest/data` | Application (`@provide`) | `DefaultRestDataProvider` | Required |
| `I18N_PROVIDER_OPTIONS` | `@app/application/options/i18n` | Application (`@provide`) | `DefaultI18nProvider` | Optional: unbound is English only |
| `FEATURES` | `@app/application/features` | Framework (`preConfigure()`) | `ArdorApplication`, `DefaultI18nProvider` | Always bound |
| `PERMISSION_PROVIDER` | `@app/application/permission/provider` | Application (`bindContext()`, or `@provide`) | `DefaultAuthProvider`, `canAccess` | Optional |
| `PERMISSION_PROVIDER_OPTIONS` | `@app/application/options/permission` | Application (`@provide`) | `RolePermissionProvider` | Required by `RolePermissionProvider` |

`BaseArdorApplication` binds the defaults itself, before anything of the application. To replace one, bind your provider class under its key in `bindContext()`: `.toProvider(MyProvider).setScope(BindingScopes.SINGLETON)`.

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
| `PREFIX_PREFS` | `@app/prefs/` | The namespace for preferences that outlive a sign-out, such as the chosen language |

`DefaultAuthService.cleanUp` removes the session keys under `keys.authPrefix` (`PREFIX_AUTH`, or `@app/auth/<id>/`); without an `id` it skips the keys of applications that have one. Sign-out removes every key that starts with `keys.storePrefix`. Keep what must outlive a sign-out (a theme) under `PREFIX_PREFS` (`@app/prefs/<name>`); the i18n provider keeps the chosen locale there.

The three `KEY_AUTH_*` keys belong to `LocalStorageKeys.SCHEME_SET` and can be verified with `LocalStorageKeys.isValid(value)`; the three `PREFIX_*` constants do not.

```ts
import { LocalStorageKeys } from '@venizia/ardor';

export const readStoredToken = (): string | null => {
  return localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
};
```

### Two applications on one origin

Browser storage is shared by every page of an origin. Two ARDOR applications served from one origin, say under `/shop` and `/blog`, would share one session and one `@app/store/` namespace. Give each an `id` in its application info (`IApplicationInfo.id`, letters, digits, `.`, `_` and `-`):

```ts
import type { IApplicationInfo } from '@venizia/ardor';

const info: IApplicationInfo = {
  name: 'Shop',
  version: '1.0.0',
  description: 'The shop',
  id: 'shop',
};
```

`LocalStorageKeys.scoped({ id })` answers the keys of one application: with the id `shop` the session is `@app/auth/shop/token`, `@app/auth/shop/identity` and `@app/auth/shop/permission`, the store prefix is `@app/store/shop/` and the preferences prefix is `@app/prefs/shop/` (`keys.prefsPrefix`; the chosen locale is `keys.locale`). `DefaultAuthService` takes the id from `CoreBindings.APPLICATION_INFO` and exposes the keys as `authService.keys`; its `cleanUp`, the auth provider's sign-out sweep and the request service's token all use them, so a sign-out in one application leaves the other's session and data alone. Name your own store keys with `authService.keys.storePrefix`. Without an `id` the keys are the ones in the table above, so an application that is alone on its origin changes nothing. An application without an `id` leaves the sessions of the others alone at sign-out, but its store prefix `@app/store/` starts every other application's `@app/store/<id>/`, so its sign-out still removes their store data: give every application of an origin an `id`. The session keys all stay under `@app/auth/`, which `BrowserStorage` refuses to write.

## Resolve a class: by target

A class you registered has a key that its registration recorded on the class. Resolve it by the class and the key never appears: the type is inferred, and the hook checks the namespace.

```tsx
import { Ardor, service } from '@venizia/ardor';

@service()
export class UserService {
  list(): Array<string> {
    return [];
  }
}

export const useUserNames = () => {
  const userService = Ardor.useService({ target: UserService });

  return userService.list();
};
```

## A binding with no class: by key

A value bound by hand has only its key. Keep it in a `static readonly` constants class, give its type to `IUseInjectableKeyTypes`, and read it with `useInjectable({ key })`:

```tsx
import { Ardor, configuration, provide } from '@venizia/ardor';

interface IPricingOptions {
  currency: string;
}

export class PricingBindings {
  static readonly OPTIONS = '@app/pricing/options';
}

declare module '@venizia/ardor' {
  interface IUseInjectableKeyTypes {
    [PricingBindings.OPTIONS]: IPricingOptions;
  }
}

@configuration()
export class PricingConfiguration {
  @provide({ key: PricingBindings.OPTIONS })
  options(): IPricingOptions {
    return { currency: 'EUR' };
  }
}

export const useCurrency = () => {
  const options = Ardor.useInjectable({ key: PricingBindings.OPTIONS });

  return options.currency;
};
```

The hook accepts a key from these sets:

- `TUseInjectableKeysDefault`: union of all string values on `CoreBindings`.
- `IUseInjectableKeyTypes`: an interface you augment with a key and its type. The hook returns that type with no generic. The three providers of `CoreBindings` are listed already.
- `IUseInjectableKeysOverrides`: an interface you augment with a key and no type. The key is valid, and the type is the one you pass as the generic: your claim, which nothing checks.
- `TUseInjectableKeys`: the union of the three.

## Related

- [Configuration](../guides/core-concepts/configuration) - declaring `@configuration()` classes and `@provide` methods
- [Application](application) - `preConfigure()`, `bindContext()`, and application lifecycle
- [Hooks](hooks) - `useService`, `useInjectable` and the other hooks
- [Module augmentation](../best-practices/module-augmentation) - typing the keys of values bound by hand, and translation keys
