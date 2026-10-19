---
title: Configuration
description: Configure ARDOR with @configuration and @provide, understand options and provider pairs, and follow the preConfigure() bind order.
---

# Configuration

The configuration class is the main way to configure ARDOR: a `@configuration()` class whose `@provide({ key })` methods return the options or the provider instances; `start()` binds each as a lazy SINGLETON.

```ts
import {
  type BaseArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class ExampleConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: BaseArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return { url: '/api', noAuthPaths: ['/auth/sign-in'] };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }
}
```

Each method decorated with `@provide({ key })` defines a binding:

- **Lazy resolution**: The method is called on the first `application.get({ key })`, never at startup.
- **Singleton scope**: The binding defaults to `BindingScopes.SINGLETON` unless an explicit `scope` is passed in `@provide({ key, scope })`. The return value is cached on first use.
- **Options methods**: Return plain JavaScript objects. For example, `restDataProviderOptions()` returns an `IRestDataProviderOptions` object, and `authProviderOptions()` returns an `IAuthProviderOptions` object. The post-login redirect path is configured at `paths.afterLogin` inside the auth provider options (`AUTH_PROVIDER_OPTIONS`), not as a top-level option.
- **Provider methods**: Call `this.application.instantiate(ProviderClass).value(this.application)` to create the helper instance with injected options and return the provider object for react-admin. For services such as `DefaultAuthService`, calling `this.application.instantiate(DefaultAuthService)` returns the service instance directly.

> [!NOTE]
> An application with no sign-in leaves `DEFAULT_AUTH_PROVIDER` unbound; `ArdorApplication` then runs without an auth provider.

To customize or replace a default provider, see [Providers](./providers).

## Options and provider bindings

The kernel defines eleven keys in `CoreBindings` (`packages/kernel/src/common/keys.ts`). An administrative application configures options and provider pairs using `@provide({ key })` methods:

| Key | Value / Contract | Configured via | Reference |
| --- | --- | --- | --- |
| `CoreBindings.REST_DATA_PROVIDER_OPTIONS` | Plain object (`IRestDataProviderOptions`) | `@provide` | [REST data provider](../../references/data-provider) |
| `CoreBindings.DEFAULT_REST_DATA_PROVIDER` | `IDataProvider` instance | `@provide` | [REST data provider](../../references/data-provider) |
| `CoreBindings.AUTH_PROVIDER_OPTIONS` | Plain object (`IAuthProviderOptions`) | `@provide` | [Auth provider](../../references/auth-provider) |
| `CoreBindings.DEFAULT_AUTH_SERVICE` | `DefaultAuthService` instance | `@provide` | [Auth provider](../../references/auth-provider) |
| `CoreBindings.DEFAULT_AUTH_PROVIDER` | `IAuthProvider` instance (unbound for public applications) | `@provide` | [Auth provider](../../references/auth-provider) |
| `CoreBindings.I18N_PROVIDER_OPTIONS` | Plain object (`II18nProviderOptions`) | `@provide` | [Internationalization](../../references/i18n) |
| `CoreBindings.DEFAULT_I18N_PROVIDER` | `I18nProvider` instance | `@provide` | [Internationalization](../../references/i18n) |
| `CoreBindings.APPLICATION_INSTANCE` | `AbstractArdorApplication` container instance | `preConfigure()` | [Application](../../references/application) |
| `CoreBindings.APPLICATION_INFO` | Plain object (`IApplicationInfo`) from `getAppInfo()` | `preConfigure()` | [Application](../../references/application) |
| `CoreBindings.FEATURES` | Mounted feature array (`Array<IFeatureBase>`) | `preConfigure()` | [Features](../../references/features) |
| `CoreBindings.PERMISSION_PROVIDER` | `IPermissionProvider` instance (optional) | `@provide` or `bindContext()` | [Permission provider](../../references/permission) |

`IDataProvider` extends react-admin's nine data methods with exactly three more: `send`, `getNetworkService`, `getDataSourceAuth`.

## The bind order

During `application.start()`, `preConfigure()` in `packages/kernel/src/base/applications/abstract.ts` executes in exact order:

1. `this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this)` - Binds the application container instance itself. Bound directly by `preConfigure()`.
2. `this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo())` - Binds the metadata object returned by `getAppInfo()`. Bound directly by `preConfigure()`.
3. `this.registerArtifacts()` - Discovers all stereotyped classes (`@configuration()`, `@service()`, `@repository()`, `@datasource()`, `@component()`). Asserts that no two classes derive colliding binding keys. Binds each class under its derived key as a singleton. Binds each method decorated with `@provide({ key })` as a lazy provider (singleton by default).
4. `this.registerFeatures({ features: this.features() })` - Validates that feature names are unique and that all configuration classes listed by features were discovered. Binds `this.bind({ key: CoreBindings.FEATURES }).toValue(features)`. Bound directly by `preConfigure()`.
5. `this.bindingList()` - Binds each class from the dictionary returned by `this.bindingList()` under its literal key as a singleton.
6. `this.bindContext()` - Calls the application subclass's `bindContext()` method and returns its result.

Because `preConfigure()` runs least explicit first and `bindContext()` runs last, any binding declared inside `bindContext()` overrides a binding declared in a `@configuration()` class.

## Other ways to bind

### `bindingList()`

Override `bindingList(): Record<string, TClass<unknown>>` on the application class to bind undecorated or third-party classes under literal keys as singletons:

```ts
import {
  BaseArdorApplication,
  type IApplicationInfo,
} from '@venizia/ardor';
import { type TClass } from '@venizia/ignis-inversion';

class CatalogService {
  list() {
    return ['item-1', 'item-2'];
  }
}

export class CustomBindingListApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  override bindingList(): Record<string, TClass<unknown>> {
    return {
      'services.CatalogService': CatalogService,
    };
  }

  bindContext() {}
}
```

### `bindContext()`

Implement `bindContext()` on the application class for imperative bindings or runtime overrides:

```ts
import {
  BaseArdorApplication,
  CoreBindings,
  type IApplicationInfo,
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

  bindContext() {
    this.service(InventoryService);
    // Overrides REST_DATA_PROVIDER_OPTIONS provided by a @configuration() class
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: 'https://staging.api.example.com',
      noAuthPaths: ['/auth/sign-in'],
    });
  }
}
```

`AbstractArdorApplication` provides helper methods for registration:
- `this.service(Target)` - binds under `services.Target`
- `this.repository(Target)` - binds under `repositories.Target`
- `this.dataSource(Target)` - binds under `datasources.Target`
- `this.component(Target)` - binds under `components.Target`
- `this.bind({ key }).toValue(...)` - binds an arbitrary value or instance directly

For domain classes, stereotype decorators (`@service()`, `@repository()`, `@datasource()`, `@component()`) register automatically during `registerArtifacts()`; see [Dependency injection](./dependency-injection).

## Multiple configuration classes and duplicate keys

An application can define multiple `@configuration()` classes to separate concerns:

```ts
import {
  configuration,
  CoreBindings,
  provide,
} from '@venizia/ardor';

@configuration()
export class ApiConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return { url: 'https://api.example.com', noAuthPaths: ['/auth/sign-in'] };
  }
}

@configuration()
export class AuthConfiguration {
  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions() {
    return { paths: { afterLogin: '/dashboard' } };
  }
}
```

- **Configuration class collisions**: Each configuration class is registered under a derived key in the `configurations` namespace (such as `configurations.ApiConfiguration`). `ArtifactBindingKeys.assertNoDerivedCollision()` checks that no two classes derive the exact same binding key. These only collide when two classes share a name, which a minifier can cause. If two classes derive the same key, `registerArtifacts()` throws an error at startup.
- **Provided key collisions**: If two configuration classes provide the same binding key, classes are registered in the order the registry discovered them, which is the order their modules were evaluated, and the last bind of a key wins. Binding a key again replaces the earlier binding. Do not rely on this order; no collision error is thrown for `@provide()` keys. Use `bindContext()` for deterministic overrides.
