---
title: Application
description: Technical reference for BaseArdorApplication, lifecycle methods, artifact registration, the ArdorApplication component, and startup errors.
---

# Application

`BaseArdorApplication` is the inversion-of-control container subclass for ARDOR applications, and `ArdorApplication` is the root React component rendering react-admin's `CoreAdmin`. For architectural context, see the [Application Guide](../guides/core-concepts/application) and [Configuration Guide](../guides/core-concepts/configuration).

```ts
import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  type IApplicationInfo,
  type IRestDataProviderOptions,
  provide,
} from '@venizia/ardor';

// No stereotype: ShopApplication registers it by hand in bindContext().
class CatalogService {}

// Discovered by its stereotype: the application binds only the options of the default providers.
@configuration()
export class ShopConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
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
| `BaseArdorApplication` | class | `@venizia/ardor` | The class to extend: binds the default providers, then runs the lifecycle. Lives in `@venizia/ardor-admin` |
| `AbstractArdorApplication` | class | `@venizia/ardor` | The lifecycle and the registration methods; lives in `@venizia/ardor-kernel` |
| `ArdorApplication` | component | `@venizia/ardor` | Root component connecting container to react-admin `CoreAdmin` |
| `IArdorApplication` | interface | `@venizia/ardor` | Container interface contract in `packages/kernel/src/common/types.ts` |
| `IApplicationInfo` | interface | `@venizia/ardor` | Application metadata shape returned by `getAppInfo()` |
| `IArdorArtifactIndex` | interface | `@venizia/ardor` | Stereotyped class index shape returned by `artifacts()` |
| `IArtifactRegistration` | interface | `@venizia/ardor` | Registration options for `service()`, `repository()`, `dataSource()`, `component()` |
| `IArdorApplicationProps` | interface | `@venizia/ardor` | Props accepted by `ArdorApplication` in `packages/admin/src/common/types.ts` |
| `CoreBindings` | class | `@venizia/ardor` | Container binding keys in `packages/kernel/src/common/keys.ts` |

> [!NOTE]
> `CoreBindings` (in `packages/kernel/src/common/keys.ts`) defines twelve keys: `APPLICATION_INSTANCE`, `APPLICATION_INFO`, `DEFAULT_AUTH_PROVIDER`, `DEFAULT_I18N_PROVIDER`, `DEFAULT_REST_DATA_PROVIDER`, `AUTH_PROVIDER_OPTIONS`, `DEFAULT_AUTH_SERVICE`, `REST_DATA_PROVIDER_OPTIONS`, `I18N_PROVIDER_OPTIONS`, `FEATURES`, `PERMISSION_PROVIDER` and `PERMISSION_PROVIDER_OPTIONS`. See [Binding keys](./binding-keys) for details on each key.

## BaseArdorApplication

`BaseArdorApplication` (in `packages/admin/src/applications/base.ts`) extends `AbstractArdorApplication` (in `packages/kernel/src/base/applications/abstract.ts`), which extends the IGNIS `Container`. The application instance is the container itself: call `this.bind(...)` and `this.get(...)` directly on the application instance.

`BaseArdorApplication` binds the four default providers itself, each a singleton, before anything of the application: `DefaultAuthService`, `DefaultRestDataProvider`, `DefaultI18nProvider` and `DefaultAuthProvider`. The application binds only their options (`REST_DATA_PROVIDER_OPTIONS`, `AUTH_PROVIDER_OPTIONS`, `I18N_PROVIDER_OPTIONS`) with `@provide`. A binding under the same key, in a stereotyped class, a feature, `bindingList()` or `bindContext()`, replaces a default.

### start()

Signature: `start(): Promise<void>`

Startup executes in three steps:

1. **Resolves dynamic artifact indexes**: awaits `group.resolve()` if an artifact group provides one.
2. **Executes pre-configuration**: `await this.preConfigure();`.
3. **Executes post-configuration**: `await this.postConfigure();`.

### preConfigure()

Signature: `preConfigure(): ValueOrPromise<void>`

The exact execution order in `packages/kernel/src/base/applications/abstract.ts` is:

1. Binds `CoreBindings.APPLICATION_INSTANCE`: `this.bind({ key: CoreBindings.APPLICATION_INSTANCE }).toValue(this);`.
2. Checks the value of `this.getAppInfo()` (a non-blank string `name`, a string `version`, and an `id` that `LocalStorageKeys.scoped` accepts, when there is one; a failure throws, so `start()` rejects) and binds it under `CoreBindings.APPLICATION_INFO`. When `getAppInfo()` returns a promise, `preConfigure()` waits for it, checks and binds the resolved value, then runs steps 3 to 7.
3. Invokes `this.bindDefaults()`: empty in `AbstractArdorApplication`; `BaseArdorApplication` binds the four default providers here.
4. Invokes `this.registerArtifacts()`: discovers and binds stereotyped classes, and the `@provide` methods of every discovered class.
5. Invokes `this.registerFeatures({ features: this.features() })`: validates features and binds `CoreBindings.FEATURES`.
6. Iterates entries of `this.bindingList()`: binds each target under its literal key as `BindingScopes.SINGLETON`. A key held by a class declared `allowOverride: false` throws.
7. Returns `this.bindContext()`: executes custom manual bindings and awaits if asynchronous.

Each step binds over the one before it, so the most explicit wins a shared key.

> [!IMPORTANT]
> `preConfigure()` itself directly binds `APPLICATION_INSTANCE` and `APPLICATION_INFO`; `registerFeatures` binds `FEATURES`, and `bindDefaults()` binds the defaults. All other keys are bound through `@provide` methods, `bindingList()`, `bindContext()`, or stereotype decorators. When overriding `preConfigure()`, you must call `await super.preConfigure()`, or core bindings are skipped and `bindContext()` is not invoked.

### postConfigure()

Signature: `postConfigure(): ValueOrPromise<void>`

Lifecycle hook called after `preConfigure()` and `bindContext()` complete. In `AbstractArdorApplication` it is an empty no-op; `BaseArdorApplication` uses it to check the providers (see below), so call `super.postConfigure()` first when you override it. Override it to execute initialization that requires container bindings to be in place:

```ts
import { getError } from '@venizia/ignis-inversion';

import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

// No stereotype: ShopApplication registers it by hand in bindContext().
class SettingsService {
  async load(): Promise<void> {}
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.service(SettingsService);
  }

  override async postConfigure(): Promise<void> {
    super.postConfigure();

    // The key was recorded on the class when it was registered: no key string to repeat.
    const key = this.getMetadataRegistry().getBindingKey({ target: SettingsService });

    if (key === undefined) {
      throw getError({ message: '[postConfigure] SettingsService is not registered' });
    }

    // Checked, not asserted: what the key holds must be the class.
    const settings: unknown = this.get({ key });

    if (!(settings instanceof SettingsService)) {
      throw getError({ message: '[postConfigure] The key of SettingsService holds another class' });
    }

    await settings.load();
  }
}
```

#### Failing at boot

`BaseArdorApplication.postConfigure()` calls `ApplicationProviders.assertConfigured({ container: this })`, which resolves the data, auth and i18n providers now, as `ArdorApplication` does when it mounts. A missing options binding, or `AUTH_PROVIDER_OPTIONS` without the `use` toggle, then rejects `start()` with an error that names the binding key and says what to bind, and not in the middle of a render. A subclass that overrides `postConfigure()` calls `super.postConfigure()` first. Pass `isAuthRequired: true` when you call it yourself for an application that always binds a sign-in.

```ts
import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  type IApplicationInfo,
  type IRestDataProviderOptions,
  provide,
} from '@venizia/ardor';

@configuration()
export class ShopConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: '/api' };
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {}

  // The options come from ShopConfiguration above, which start() discovers.
  override postConfigure(): void {
    super.postConfigure();
  }
}
```

### registerArtifacts()

Signature: `registerArtifacts(): void`

Discovers and binds stereotyped classes and the `@provide` methods of every discovered class (a `@configuration()` class, or any other stereotyped one):

1. Retrieves discovered classes from `MetadataRegistry.getInstance().getDiscoveredArtifacts()`.
2. Asserts indexed classes via `this.assertIndexed()`: verifies every class in `this.resolvedIndexes ?? this.artifacts()` was discovered. A class whose `when` returns `false` is still discovered, so an index may list it.
3. Calls the `when` of each class that declares one, once, with `{ application }`. A class whose `when` returns `false` is left out of the steps below.
4. Checks derived keys via `ArtifactBindingKeys.assertNoDerivedCollision()`: ensures no key collisions under minification.
5. Checks pinned keys: two different classes that end on one key, where at least one declared it with `binding`, throw. A class declared again under its own name by a hot reload is not counted.
6. Binds each remaining class under its resolved key using its declared scope (`BindingScopes.SINGLETON` by default).
7. Binds every `@provide` method of those classes to a lazy provider (`toProvider`), a singleton unless its `scope` says otherwise, resolving on first `get()`.

A stereotype's `order` and `after` are not read: every binding is lazy, so the order of registration changes nothing. A `when` must return a boolean at once; it cannot return a promise. A by-hand `service(X)` binds the class whatever its `when` says.

### artifacts()

Signature: `artifacts(): Array<IArdorArtifactIndex>`

Returns artifact index definitions checked by `start()` (default `[]`). `IArdorArtifactIndex` in `packages/kernel/src/common/types.ts` holds indexed classes grouped by kind:

| Kind | Type | Description |
|---|---|---|
| `configurations` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@configuration()` classes to verify upon startup |
| `dataSources` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@datasource()` classes to verify upon startup |
| `components` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@component()` classes to verify upon startup |
| `repositories` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@repository()` classes to verify upon startup |
| `services` | `ReadonlyArray<TClass<unknown>>` | Optional list of `@service()` classes to verify upon startup |
| `controllers` | `ReadonlyArray<TClass<unknown>>` | Optional list of controller classes (remains empty in browser applications) |

Artifact indexes ensure that bundlers do not drop classes that are only imported for decorator side-effects. The `ignis-artifacts generate` command emits the index, while the [Quickstart](../guides/get-started/5-minute-quickstart) uses `AutoArtifacts` from `@venizia/ignis-boot/auto` instead. An artifact group with `isArtifactGroup: true` provides inlined `content` or a `resolve()` function that `start()` awaits dynamically.

### features()

Signature: `features(): Array<IFeatureBase>`

Returns feature packages mounted by the application (default `[]`), bound by `preConfigure()` under `CoreBindings.FEATURES`. `IFeatureBase` in `packages/kernel/src/common/types.ts` defines the feature contract:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique identifier for the feature package within an application |
| `configurations` | `Array<TClass<unknown>>` | Optional list of feature `@configuration()` classes to verify and discover |
| `artifacts` | `IArdorArtifactIndex` | Optional: the feature's own stereotyped classes, by value, per group |
| `permissions` | `Array<string>` | Optional descriptive list of the permission names the feature's pages use; it enforces nothing |

For details on feature mounting, routes, resources, and translations, see [Features](./features).

### bindingList()

Signature: `bindingList(): Record<string, TClass<unknown>>`

Returns a mapping of literal binding keys to class constructors. Default returns `{}`. `preConfigure()` registers each class under its literal key as `BindingScopes.SINGLETON` and records the key on the class, so a component still resolves it by `{ target }`. Prefer a stereotype or a by-hand method: they derive the key for you. An entry replaces a stereotype or a feature binding on the same key, but not a class declared `allowOverride: false`: that throws, and only `bindContext()` replaces it.

### bindContext()

Signature: `abstract bindContext(): ValueOrPromise<void>`

Abstract method implemented by subclasses to register manual bindings or overrides directly on the container. Because `bindContext()` runs last in `preConfigure()`, any binding created here takes precedence over stereotype decorators, configuration `@provide` methods, features, and `bindingList()`, including a class declared `allowOverride: false`. Do not call `super.bindContext()`.

### getAppInfo()

Signature: `abstract getAppInfo(): ValueOrPromise<IApplicationInfo>`

Abstract method returning application metadata, bound under `CoreBindings.APPLICATION_INFO`. When it returns a promise, `preConfigure()` binds the resolved value. `start()` rejects when `name` is empty or only spaces, when `version` is not a string, or when `id` has anything but letters, digits, `.`, `_` and `-` (or is made of dots only). `IApplicationInfo` in `packages/kernel/src/common/types.ts` specifies application metadata:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Name of the application |
| `version` | `string` | Application version string |
| `description` | `string` | Human-readable application description |
| `id` | `string` | Optional. Scopes the session and store keys in browser storage to this application |
| `author` | `{ name: string; email: string; url?: string }` | Optional author contact information |

For `id`, see [Binding keys](./binding-keys#two-applications-on-one-origin).

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
| `scope` | `TBindingScope` | The scope declared on the class, else `BindingScopes.SINGLETON` | Inversion-of-control lifecycle scope for the class |
| `allowOverride` | `boolean` | `true` | When `false`, refuses to replace a binding if the key is already bound; `bindingList()` cannot replace it either |

Each method binds the class into its stereotype namespace in the scope declared on the class, else as a `BindingScopes.SINGLETON`, and associates the key with the constructor in the metadata registry.

```ts
import { BaseArdorApplication, BindingNamespaces, type IApplicationInfo } from '@venizia/ardor';

// Registered by hand below: none of them carries a stereotype.
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
      binding: { namespace: BindingNamespaces.SERVICE, key: 'mail' },
      allowOverride: false,
    });
  }
}
```

## ArdorApplication

`ArdorApplication` (in `packages/admin/src/components/application.tsx`) is the root React component connecting the started application container to react-admin's `CoreAdmin`. Component properties are typed by `IArdorApplicationProps` in `packages/admin/src/common/types.ts`.

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `container` | `Container` | Yes | The started IoC container instance (`BaseArdorApplication`). |
| `reduxStore` | `Store` | No | The Redux store the shell serves. |
| `suspense` | `ReactNode` | Yes | Fallback while feature messages load, and inside the layout while a lazy route page loads. |
| `logger` | `ILogger` | No | The logger `useApplicationLogger()` returns. |
| `resources` | `Array<ResourceProps>` | No | Resource definitions registered before feature resources. |
| `routes` | `Array<TArdorRoute>` | No | Custom routes, mounted before feature routes; each may declare `access`, `auth` and `layout`. |
| `features` | `Array<TFeature>` | No | The features to mount. |
| `accessDenied` | `ComponentType` | No | The page at `/access-denied`. Default: `AccessDeniedPage`. |
| `...reactAdminProps` | `Omit<CoreAdminProps, 'children'>` | No | Additional react-admin properties passed directly to `CoreAdmin`. |

- `reduxStore`: absent, no Redux provider is mounted, and the Redux hooks of `@venizia/ardor-react` throw.
- `logger`: the type is `ILogger` from `@venizia/ignis-helpers/core`. The default is a console logger named `ArdorApplication`, behind IGNIS's `LoggerFactory`, so a provider registered with `LoggerFactory.use` is the one used.
- `features`: absent, every feature bound under `CoreBindings.FEATURES` is mounted. See [Mount a filtered list](./features#mount-a-filtered-list).
- `accessDenied`: react-admin sends a user whom `canAccess` denies a resource to `/access-denied`, and `DefaultAuthProvider` sends a 403 there (`unauthorizedPagePath`). `AccessDeniedPage` shows a title, a sentence and a link home, translated with the `ardor.access_denied` keys. Pass your own component to replace it. A custom route with `access` sends a denied user there too.
- `...reactAdminProps`: such as `loginPage`, `layout`, `dashboard`, `title`, `theme`, `catchAll`, `basename`.

### Render Lifecycle

When rendered, `ArdorApplication` executes the following sequence:

1. **Resolves Default Providers**, which `BaseArdorApplication` bound:
   - `CoreBindings.DEFAULT_REST_DATA_PROVIDER`: Resolves `IDataProvider`, which extends react-admin's nine data methods with `send`, `getNetworkService`, and `getDataSourceAuth`. Needs `REST_DATA_PROVIDER_OPTIONS`. See [Data provider](./data-provider).
   - `CoreBindings.DEFAULT_AUTH_PROVIDER`: Resolved only when `AUTH_PROVIDER_OPTIONS` is `{ use: true }`. Unbound, or `{ use: false }`, react-admin runs without an auth provider - every page is public. See [Auth provider](./auth-provider).
   - `CoreBindings.DEFAULT_I18N_PROVIDER`: Resolves the `I18nProvider` implementation. `I18N_PROVIDER_OPTIONS` is optional: unbound, the application is English only. See [i18n](./i18n).
2. **Mounts Resources and Routes**: Reads features from `CoreBindings.FEATURES` via `Features.read({ container })`, or takes the `features` prop instead, and mounts the application's own `resources` and `routes`, followed by each feature's resources and routes in order via `Features.mount({ features, resources, routes })`. A duplicate resource name, a duplicate route path, a route whose path is `/<resource name>` and a route with neither `id` nor `path` throw. See [Mount order and conflict checks](./features#mount-order-and-conflict-checks).
3. **Verifies Translation Readiness**: Calls `useFeatureMessagesReady`. If any mounted feature supplies lazy translation loaders for the active locale, `changeLocale()` is triggered, and `suspense` is rendered until messages are loaded.
4. **Assembles Component Context**: Wraps the tree in `ApplicationContext.Provider` (`{ container, logger }`), `ReduxProvider` (`reduxStore`, only when passed), and `React.Suspense` (`suspense`). Each route page also has its own `React.Suspense` with the same fallback, so a `React.lazy` page shows `suspense` inside the layout and the layout stays mounted while it loads.
5. **Renders CoreAdmin**: Forwards providers and props to `CoreAdmin`, mounting each resource under `<Resource />`, routes under `<CustomRoutes>`, and routes with `layout: { use: false }` under a second `<CustomRoutes noLayout>`. See [Public pages and pages outside the layout](./features#public-pages-and-pages-outside-the-layout).

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
      resources={[{ name: 'products' }]}
    />
  );
}
```

## Errors

`packages/kernel/src/base/applications/abstract.ts` and `Features.mount()` throw errors during startup and render when configuration constraints or artifact expectations are violated:

### `[registerArtifacts] Two classes derive the binding key '<key>'`

- Thrown by: `registerArtifacts()` via `ArtifactBindingKeys.assertNoDerivedCollision`
- Cause: two discovered classes share the same name or were renamed to the same name by a minifier, causing colliding derived binding keys (`${namespace}.${name}`).
- Fix: set an explicit binding key via `@service({ binding: { namespace, key } })` or the `binding` registration option, or configure the bundler to preserve class names.

### `[registerArtifacts] The 'when' of <Name> threw` and `must return a boolean synchronously`

- Thrown by: `registerArtifacts()`
- Cause: the `when` option of a stereotype threw, returned a promise, or returned something that is not a boolean.
- Fix: return `true` or `false` without waiting for anything. Read the flag before the class is declared, or bind the class by hand in `bindContext()`.

### `[registerArtifacts] The key '<key>' is claimed by both <A> and <B>`

- Thrown by: `registerArtifacts()`
- Cause: two different classes end on one binding key and at least one pinned it with `binding`, so the one imported last would silently replace the other.
- Fix: give one of the two classes another key, select one with `when`, or bind the intended one in `bindContext()`.

### `[bindingList] '<key>' is held by <Class> with allowOverride false`

- Thrown by: `preConfigure()`, in the `bindingList()` step
- Cause: `bindingList()` has an entry under a key that a class declared `allowOverride: false` holds.
- Fix: bind the replacement in `bindContext()`, which overrides on purpose, or remove `allowOverride: false` from the class.

### `[artifacts] A group has neither content nor resolve`

- Thrown by: `resolveArtifactIndexes()` in `start()`
- Cause: an artifact group returned by `artifacts()` has `isArtifactGroup: true`, but has neither pre-inlined `content` nor a `resolve()` function.
- Fix: return `AutoArtifacts` from `@venizia/ignis-boot/auto`, or build with `IgnisArtifactsPlugin` so the group includes inlined content.

### `[artifacts] '<kind>' lists an entry that is not a class (position <pos>)`

- Thrown by: `assertIndexed()` in `registerArtifacts()`
- Cause: an artifact index entry is `undefined` or not a function. This is typically caused by circular imports evaluating a module before its class is defined.
- Fix: break the circular import cycle. Ensure the module importing the artifact index does not define decorated classes or get imported by them.

### `[artifacts] '<kind>' lists <Name>, which was never discovered`

- Thrown by: `assertIndexed()` in `registerArtifacts()`
- Cause: a class listed in an artifact index was not found in `MetadataRegistry.getDiscoveredArtifacts()`. The class is missing its stereotype decorator, was never imported, or the index is stale.
- Fix: decorate the class with its stereotype (`@service()`, `@repository()`, `@datasource()`, `@component()`, `@configuration()`), import its module, and regenerate the index.

### `[features] Two features are named '<name>'`

- Thrown by: `registerFeatures()` in `preConfigure()`
- Cause: two feature definitions returned by `this.features()` have the same `name` property.
- Fix: ensure every mounted feature has a unique `name`.

### `[features] '<feature>' lists <Name>, which was never discovered`

- Thrown by: `registerFeatures()` in `preConfigure()`
- Cause: a configuration class listed in a feature's `configurations` array was not discovered in the metadata registry.
- Fix: decorate the class with `@configuration()` and import its module before calling `start()`.

### `[features] Resource '<name>' is mounted by both '<owner1>' and '<owner2>'`

- Thrown by: `Features.mount()` in `ArdorApplication`
- Cause: two mounted features, or the application and a mounted feature, register a resource with the same `name`.
- Fix: ensure resource names are unique across the application and all mounted features.

### `[<caller>] '<key>' is already bound and allowOverride is false`

- Thrown by: `service()`, `repository()`, `dataSource()`, `component()`
- Cause: a registration method was called with `allowOverride: false` (or its decorator set `allowOverride: false`), but the key is already bound in the container.
- Fix: pass a distinct binding key via `opts.binding`, or omit `allowOverride: false` if replacing the existing binding is intentional.

## Related

- [Application Guide](../guides/core-concepts/application) - Architectural overview of the ARDOR container and component tree
- [Configuration Guide](../guides/core-concepts/configuration) - Using `@configuration()` classes and `@provide` methods
- [Binding keys](./binding-keys) - CoreBindings reference and key conventions
- [Features](./features) - Feature packages, routing, resources, and translation modules
