---
title: Configuration
description: Configure ARDOR with @configuration and @provide, understand options and provider pairs, and follow the preConfigure() bind order.
---

# Configuration

You configure ARDOR in `@configuration()` classes, and `preConfigure()` binds them in a fixed order. A configuration class declares provider options and provider instances using `@provide({ key })` methods. During startup, `preConfigure()` discovers these classes and registers each provided key into the inversion-of-control container as a lazy singleton.

The complete configuration from `examples/5-mins-qs/src/configurations/admin.configuration.ts` demonstrates all standard framework bindings:

<<< @/../../../examples/5-mins-qs/src/configurations/admin.configuration.ts{ts}

## How `@provide({ key })` methods work

The `@configuration()` decorator marks a class as a configuration artifact. In its constructor, the class injects the application container:

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
- **Singleton scope**: The binding defaults to `BindingScopes.SINGLETON` unless an explicit `scope` is passed in `@provide({ key, scope })`. The return value is cached on first use and shared across all subsequent resolutions.
- **Options methods**: Methods that configure provider behavior return plain JavaScript objects. For example, `restDataProviderOptions()` returns an `IRestDataProviderOptions` object, and `authProviderOptions()` returns an `IAuthProviderOptions` object. The post-login redirect path is configured at `paths.afterLogin` inside the auth options object, not as a top-level option.
- **Provider methods**: Methods that produce provider instances call `this.application.instantiate(ProviderClass).value(this.application)`. Provider classes such as `DefaultRestDataProvider`, `DefaultAuthProvider`, and `DefaultI18nProvider` implement `IProvider<T>` with a `value(container)` method. The call to `this.application.instantiate(ProviderClass)` creates the helper instance with its injected options and application metadata, and `.value(this.application)` extracts the provider object consumed by react-admin. For services such as `DefaultAuthService`, calling `this.application.instantiate(DefaultAuthService)` returns the service instance directly.

Because each provided binding is a singleton by default, react-admin, the authentication provider, and custom hooks share a single REST data provider instance. They share the same network service, its headers, and a single shared refresh per 401 burst.

> [!NOTE]
> An application with no sign-in leaves `CoreBindings.DEFAULT_AUTH_PROVIDER` unbound. `ArdorApplication` then runs without an authentication provider, leaving every resource page public.

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

`IDataProvider` extends react-admin's nine standard data methods (`getList`, `getOne`, `getMany`, `getManyReference`, `update`, `updateMany`, `create`, `delete`, `deleteMany`) with exactly three additional framework methods: `send`, `getNetworkService`, and `getDataSourceAuth`.

## The bind order

During `application.start()`, `preConfigure()` in `packages/kernel/src/base/applications/abstract.ts` executes in exact order:

1. `this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this)` - Binds the application container instance itself. Bound directly by `preConfigure()`.
2. `this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo())` - Binds the metadata object returned by `getAppInfo()`. Bound directly by `preConfigure()`.
3. `this.registerArtifacts()` - Discovers all stereotyped classes (`@configuration()`, `@service()`, `@repository()`, `@datasource()`, `@component()`). Asserts that no two classes derive colliding binding keys. Binds each class under its derived key as a singleton. Binds each method decorated with `@provide({ key })` as a lazy provider (singleton by default).
4. `this.registerFeatures({ features: this.features() })` - Validates that feature names are unique and that all configuration classes listed by features were discovered. Binds `this.bind({ key: CoreBindings.FEATURES }).toValue(features)`. Bound directly by `preConfigure()`.
5. `this.bindingList()` - Binds each class from the dictionary returned by `this.bindingList()` under its literal key as a singleton.
6. `this.bindContext()` - Calls the application subclass's `bindContext()` method and returns its result.

### Least explicit first, so the most explicit wins

Binding a key again replaces the earlier binding in the container. The bind order runs least explicit first:
- Discovered stereotypes and `@provide()` methods run first.
- Feature configurations run next.
- Explicit literal keys from `bindingList()` run next.
- Explicit imperative code in `bindContext()` runs last.

Because `bindContext()` runs last, any binding declared inside `bindContext()` overrides a binding declared in a `@configuration()` class.

In the following example, `ShopApplication.bindContext()` overrides the `REST_DATA_PROVIDER_OPTIONS` provided by the configuration class:

```ts
import {
  BaseArdorApplication,
  CoreBindings,
  type IApplicationInfo,
} from '@venizia/ardor';

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext() {
    // Overrides REST_DATA_PROVIDER_OPTIONS provided by a @configuration() class
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
      url: 'https://staging.api.example.com',
      noAuthPaths: ['/auth/sign-in'],
    });
  }
}
```

## Other ways to bind

ARDOR provides three additional ways to bind dependencies into the container:

### 1. `bindingList()`

Override `bindingList(): Record<string, TClass<unknown>>` on the application class to map classes directly to literal keys as singletons:

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

Use `bindingList()` when binding undecorated classes or third-party classes under literal keys without modifying the classes themselves.

### 2. `bindContext()`

Implement `bindContext()` on the application class for imperative bindings by hand:

```ts
import {
  BaseArdorApplication,
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
    this.bind({ key: 'custom.api-url' }).toValue('https://api.example.com');
  }
}
```

`AbstractArdorApplication` provides helper methods for registration:
- `this.service(Target)` - binds under `services.Target`
- `this.repository(Target)` - binds under `repositories.Target`
- `this.dataSource(Target)` - binds under `datasources.Target`
- `this.component(Target)` - binds under `components.Target`
- `this.bind({ key }).toValue(...)` - binds an arbitrary value or instance directly

Use `bindContext()` for dynamic values, runtime environment overrides, or imperative registrations that must override provided keys.

### 3. Stereotype decorators

Classes decorated with `@service()`, `@repository()`, `@datasource()`, or `@component()` are discovered automatically at build time and registered during `registerArtifacts()`.

Use stereotype decorators for application domain services, data sources, and repositories. See [Dependency injection](./dependency-injection) for details on stereotyping and constructor injection.

## Swapping a default provider

To customize a default provider, subclass it and return the subclass from the corresponding `@provide` method.

`DefaultRestDataProvider` builds its network service through `createNetworkService()`. To customize network transport, subclass `DefaultNetworkRequestService` and override `createNetworkService()` in a custom REST data provider subclass:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultNetworkRequestService,
  DefaultRestDataProvider,
  inject,
  LocalStorageKeys,
  provide,
  RequestMethods,
  RequestTypes,
} from '@venizia/ardor';

class CustomNetworkService extends DefaultNetworkRequestService {
  protected override async refreshToken(): Promise<boolean> {
    const { data } = await this.doRequest<{ token: string }>({
      type: RequestTypes.SEND,
      method: RequestMethods.POST,
      paths: ['/auth/refresh-token'],
      headers: this.getRequestHeader({ resource: '/auth/refresh-token' }),
    });

    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: data.token, type: 'Bearer' }),
    );
    return true;
  }
}

export class CustomRestDataProvider extends DefaultRestDataProvider {
  protected override createNetworkService() {
    return new CustomNetworkService({
      name: 'custom-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      noAuthPathRegex: this.restDataProviderOptions.noAuthPathRegex,
      headers: this.restDataProviderOptions.headers,
      authRecovery: this.restDataProviderOptions.authRecovery,
    });
  }
}

@configuration()
export class CustomAdminConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return { url: '/api', noAuthPaths: ['/auth/sign-in'] };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(CustomRestDataProvider).value(this.application);
  }
}
```

`this.application.instantiate(CustomRestDataProvider)` resolves `REST_DATA_PROVIDER_OPTIONS` and `APPLICATION_INFO` into the provider constructor. Calling `.value(this.application)` produces the customized `IDataProvider` instance.

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

Every class decorated with `@configuration()` is discovered and registered during `registerArtifacts()`.

What happens when duplicate keys are encountered:

- **Configuration class collisions**: Each configuration class is registered under a derived key in the `configurations` namespace (such as `configurations.ApiConfiguration`). `ArtifactBindingKeys.assertNoDerivedCollision()` checks that no two classes derive the exact same binding key. These only collide when two classes share a name, which a minifier can cause. If two classes derive the same key, `registerArtifacts()` throws an error at startup.
- **Provided key collisions**: If two configuration classes provide the same binding key, classes are registered in the order the registry discovered them, which is the order their modules were evaluated, and the last bind of a key wins. Binding a key again replaces the earlier binding. Do not rely on this order; no collision error is thrown for `@provide()` keys.

To keep configuration deterministic across multiple classes, assign distinct keys to separate configuration classes or use `bindContext()` when overriding a provided binding.
