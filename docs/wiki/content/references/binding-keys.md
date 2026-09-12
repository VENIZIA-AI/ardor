---
title: Binding keys
description: Every CoreBindings and LocalStorageKeys constant, which keys the framework binds itself, the services.* namespace produced by service(), and how useInjectable keys are typed and augmented.
---

# Binding keys

`CoreBindings` is a class of string constants. Each constant is a key in the IGNIS container that an ARDOR application extends. `LocalStorageKeys` is the same idea for browser storage. This page lists every key, says who is responsible for binding it, and shows how the key union that `useInjectable` accepts is built and extended.

## Prerequisites

You have an application class that extends `AbstractArdorApplication` or `BaseArdorApplication` (see [Application](../references/application)).

## Quick Reference

| Export | Kind | Package | Role |
|---|---|---|---|
| `CoreBindings` | class | `@venizia/ardor` | Container keys for the application, providers, services and their options |
| `LocalStorageKeys` | class | `@venizia/ardor` | Keys for auth state in `localStorage` |
| `AbstractArdorApplication.injectable` | method | `@venizia/ardor` | Binds a class under `${scope}.${ClassName}` as a singleton |
| `AbstractArdorApplication.service` | method | `@venizia/ardor` | `injectable('services', value)` |
| `useInjectable` | const | `@venizia/ardor` | Resolves a binding by `key` or by class `target` |
| `TUseInjectableKeysDefault` | type | `@venizia/ardor` | Union of every `CoreBindings` string value |
| `IUseInjectableKeysOverrides` | interface | `@venizia/ardor-react` | Empty interface you augment to add keys |
| `TUseInjectableKeys` | type | `@venizia/ardor` | `TUseInjectableKeysDefault \| keyof IUseInjectableKeysOverrides` |
| `TUseInjectableOptions` | type | `@venizia/ardor` | Options union accepted by `useInjectable` |

## CoreBindings

All keys and their string values, exactly as defined in the kernel.

| Constant | Value | Bound by |
|---|---|---|
| `APPLICATION_INSTANCE` | `@app/application/instance` | Framework (`preConfigure`) |
| `APPLICATION_INFO` | `@app/application/info` | Framework (`preConfigure`) |
| `DEFAULT_AUTH_PROVIDER` | `@app/application/auth/default` | `bindContext()` |
| `DEFAULT_I18N_PROVIDER` | `@app/application/i18n/default` | `bindContext()` |
| `DEFAULT_REST_DATA_PROVIDER` | `@app/application/data/rest/default` | `bindContext()` |
| `DEFAULT_AUTH_SERVICE` | `@app/application/service/auth/default` | `bindContext()` |
| `AUTH_PROVIDER_OPTIONS` | `@app/application/options/auth` | `bindContext()` |
| `REST_DATA_PROVIDER_OPTIONS` | `@app/application/options/rest/data` | `bindContext()` |
| `I18N_PROVIDER_OPTIONS` | `@app/application/options/i18n` | `bindContext()` |

The three `*_OPTIONS` keys hold the options objects read by the matching provider: `IAuthProviderOptions`, `IRestDataProviderOptions` and `II18nProviderOptions`. The provider keys hold the provider instances. See [Data provider](../references/data-provider), [Auth provider](../references/auth-provider) and [i18n](../references/i18n) for what each provider expects.

```ts
import { CoreBindings } from '@venizia/ardor';

const key: string = CoreBindings.DEFAULT_REST_DATA_PROVIDER;
// '@app/application/data/rest/default'
```

## What the framework binds itself

`AbstractArdorApplication.start()` runs `preConfigure()` and then `postConfigure()`. `preConfigure()` binds exactly two keys before it calls your `bindContext()`:

```ts no-check
export abstract class AbstractArdorApplication {
  ...
  preConfigure(): ValueOrPromise<void> {
    this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this);
    this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo());
    return this.bindContext();
  }
  ...
}
```

- `APPLICATION_INSTANCE` is the application object itself.
- `APPLICATION_INFO` is whatever `getAppInfo()` returns, bound as a value. `getAppInfo()` is typed `ValueOrPromise<IApplicationInfo>`, so if you return a promise, the promise is what gets bound.

`postConfigure()` is a no-op in the abstract class. Nothing else is bound by the kernel. Every other `CoreBindings` key is the job of `bindContext()` - either yours or the one in the subclass you extend. Check [Application](../references/application) for what `ArdorApplication` from `@venizia/ardor-admin` binds for you.

## What the application binds

`bindContext()` is abstract. It runs after the two framework keys are in place, so it can read them. Bind options with `toValue`, and bind providers or services with `toClass` or `service()`.

```ts no-check
import { BaseArdorApplication, CoreBindings, type IRestDataProviderOptions } from '@venizia/ardor';

export class MyApplication extends BaseArdorApplication {
  bindContext() {
    const options: IRestDataProviderOptions = { ... };
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue(options);
    ...
  }

  getAppInfo() {
    return { ... };
  }
}
```

## The `services.*` namespace

`injectable()` binds a class under a key derived from a scope and the class name. `service()` fixes the scope to `services`.

```ts no-check
export abstract class AbstractArdorApplication {
  ...
  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>): void;
  service<T>(value: TClass<T>): void;
}
```

Both are positional - this is the IGNIS container surface, not an ARDOR options object. The resulting key is `${scope}.${value.name}`, so `this.service(UserService)` binds `services.UserService`. The binding is `toClass(value)` with scope `BindingScopes.SINGLETON`: one instance per application. Tags are applied when given.

```ts no-check
export class MyApplication extends BaseArdorApplication {
  bindContext() {
    this.service(UserService);                    // key: 'services.UserService'
    this.injectable('helpers', ClockHelper);      // key: 'helpers.ClockHelper'
    this.injectable('services', AuditService, ['audit']); // tagged
  }
  ...
}
```

Nothing in `CoreBindings` covers `services.*` keys. To pass one to `useInjectable({ key })` with type checking, augment the key union as shown below, or resolve by `target` instead.

## LocalStorageKeys

Three constants for auth state in `localStorage`. Their names say what each slot holds.

| Constant | Value |
|---|---|
| `KEY_AUTH_TOKEN` | `@app/auth/token` |
| `KEY_AUTH_IDENTITY` | `@app/auth/identity` |
| `KEY_AUTH_PERMISSION` | `@app/auth/permission` |

```ts
import { LocalStorageKeys } from '@venizia/ardor';

const raw = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
```

Use the constants rather than the raw strings so a rename in the framework does not leave stale entries behind in your code. How the auth service reads and writes these slots is covered in [Auth provider](../references/auth-provider).

## How useInjectable keys are typed

The key parameter of `useInjectable` is not `string`. It is a union built in `@venizia/ardor-react`:

```ts no-check
export interface IUseInjectableKeysOverrides {}

export type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;

export type TUseInjectableKeys = TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides;
```

- `TUseInjectableKeysDefault` is every string value on `CoreBindings` - the nine keys in the table above.
- `IUseInjectableKeysOverrides` is empty. Its property names, not its property types, are added to the union.
- `TUseInjectableKeys` is the union the hook accepts.

To add your own keys, augment the interface once in a `.d.ts` or any module file. The property type is irrelevant because only `keyof` is used.

```tsx
import { useInjectable } from '@venizia/ardor';

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides {
    'services.UserService': unknown;
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

The augmentation targets `@venizia/ardor-react`, where the interface is declared, even if you import from `@venizia/ardor`. See [Module augmentation](../best-practices/module-augmentation) for the file layout that keeps this in one place.

## Resolving by key or by target

`useInjectable` takes one options object. `key` and `target` are mutually exclusive; `container` is optional in both forms.

```ts no-check
export type TUseInjectableOptions =
  | { container?: Container; key: TUseInjectableKeys; target?: never }
  | { container?: Container; key?: never; target: TClass<AnyType> };

export const useInjectable: <T>(opts: TUseInjectableOptions) => T;
```

Resolution order:

1. Use `opts.container` if given, otherwise `ApplicationContext.container`. If neither exists, throw `[useInjectable] Failed to determine injectable container!`.
2. If `key` is set, return `container.get<T>({ key })`.
3. Otherwise look up the class in the container's metadata registry with `getBindingKey({ target })`. If nothing is found, throw with the message: `Decorate it (@service, @component, ...) or register it on the application before injecting`.
4. Return `container.get<T>({ key: resolved })`.

By key, with a `CoreBindings` constant:

```tsx
import { CoreBindings, useInjectable, type IDataProvider } from '@venizia/ardor';

export const useDataProvider = () => {
  return useInjectable<IDataProvider>({
    key: CoreBindings.DEFAULT_REST_DATA_PROVIDER,
  });
};
```

By target, with no key augmentation needed:

```tsx
import { useInjectable } from '@venizia/ardor';

class ReportService {
  build() {
    return 'report';
  }
}

export const useReportService = () => {
  return useInjectable<ReportService>({ target: ReportService });
};
```

Against an explicit container, bypassing `ApplicationContext`:

```tsx
import { CoreBindings, useInjectable, type IApplicationInfo } from '@venizia/ardor';

export const useAppInfoFrom = () => {
  return useInjectable<IApplicationInfo>({
    container,
    key: CoreBindings.APPLICATION_INFO,
  });
};
```

`useInjectable` does not check that `T` matches what is bound. The generic is an assertion, not a lookup.

## Common pitfalls

- **Binding a provider key before `preConfigure()` has run.** `bindContext()` is the right place. It is called from `preConfigure()` after `APPLICATION_INSTANCE` and `APPLICATION_INFO` exist. Binding in the constructor happens before either of them.
- **Returning a promise from `getAppInfo()` and expecting an object under `APPLICATION_INFO`.** The value is bound as-is with `toValue`, so consumers get the promise.
- **Passing `'services.UserService'` as `key` without augmentation.** It is not in `TUseInjectableKeysDefault`, so TypeScript rejects it. Either augment `IUseInjectableKeysOverrides` or use `target`.
- **Relying on `value.name` under minification.** `service()` builds the key from the class's runtime `name`. If your bundler renames classes, the key in production differs from the one you typed in an augmentation. Resolve by `target` or disable class name mangling.
- **Augmenting `@venizia/ardor` instead of `@venizia/ardor-react`.** The interface lives in `@venizia/ardor-react`. Augmenting the umbrella package does not extend the union.
- **`target` for a class that is only bound by hand elsewhere.** Step 3 above reads the metadata registry. If the lookup returns nothing, the hook throws. The error text lists the accepted ways to register.
- **Both `key` and `target` set.** The options type forbids it (`target?: never` / `key?: never`), and at runtime `key` wins.

## Related

- [Application](../references/application) - `start()`, `preConfigure()`, `bindContext()` and what `ArdorApplication` binds
- [Hooks](../references/hooks) - the full `useInjectable` and `useApplicationContext` reference
- [Data provider](../references/data-provider) - what sits behind `DEFAULT_REST_DATA_PROVIDER` and `REST_DATA_PROVIDER_OPTIONS`
- [Auth provider](../references/auth-provider) - `DEFAULT_AUTH_PROVIDER`, `DEFAULT_AUTH_SERVICE` and the `LocalStorageKeys` slots
- [i18n](../references/i18n) - `DEFAULT_I18N_PROVIDER` and `I18N_PROVIDER_OPTIONS`
- [Types](../references/types) - `ValueOf`, `ValueOrPromise` and the other helpers used in these signatures
- [Module augmentation](../best-practices/module-augmentation) - where to put `IUseInjectableKeysOverrides` augmentations
- [Migrating from ra-core-infra](../guides/migration/from-ra-core-infra) - old `container.bind({ key, value })` calls versus `bind({ key }).toValue()`
