---
title: Configuration
description: Configure ARDOR with @configuration and @provide, read per-environment values with RuntimeConfig, and follow the preConfigure() bind order.
---

# Configuration

The configuration class is the main way to configure ARDOR: a `@configuration()` class whose `@provide({ key })` methods return the options of the framework providers. `BaseArdorApplication` binds the providers themselves, so an application binds only options. `start()` binds each method as a lazy SINGLETON.

```ts
import {
  configuration,
  CoreBindings,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor';

@configuration()
export class ExampleConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: '/api', noAuth: { paths: ['/auth/sign-in'] } };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: true, paths: { afterLogin: '/dashboard' } };
  }
}
```

`@configuration()` registers the class, and the build finds it like any other stereotype. Each method decorated with `@provide({ key })` defines a binding:

- **Lazy resolution**: The method is called on the first `application.get({ key })`. The options of the REST data provider, sign-in and i18n are read earlier, in `start()`, by the check that every provider can be built (see [Failing at boot](../../references/application#failing-at-boot)); the other keys stay lazy.
- **Singleton scope**: The binding is a `BindingScopes.SINGLETON`, so the return value is cached on first use. `@provide({ key, scope })` takes another scope.
- **Options**: Return a plain JavaScript object. `restDataProviderOptions()` returns an `IRestDataProviderOptions` object, and `authProviderOptions()` returns a `TAuthProviderOptions` object: `{ use: true, paths? }` to sign in, `{ use: false }` for an app with no sign-in. The post-login redirect path is `paths.afterLogin` inside the auth provider options, not a top-level option.
- **Providers**: There is nothing to write. `BaseArdorApplication` binds `DefaultRestDataProvider`, `DefaultAuthProvider`, `DefaultI18nProvider` and `DefaultAuthService` before anything of the application, and each reads the options above. To replace one, add one line in `bindContext()` (see [Providers](./providers#replace-one)).

> [!NOTE]
> An application with no sign-in binds `{ use: false }` (or no auth options at all); `ArdorApplication` then runs without an auth provider.


## Options and provider bindings

The kernel defines twelve keys in `CoreBindings` (`packages/kernel/src/common/keys.ts`). An application binds the options keys; the framework binds the rest:

| Key | Value / Contract | Bound by | Reference |
| --- | --- | --- | --- |
| `CoreBindings.REST_DATA_PROVIDER_OPTIONS` | Plain object (`IRestDataProviderOptions`) | Your `@provide` | [REST data provider](../../references/data-provider) |
| `CoreBindings.DEFAULT_REST_DATA_PROVIDER` | `IDataProvider` instance | `BaseArdorApplication` | [REST data provider](../../references/data-provider) |
| `CoreBindings.AUTH_PROVIDER_OPTIONS` | `TAuthProviderOptions`; unbound means `{ use: false }` | Your `@provide` | [Auth provider](../../references/auth-provider) |
| `CoreBindings.DEFAULT_AUTH_SERVICE` | `DefaultAuthService` instance | `BaseArdorApplication` | [Auth provider](../../references/auth-provider) |
| `CoreBindings.DEFAULT_AUTH_PROVIDER` | `IAuthProvider` instance, resolved only when `use` is `true` | `BaseArdorApplication` | [Auth provider](../../references/auth-provider) |
| `CoreBindings.I18N_PROVIDER_OPTIONS` | Plain object (`II18nProviderOptions`); unbound means English only | Your `@provide` | [Internationalization](../../references/i18n) |
| `CoreBindings.DEFAULT_I18N_PROVIDER` | `I18nProvider` instance | `BaseArdorApplication` | [Internationalization](../../references/i18n) |
| `CoreBindings.APPLICATION_INSTANCE` | `AbstractArdorApplication` container instance | `preConfigure()` | [Application](../../references/application) |
| `CoreBindings.APPLICATION_INFO` | Plain object (`IApplicationInfo`) from `getAppInfo()` | `preConfigure()` | [Application](../../references/application) |
| `CoreBindings.FEATURES` | Mounted feature array (`Array<IFeatureBase>`) | `preConfigure()` | [Features](../../references/features) |
| `CoreBindings.PERMISSION_PROVIDER` | `IPermissionProvider` instance; unbound means every check passes | `bindContext()` | [Permission provider](../../references/permission) |
| `CoreBindings.PERMISSION_PROVIDER_OPTIONS` | `IRolePermissionProviderOptions` for `RolePermissionProvider` | Your `@provide` | [Permission provider](../../references/permission) |

`IDataProvider` extends react-admin's nine data methods with exactly three more: `send`, `getNetworkService`, `getDataSourceAuth`.

A route with `access` needs both sign-in (`CoreBindings.AUTH_PROVIDER_OPTIONS` with `use: true`) and a bound `CoreBindings.PERMISSION_PROVIDER`; without either, `ArdorApplication` throws at mount and names the route.

## Values that change per environment

Build one image and run it in every environment: a value such as the API address is read when the app starts, not baked into the build. `RuntimeConfig` (from `@venizia/ardor`) reads it:

- `RuntimeConfig.get({ key, buildTimeEnv, defaultValue, transform })` returns the value in `window.__APP_CONFIG__` (the `config.js` the container writes at start), else the build-time one you pass as `buildTimeEnv` (`import.meta.env`, which is what `vite dev` reads from `.env`), else `defaultValue`. A value that is empty or only spaces counts as unset, and a missing `window.__APP_CONFIG__` is not an error.
- `RuntimeConfig.getRequired({ key, buildTimeEnv, transform })` is for a value the app cannot run without. It has no default and throws an `ApplicationError` that names the key, never the value, with `normalized.code` equal to `RUNTIME_CONFIG_REQUIRED_CODE`.
- `transform` turns the string into a number or a boolean. `get` hands it `undefined` when the value is unset, and `defaultValue` applies when it answers `undefined` or `null`. A `transform` that throws, or that answers nothing to `getRequired`, raises an error with `normalized.code` equal to `RUNTIME_CONFIG_INVALID_CODE`.

```ts
import { RuntimeConfig } from '@venizia/ardor';

export class PageSizeConfig {
  static readonly KEY = 'VITE_PAGE_SIZE';
  static readonly DEFAULT = 25;
}

export const pageSize: number = RuntimeConfig.get({
  key: PageSizeConfig.KEY,
  transform: (raw) => (raw === undefined ? undefined : Number(raw)),
  defaultValue: PageSizeConfig.DEFAULT,
});

export const apiUrl: string = RuntimeConfig.getRequired({ key: 'VITE_API_URL' });
```

The preset reads `VITE_API_URL` this way in its configuration class, with `/api` as the default. A real app passes `buildTimeEnv: import.meta.env` so that `vite dev` reads `.env`:

<<< @/../../../presets/app/files/src/configurations/admin.configuration.ts{ts}

Only the container's `VITE_` variables reach `config.js`, and every visitor can read them: never put a secret there. [One image for every environment](../get-started/create-a-project#one-image-for-every-environment) covers how the image writes the file and how to require variables.

### Name the application, and say which version it is

`getAppInfo()` returns an `IApplicationInfo`. Its `id` is optional, and every application of one origin sets one: it scopes the session and store keys in `localStorage` (`@app/auth/<id>/...`, `@app/store/<id>/...`, `@app/prefs/<id>/...`), so two applications on one origin share no session and a sign-out sweeps only its own data. An `id` is letters, digits, `.`, `_` and `-`, and not dots only; `start()` rejects any other.

The `version` the preset writes into `getAppInfo()` is the placeholder `'0.0.0'`. The real version is not kept there: the `buildInfoFile` plugin of `@venizia/ardor/vite` writes it, with the commit and the branch, into `build-info.json` at build time, and an About page reads that file at run time (see [Vite setup](../get-started/vite-setup#write-build-info-json-for-an-about-page)).

## The bind order

During `application.start()`, `preConfigure()` in `packages/kernel/src/base/applications/abstract.ts` executes in exact order:

1. `this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this)` - Binds the application container instance itself. Bound directly by `preConfigure()`.
2. `CoreBindings.APPLICATION_INFO` - Calls `getAppInfo()`, waits for it when it returns a promise, checks the result, and binds it: `start()` rejects an empty `name`, a `version` that is not a string and an invalid `id`. Bound directly by `preConfigure()`.
3. `this.bindDefaults()` - Empty in the kernel. `BaseArdorApplication` binds the default providers and `DefaultAuthService` here, each a singleton.
4. `this.registerArtifacts()` - Discovers all stereotyped classes (`@configuration()`, `@service()`, `@repository()`, `@datasource()`, `@component()`). Leaves out a class whose `when` returns `false`. Asserts that no two of the rest derive colliding binding keys. Binds each class under its derived key in the scope its stereotype declares (`SINGLETON` when none). Binds each method decorated with `@provide({ key })` or `@provide({ key })` as a lazy provider (singleton by default).
5. `this.registerFeatures({ features: this.features() })` - Validates that feature names are unique and that all configuration classes listed by features were discovered. Binds `this.bind({ key: CoreBindings.FEATURES }).toValue(features)`. Bound directly by `preConfigure()`.
6. `this.bindingList()` - Binds each class from the dictionary returned by `this.bindingList()` under its literal key as a singleton.
7. `this.bindContext()` - Calls the application subclass's `bindContext()` method and returns its result.

Because `preConfigure()` runs least explicit first and `bindContext()` runs last, any binding declared inside `bindContext()` overrides a binding declared in a `@configuration()` class, and a binding of the same key in the defaults. The order is defaults, stereotype, then features, then `bindingList()`, then `bindContext()`. A lower step never replaces a class declared `allowOverride: false`: `bindingList()` throws for it, and only `bindContext()` replaces it.

A missing options binding rejects `start()`: `BaseArdorApplication.postConfigure()` resolves the data, auth and i18n providers (`ApplicationProviders.assertConfigured`) and throws an error that names the missing binding key and says what to bind; see [Application](../../references/application#failing-at-boot).

## Other ways to bind

### `bindingList()`

Override `bindingList(): Record<string, TClass<unknown>>` on the application class to bind undecorated or third-party classes under literal keys as singletons. Keep each key as a `static readonly` member of a constants class. The binding records the key on the class, so a component still resolves it by the class:

```tsx
import { Ardor, BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';
import { type TClass } from '@venizia/ignis-inversion';

class CatalogService {
  list() {
    return ['item-1', 'item-2'];
  }
}

export class CatalogKeys {
  static readonly SERVICE = 'services.CatalogService';
}

export class CustomBindingListApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  override bindingList(): Record<string, TClass<unknown>> {
    return { [CatalogKeys.SERVICE]: CatalogService };
  }

  bindContext(): void {}
}

export function Catalog() {
  const catalog = Ardor.useService({ target: CatalogService });

  return <ul>{catalog.list().map((item) => <li key={item}>{item}</li>)}</ul>;
}
```

Prefer a stereotype (`@service()`), or `this.service(CatalogService)` in `bindContext()`, when you own the class.

### `bindContext()`

Implement `bindContext()` on the application class for imperative bindings or runtime overrides:

```ts
import {
  BaseArdorApplication,
  CoreBindings,
  type IApplicationInfo,
  RuntimeConfig,
} from '@venizia/ardor';

class InventoryService {
  count() {
    return 42;
  }
}

export class CustomManualApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    // InventoryService carries no stereotype, so the application registers it.
    this.service(InventoryService);

    // Replaces the REST options of a @configuration() class; the address comes from config.js.
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: RuntimeConfig.getRequired({ key: 'VITE_API_URL' }),
      noAuth: { paths: ['/auth/sign-in'] },
    });
  }
}
```

`AbstractArdorApplication` provides helper methods for registration:
- `this.service(Target)` - binds under the `services` namespace
- `this.repository(Target)` - binds under the `repositories` namespace
- `this.dataSource(Target)` - binds under the `datasources` namespace
- `this.component(Target)` - binds under the `components` namespace
- `this.bind({ key }).toValue(...)` - binds an arbitrary value or instance directly

Each helper takes the key from its `binding` option, else from the class's stereotype, else `<namespace>.<Target.name>`, and the scope from its `scope` option, else the class's, else a singleton. For domain classes, stereotype decorators (`@service()`, `@repository()`, `@datasource()`, `@component()`) register automatically during `registerArtifacts()`; see [Dependency injection](./dependency-injection).

## Multiple configuration classes and duplicate keys

An application can define multiple `@configuration()` classes to separate concerns:

```ts
import {
  configuration,
  CoreBindings,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor';

@configuration()
export class ApiConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: 'https://api.example.com', noAuth: { paths: ['/auth/sign-in'] } };
  }
}

@configuration()
export class AuthConfiguration {
  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: true, paths: { afterLogin: '/dashboard' } };
  }
}
```

- **Configuration class collisions**: Each configuration class is registered under a derived key in the `configurations` namespace (such as `configurations.ApiConfiguration`). `ArtifactBindingKeys.assertNoDerivedCollision()` checks that no two classes derive the exact same binding key. These only collide when two classes share a name, which a minifier can cause. If two classes derive the same key, `registerArtifacts()` throws an error at startup.
- **Provided key collisions**: If two configuration classes provide the same binding key, classes are registered in the order the registry discovered them, which is the order their modules were evaluated, and the last bind of a key wins. Binding a key again replaces the earlier binding. Do not rely on this order; no collision error is thrown for `@provide()` and `@provide()` keys. Use `bindContext()` for deterministic overrides.
