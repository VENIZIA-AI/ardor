---
title: Application
description: Technical reference for BaseArdorApplication, lifecycle methods, artifact registration, the ArdorApplication component, and startup errors.
---

# Application

`BaseArdorApplication` is the inversion-of-control container subclass for ARDOR applications. It extends the IGNIS `Container` to provide lifecycle hooks, artifact auto-registration, and dependency injection helpers. `ArdorApplication` is the root React component that accepts the started container, resolves the default data, authentication, and internationalization providers, and renders react-admin's `CoreAdmin`.

This page provides the technical API reference for `BaseArdorApplication`, its member methods, the `ArdorApplication` component props, and all startup errors thrown by `packages/kernel/src/base/applications/abstract.ts`. For architectural context, see the [Application Guide](../guides/core-concepts/application) and [Configuration Guide](../guides/core-concepts/configuration).

## First Example

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  BaseArdorApplication,
  configuration,
  CoreBindings,
  type IApplicationInfo,
  inject,
  provide,
} from '@venizia/ardor';

class CatalogService {
  list(): Array<string> {
    return ['book', 'pen'];
  }
}

// The configuration class is the main way to configure ARDOR.
// start() binds each @provide method under its key as a lazy SINGLETON.
@configuration()
export class ShopConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return { url: 'https://api.example.com' };
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.service(CatalogService);
  }
}

export async function boot(): Promise<ShopApplication> {
  const application = new ShopApplication();
  await application.start();
  return application;
}
```

## Quick Reference

| Export | Kind | Source Package | Role |
|---|---|---|---|
| `BaseArdorApplication` | class | `@venizia/ardor` | Concrete application container class to extend |
| `AbstractArdorApplication` | class | `@venizia/ardor` | Base container class implementing `IArdorApplication` |
| `ArdorApplication` | component | `@venizia/ardor` | Root component connecting container to react-admin `CoreAdmin` |
| `IArdorApplication` | interface | `@venizia/ardor` | Container interface contract in `packages/kernel/src/common/types.ts` |
| `IApplicationInfo` | interface | `@venizia/ardor` | Application metadata shape returned by `getAppInfo()` |
| `IArtifactIndex` | interface | `@venizia/ardor` | Stereotyped class index shape returned by `artifacts()` |
| `IArtifactRegistration` | interface | `@venizia/ardor` | Registration options for `service()`, `repository()`, `dataSource()`, `component()` |
| `IApplication` | interface | `@venizia/ardor` | Props accepted by `ArdorApplication` in `packages/admin/src/common/types.ts` |
| `CoreBindings` | class | `@venizia/ardor` | Container binding keys in `packages/kernel/src/common/keys.ts` |

> [!NOTE]
> `CoreBindings` (in `packages/kernel/src/common/keys.ts`) defines eleven keys: `APPLICATION_INSTANCE`, `APPLICATION_INFO`, `DEFAULT_AUTH_PROVIDER`, `DEFAULT_I18N_PROVIDER`, `DEFAULT_REST_DATA_PROVIDER`, `AUTH_PROVIDER_OPTIONS`, `DEFAULT_AUTH_SERVICE`, `REST_DATA_PROVIDER_OPTIONS`, `I18N_PROVIDER_OPTIONS`, `FEATURES`, and `PERMISSION_PROVIDER`. See [Binding keys](./binding-keys) for details on each key.

## BaseArdorApplication

`BaseArdorApplication` (in `packages/kernel/src/base/applications/abstract.ts`) extends `AbstractArdorApplication`, which extends the IGNIS `Container`. The application instance is the container itself: there is no nested `container` property. You call `this.bind(...)` and `this.get(...)` directly on the application instance.

```ts no-check
// Declaration excerpt from packages/kernel/src/base/applications/abstract.ts
// ...
abstract class AbstractArdorApplication extends Container implements IArdorApplication {
  abstract bindContext(): ValueOrPromise<void>;
  abstract getAppInfo(): ValueOrPromise<IApplicationInfo>;

  preConfigure(): ValueOrPromise<void>;
  postConfigure(): ValueOrPromise<void>;

  registerArtifacts(): void;
  artifacts(): Array<IArtifactIndex>;
  features(): Array<IFeatureBase>;
  bindingList(): Record<string, TClass<unknown>>;

  service<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>;
  repository<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>;
  dataSource<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>;
  component<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>;
  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>): void;

  start(): Promise<void>;
}

abstract class BaseArdorApplication extends AbstractArdorApplication {}
```

### start()

Signature: `start(): Promise<void>`

`start()` coordinates application startup in three sequential steps:

1. **Resolves dynamic artifact indexes**: `this.resolvedIndexes = await this.resolveArtifactIndexes();`. If an artifact group provides a `resolve()` function, `start()` awaits it to evaluate modules and decorate classes before registration begins.
2. **Executes pre-configuration**: `await this.preConfigure();`.
3. **Executes post-configuration**: `await this.postConfigure();`.

### preConfigure()

Signature: `preConfigure(): ValueOrPromise<void>`

`preConfigure()` establishes container bindings in a strict order, from least explicit to most explicit:

`Stereotypes and @provide methods < Features < bindingList() < bindContext()`

The exact execution order in `packages/kernel/src/base/applications/abstract.ts` is:

1. Binds `CoreBindings.APPLICATION_INSTANCE`: `this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this);`.
2. Binds `CoreBindings.APPLICATION_INFO`: `this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo());`. The return value of `getAppInfo()` is bound directly without awaiting.
3. Invokes `this.registerArtifacts()`: verifies that all classes listed in resolved artifact indexes were discovered, verifies that no derived binding keys collide under minification, and registers stereotyped classes and `@provide` methods on `@configuration()` classes.
4. Invokes `this.registerFeatures({ features: this.features() })`: validates that feature names are unique and that all listed configuration classes were discovered, then binds `CoreBindings.FEATURES` to the feature array (`this.bind({ key: CoreBindings.FEATURES }).toValue(features);`).
5. Iterates entries of `this.bindingList()`: sets each target's binding key in the metadata registry and binds it under its literal key as `BindingScopes.SINGLETON`.
6. Returns `this.bindContext()`: executes custom manual bindings. If `bindContext()` returns a promise, `start()` awaits its completion before proceeding to `postConfigure()`.

> [!IMPORTANT]
> `preConfigure()` itself directly binds exactly three keys: `APPLICATION_INSTANCE`, `APPLICATION_INFO`, and `FEATURES`. All other keys are bound through `@provide` methods, `bindingList()`, `bindContext()`, or stereotype decorators. When overriding `preConfigure()`, you must call `await super.preConfigure()`, or core bindings are skipped and `bindContext()` is not invoked.

### postConfigure()

Signature: `postConfigure(): ValueOrPromise<void>`

A lifecycle hook called after `preConfigure()` and all asynchronous work in `bindContext()` complete. In `BaseArdorApplication`, this method is an empty no-op. Override it to execute initialization that requires container bindings to be in place, such as resolving a service and warming a cache:

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

class SettingsService {
  async load(): Promise<{ theme: string }> {
    return { theme: 'dark' };
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.service(SettingsService);
  }

  override async postConfigure(): Promise<void> {
    const settings = this.get<SettingsService>({ key: 'services.SettingsService' });
    await settings.load();
  }
}
```

### registerArtifacts()

Signature: `registerArtifacts(): void`

Discovers and binds stereotyped classes and their `@provide` methods:

1. Retrieves discovered classes from `MetadataRegistry.getInstance().getDiscoveredArtifacts()`.
2. Asserts indexed classes via `this.assertIndexed()`: verifies that every class listed in `this.resolvedIndexes ?? this.artifacts()` was discovered, and that no entry is undefined.
3. Checks derived keys via `ArtifactBindingKeys.assertNoDerivedCollision()`: ensures that two classes with identical derived names do not overwrite each other.
4. Binds each discovered class under its resolved key using its declared scope (defaulting to `BindingScopes.SINGLETON`).
5. Binds every `@provide` method on discovered `@configuration()` classes to a lazy singleton provider (`toProvider`), resolving the configuration instance and invoking the method on first `get()`, scoped as `entry.scope ?? BindingScopes.SINGLETON`. The return value is cached across the container.

### artifacts()

Signature: `artifacts(): Array<IArtifactIndex>`

Returns the artifact index definitions checked by `start()`. Default returns `[]`.

`IArtifactIndex` (defined in `packages/kernel/src/common/types.ts`) holds indexed classes grouped by kind:

| Kind | Type | Description |
|---|---|---|
| `configurations` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@configuration()` classes to verify upon startup |
| `dataSources` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@datasource()` classes to verify upon startup |
| `components` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@component()` classes to verify upon startup |
| `repositories` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@repository()` classes to verify upon startup |
| `services` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@service()` classes to verify upon startup |
| `controllers` | `ReadonlyArray<TClass<unknown>>` | Optional list of controller classes (remains empty in browser applications) |

Artifact indexes ensure that bundlers do not drop classes that are only imported for decorator side-effects. The `ignis-artifacts generate` command emits the index, while the [5-minute quickstart](../guides/get-started/5-minute-quickstart) uses `AutoArtifacts` from `@venizia/ignis-boot/auto` instead.

```ts
import {
  BaseArdorApplication,
  type IApplicationInfo,
  type IArtifactIndex,
  service,
} from '@venizia/ardor';

@service()
class OrderService {}

const GeneratedArtifacts: IArtifactIndex = {
  configurations: [],
  dataSources: [],
  components: [],
  repositories: [],
  services: [OrderService],
  controllers: [],
};

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [GeneratedArtifacts];
  }

  bindContext(): void {}
}
```

When returning an artifact group (`isArtifactGroup === true`), `start()` processes it:
- If `content` is present (pre-inlined by a bundler plugin), it checks `content` as a flat index.
- If `content` is undefined and `group.resolve` is a function, `start()` awaits `group.resolve()` to import modules and decorate classes dynamically.
- If neither `content` nor `resolve` is present, `start()` throws an error.

### features()

Signature: `features(): Array<IFeatureBase>`

Returns the list of feature packages mounted by the application. Default returns `[]`. Bound by `preConfigure()` under `CoreBindings.FEATURES`.

`IFeatureBase` (defined in `packages/kernel/src/common/types.ts`) describes the container-level feature contract:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique identifier for the feature package within an application |
| `configurations` | `Array<TClass<unknown>>` | Optional list of feature `@configuration()` classes to verify and discover |
| `permissions` | `Array<string>` | Optional list of permission strings checked by the feature for role editors |

Validation rules enforced by `registerFeatures`:
- Feature names must be unique within an application. If duplicate names are detected, startup throws `[features] Two features are named '<name>'`.
- Every configuration class listed in `configurations` must be discovered. If undiscovered, startup throws `[features] '<feature.name>' lists <target.name>, which was never discovered`.

For details on feature mounting, routes, resources, and translations, see [Features](./features).

### bindingList()

Signature: `bindingList(): Record<string, TClass<unknown>>`

Returns a mapping of literal binding keys to class constructors. Default returns `{}`.

`preConfigure()` iterates over this dictionary before calling `bindContext()`. Each class is registered under its literal key as a `BindingScopes.SINGLETON` and recorded in the metadata registry:

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

class MetricCollector {}

export class MonitoringApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'monitoring', version: '1.0.0', description: 'Monitoring admin' };
  }

  override bindingList() {
    return {
      'metrics.collector': MetricCollector,
    };
  }

  bindContext(): void {}
}
```

### bindContext()

Signature: `abstract bindContext(): ValueOrPromise<void>`

Abstract method. Subclasses implement this method to register manual bindings or overrides directly on the container.

In typical applications, options and providers are declared using `@configuration()` classes, leaving `bindContext()` empty. Because `bindContext()` runs last in `preConfigure()`, any binding created here takes precedence over stereotype decorators, configuration `@provide` methods, features, and `bindingList()`.

> [!NOTE]
> `bindContext()` is abstract and has no base implementation. Do not call `super.bindContext()`.

### getAppInfo()

Signature: `abstract getAppInfo(): ValueOrPromise<IApplicationInfo>`

Abstract method returning application metadata.

`IApplicationInfo` (defined in `packages/kernel/src/common/types.ts`) specifies application metadata:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Name of the application |
| `version` | `string` | Application version string |
| `description` | `string` | Human-readable application description |
| `author` | `{ name: string; email: string; url?: string }` | Optional author contact information |
| `[extra]` | `any` | Additional application metadata indexed by string or symbol |

`preConfigure()` binds the return value directly under `CoreBindings.APPLICATION_INFO`: `this.bind({ key: CoreBindings.APPLICATION_INFO }).toValue(this.getAppInfo());`.

> [!IMPORTANT]
> `preConfigure()` binds the return value of `getAppInfo()` directly without awaiting it. Implementations must return a plain synchronous object so that downstream consumers resolving `APPLICATION_INFO` receive the metadata object directly rather than a pending Promise.

### service(), repository(), dataSource(), component()

Signatures:
- `service<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>`
- `repository<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>`
- `dataSource<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>`
- `component<T>(target: TClass<T>, opts?: IArtifactRegistration): Binding<T>`

`IArtifactRegistration` (defined in `packages/kernel/src/base/applications/abstract.ts`) configures individual registration behavior:

| Option | Type | Default | Description |
|---|---|---|---|
| `binding` | `{ namespace: string; key: string }` | Derived from stereotype | Custom namespace and key to bind under instead of `<namespace>.<ClassName>` |
| `scope` | `TBindingScope` | `BindingScopes.SINGLETON` | Inversion-of-control lifecycle scope for the class |
| `allowOverride` | `boolean` | `true` | When `false`, refuses to replace a binding if the key is already bound |

These helper methods register individual classes by stereotype and return the resulting `Binding<T>`.

Registration behavior:
- **Key Resolution**: `opts.binding` > class decorator declared `binding` > `<namespace>.<ClassName>`. Namespaces are `'services'`, `'repositories'`, `'datasources'`, and `'components'`.
- **Scope Resolution**: `opts.scope` > class decorator declared `scope` > `BindingScopes.SINGLETON`. In ARDOR, all stereotypes default to `SINGLETON` because React components and hooks resolve on every render.
- **Override Check**: `opts.allowOverride ?? declared?.allowOverride ?? true`. If `allowOverride` is `false` and the key is already bound, registration throws `[${caller}] '${key}' is already bound and allowOverride is false`.
- **Target Tracking**: The derived or explicit key is associated with the class constructor in the metadata registry, enabling resolution by class reference via `container.get({ target })` and hooks.

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

class ApiClient {}
class ProductRepository {}
class EmailService {}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.dataSource(ApiClient);
    this.repository(ProductRepository);
    this.service(EmailService, {
      binding: { namespace: 'services', key: 'mail' },
      allowOverride: false,
    });
  }
}
```

### injectable()

Signature: `injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>): void`

Binds class `value` under `${scope}.${value.name}` as a `BindingScopes.SINGLETON` with optional metadata tags, and registers the key on the target class in the metadata registry. Prefer the stereotype-specific methods (`service()`, `repository()`, `dataSource()`, `component()`) for standard artifacts.

## ArdorApplication

`ArdorApplication` (in `packages/admin/src/components/application.tsx`) is the root React component. It connects the started application container to react-admin's `CoreAdmin`. Component properties are typed by `IApplication` in `packages/admin/src/common/types.ts`.

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `container` | `Container` | Yes | The started IoC container instance (`BaseArdorApplication`). |
| `reduxStore` | `Store` | Yes | Redux store instance used for react-admin state management. |
| `suspense` | `ReactNode` | Yes | Fallback element displayed while suspense resolves and while feature translation messages load. |
| `enableDebug` | `boolean` | No | Enables debug-level logging in the application logger. Default is `false`. |
| `resources` | `Array<ResourceProps>` | No | Resource definitions registered before feature resources. |
| `routes` | `Array<RouteProps>` | No | Custom route definitions registered inside `CustomRoutes` before feature routes. |
| `...reactAdminProps` | `Omit<CoreAdminProps, 'children'>` | No | Additional react-admin properties passed directly to `CoreAdmin` (such as `loginPage`, `layout`, `dashboard`, `title`, `theme`, `catchAll`, `basename`). |

### Render Lifecycle

When rendered, `ArdorApplication` executes the following sequence:

1. **Resolves Default Providers**:
   - `CoreBindings.DEFAULT_REST_DATA_PROVIDER`: Required. Resolves the `IDataProvider` implementation.
   - `CoreBindings.DEFAULT_AUTH_PROVIDER`: Optional (`isOptional: true`). If unbound, react-admin runs without authentication so that every page is public. See [Auth provider](./auth-provider).
   - `CoreBindings.DEFAULT_I18N_PROVIDER`: Required. Resolves the `I18nProvider` implementation. See [i18n](./i18n).
2. **Mounts Resources and Routes**: Reads features from `CoreBindings.FEATURES` via `Features.read({ container })` and mounts the application's own `resources` and `routes`, followed by each feature's resources and routes in order via `Features.mount({ features, resources, routes })`. If duplicate resource names are detected across the application and mounted features, an error is thrown.
3. **Verifies Translation Readiness**: Calls `useFeatureMessagesReady`. If any feature supplies lazy translation loaders for the active locale, `changeLocale()` is triggered, and `suspense` is rendered until messages are loaded.
4. **Assembles Component Context**:
   - Wraps the tree in `ApplicationContext.Provider` providing `{ container, logger }` (`Logger.getInstance({ scope: 'ArdorApplication', enableDebug })`).
   - Wraps with `ReduxProvider` using `reduxStore`.
   - Wraps with `React.Suspense` using `suspense`.
5. **Renders CoreAdmin**:
   - Forwards `dataProvider`, `authProvider` (if bound), `i18nProvider`, and all remaining react-admin props to `CoreAdmin`.
   - Mounts each resource as `<Resource key={resource.name} {...resource} />`.
   - Mounts each custom route inside `<CustomRoutes>` as `<Route key={route.id ?? route.path} {...route} />`.

```tsx
import React from 'react';
import { type Store } from '@reduxjs/toolkit';
import { ArdorApplication, type BaseArdorApplication } from '@venizia/ardor';

export function renderAdmin(application: BaseArdorApplication, reduxStore: Store) {
  return (
    <ArdorApplication
      container={application}
      reduxStore={reduxStore}
      suspense={<div>Loading...</div>}
      enableDebug={false}
      resources={[{ name: 'products' }]}
    />
  );
}
```

## Errors

`packages/kernel/src/base/applications/abstract.ts` and `Features.mount()` throw errors during startup and render when configuration constraints or artifact expectations are violated:

| Error Message | Method / Caller | Cause | Fix |
|---|---|---|---|
| `[registerArtifacts] Two classes derive the binding key '<key>'` | `registerArtifacts()` via `ArtifactBindingKeys.assertNoDerivedCollision` | Two discovered classes share the same name or were renamed to the same name by a minifier, causing colliding derived binding keys (`${namespace}.${name}`). | Set an explicit binding key via `@service({ binding: { namespace, key } })` or the `binding` registration option, or configure the bundler to preserve class names. |
| `[artifacts] A group has neither content nor resolve` | `resolveArtifactIndexes()` in `start()` | An artifact group returned by `artifacts()` has `isArtifactGroup: true`, but has neither pre-inlined `content` nor a `resolve()` function. | Return `AutoArtifacts` from `@venizia/ignis-boot/auto`, or build with `IgnisArtifactsPlugin` so the group includes inlined content. |
| `[artifacts] '<kind>' lists an entry that is not a class (position <pos>)` | `assertIndexed()` in `registerArtifacts()` | An artifact index entry is `undefined` or not a function. This is typically caused by circular imports evaluating a module before its class is defined. | Break the circular import cycle. Ensure the module importing the artifact index does not define decorated classes or get imported by them. |
| `[artifacts] '<kind>' lists <Name>, which was never discovered` | `assertIndexed()` in `registerArtifacts()` | A class listed in an artifact index was not found in `MetadataRegistry.getDiscoveredArtifacts()`. The class is missing its stereotype decorator, was never imported, or the index is stale. | Decorate the class with its stereotype (`@service()`, `@repository()`, `@datasource()`, `@component()`, `@configuration()`), import its module, and regenerate the index. |
| `[features] Two features are named '<name>'` | `registerFeatures()` in `preConfigure()` | Two feature definitions returned by `this.features()` have the same `name` property. | Ensure every mounted feature has a unique `name`. |
| `[features] '<feature>' lists <Name>, which was never discovered` | `registerFeatures()` in `preConfigure()` | A configuration class listed in a feature's `configurations` array was not discovered in the metadata registry. | Decorate the class with `@configuration()` and import its module before calling `start()`. |
| `[features] Resource '<name>' is mounted by both '<owner1>' and '<owner2>'` | `Features.mount()` in `ArdorApplication` | Two mounted features, or the application and a mounted feature, register a resource with the same `name`. | Ensure resource names are unique across the application and all mounted features. |
| `[<caller>] '<key>' is already bound and allowOverride is false` | `service()`, `repository()`, `dataSource()`, `component()` | A registration method was called with `allowOverride: false` (or its decorator set `allowOverride: false`), but the key is already bound in the container. | Pass a distinct binding key via `opts.binding`, or omit `allowOverride: false` if replacing the existing binding is intentional. |

## Related

- [Application Guide](../guides/core-concepts/application) - Architectural overview of the ARDOR container and component tree
- [Configuration Guide](../guides/core-concepts/configuration) - Using `@configuration()` classes and `@provide` methods
- [Binding keys](./binding-keys) - CoreBindings reference and key conventions
- [Features](./features) - Feature packages, routing, resources, and translation modules
- [Data provider](./data-provider) - REST data provider contract and options
- [Auth provider](./auth-provider) - Authentication provider lifecycle and hooks
- [i18n](./i18n) - Internationalization setup and locale switching
- [Hooks](./hooks) - Container and dependency injection React hooks
- [Migration from ra-core-infra](../guides/migrations/from-ra-core-infra) - Migrating legacy applications to ARDOR container patterns
