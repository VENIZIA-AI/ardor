---
title: Application
description: The ARDOR application base - BaseArdorApplication, the start() lifecycle, registration by stereotype and by hand, getAppInfo, and how ArdorApplication hands the container to the React tree.
---

# Application

## Prerequisites

You know the IGNIS `Container` API (`bind({ key })`, `toValue`, `toClass`, `get({ key })`) and have read the [Quickstart](../guides/get-started/quickstart).

## Quick Reference

| Export | Kind | Purpose |
| --- | --- | --- |
| `AbstractArdorApplication` | class | Container subclass with the lifecycle and registration helpers |
| `BaseArdorApplication` | class | Empty subclass of `AbstractArdorApplication` - the one to extend |
| `IArdorApplication` | interface | Contract implemented by the application |
| `IApplicationInfo` | interface | Shape returned by `getAppInfo()` |
| `IArtifactIndex` | interface | The index `ignis-artifacts generate` emits, returned by `artifacts()` |
| `CoreBindings.APPLICATION_INSTANCE` | key | Bound to the application itself in `preConfigure()` |
| `CoreBindings.APPLICATION_INFO` | key | Bound to the result of `getAppInfo()` in `preConfigure()` |
| `ArdorApplication` | component | Reads the three default providers from the container and renders `CoreAdmin` |
| `IApplication` | interface | Props of `ArdorApplication` |

## The application is the container

`AbstractArdorApplication` extends the IGNIS `Container`. There is no separate `container` property. You call `this.bind(...)` and `this.get(...)` directly on the application, and you pass the application instance wherever a `Container` is expected.

`BaseArdorApplication` adds nothing on top of `AbstractArdorApplication`. Extend it and implement the two abstract methods.

```tsx no-check
abstract class AbstractArdorApplication extends Container implements IArdorApplication {
  abstract bindContext(): ValueOrPromise<void>;
  abstract getAppInfo(): ValueOrPromise<IApplicationInfo>;

  preConfigure(): ValueOrPromise<void>;
  postConfigure(): ValueOrPromise<void>;

  registerArtifacts(): void;
  artifacts(): Array<IArtifactIndex>;
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
  list() {
    return ['book', 'pen'];
  }
}

// The framework bindings, declared: start() binds each @provide method under its key, SINGLETON.
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

  bindContext() {
    this.service(CatalogService);
  }
}

export async function boot() {
  const app = new ShopApplication();
  await app.start();
  return app;
}
```

## getAppInfo()

`getAppInfo()` is abstract. It returns an `IApplicationInfo`:

```ts no-check
interface IApplicationInfo {
  name: string;
  version: string;
  description: string;
  author?: { name: string; email: string; url?: string };
  [extra: string | symbol]: any;
}
```

`preConfigure()` binds whatever `getAppInfo()` returns under `CoreBindings.APPLICATION_INFO`. The return value is bound as-is - it is not awaited. Return a plain object so consumers that resolve `APPLICATION_INFO` (for example the REST data provider, which receives `applicationInfo` in `IGetRequestPropsParams`) get an object and not a Promise.

## start() lifecycle

`start()` runs two steps in order and awaits each one:

```ts no-check
abstract class AbstractArdorApplication extends Container {
  ...
  async start() {
    await this.preConfigure();
    await this.postConfigure();
  }
}
```

### preConfigure()

The default implementation does six things, in this order:

1. Binds `CoreBindings.APPLICATION_INSTANCE` to `this`.
2. Binds `CoreBindings.APPLICATION_INFO` to `this.getAppInfo()`.
3. `registerArtifacts()`: checks that every class an `artifacts()` index lists was discovered (see [A generated artifact index](#a-generated-artifact-index)), then binds every class a stereotype marked (`@service()` and the rest), and binds each `@provide` method of every `@configuration()` class under its key - lazy, `BindingScopes.SINGLETON` unless the decorator passes a `scope`. It first throws when two different classes derive the same key from their name (`[registerArtifacts] Two classes derive the binding key 'services.e' ...`), as two classes a minifier named alike would; the second would otherwise silently replace the first. A pinned `binding` is never counted, nor is a subclass discovered after its same-named parent. The check uses IGNIS's `ArtifactBindingKeys`, re-exported by ARDOR, and runs once per `start()`, so a hot reload that re-evaluates a module is not an error.
4. Binds `features()` under `CoreBindings.FEATURES`, after checking that no two share a `name` and that every configuration class a feature lists was discovered - see [Features and permissions](./features).
5. Binds each entry of `bindingList()` under its literal key, as a singleton.
6. Returns `this.bindContext()`.

Least explicit first, so for a shared key the later step wins: a stereotype, a `@provide` binding or a feature's binding loses to `bindingList()`, and all of them lose to `bindContext()`.

Because `start()` awaits the return value, an async `bindContext()` finishes before `postConfigure()` runs. If you override `preConfigure()`, call `super.preConfigure()` or the two core keys are never bound and `bindContext()` is never called.

### bindContext()

Abstract. The framework bindings - provider options and the default providers - are declared in a `@configuration()` class instead, as the `ShopConfiguration` example above shows, so this is usually empty.

`registerArtifacts()` binds each `@provide` method under the key the decorator names. The value is resolved lazily, on the first `get()` for the key, and cached as a singleton unless `@provide({ key, scope })` says otherwise - so react-admin, `DefaultAuthProvider`, every hook and every datasource share one data provider. A configuration class works like any other discovered class: import it before `application.start()`, or it is never bound.

Use `bindContext()` only for an override - a binding declared there replaces a provided one.

An async `@provide` method caches its promise as the singleton. If that promise rejects, the rejection stays cached until the container is cleared, and every later `get()` rejects again. Keep `@provide` methods synchronous, or catch inside the method.

There is no base implementation, so do not call `super.bindContext()`.

### postConfigure()

A no-op by default. Override it for work that needs the bindings from `bindContext()` to exist, such as resolving a service and calling an async method on it.

```tsx
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

class ConfigService {
  async load() {
    return { featureFlags: ['beta'] };
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext() {
    this.service(ConfigService);
  }

  async postConfigure() {
    const key = this.getMetadataRegistry().getBindingKey({ target: ConfigService });
    const config = this.get<ConfigService>({ key: String(key) });
    await config.load();
  }
}
```

## A generated artifact index

A class that nothing imports before `start()` is never bound, and a bundler may drop a module that is imported only for its side effects. Generate an index of every stereotyped class with IGNIS's `ignis-artifacts`, then return it from `artifacts()`:

```bash
ignis-artifacts generate --root src --out src/_artifacts.ts --source-module @venizia/ardor
```

```ts
import {
  BaseArdorApplication,
  type IApplicationInfo,
  type IArtifactIndex,
  service,
} from '@venizia/ardor';

@service()
class OrderService {}

// What the generator writes into src/_artifacts.ts; import it from there.
const GeneratedArtifacts = {
  configurations: [],
  dataSources: [],
  components: [],
  repositories: [],
  services: [OrderService],
  controllers: [],
};

class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [GeneratedArtifacts];
  }

  bindContext(): void {}
}
```

The index adds no binding. Discovery still binds every stereotyped class; the index holds each class by value, so the import is a value a bundler keeps. `start()` then throws when a listed class was never discovered (`[artifacts] 'services' lists OrderService, which was never discovered`), which means the class lost its decorator or the index is stale. Regenerate the index after adding or renaming a class.

Pass `--source-module` once per package your classes import their stereotypes from (`@venizia/ardor`, `@venizia/ardor-kernel`). Without it the generator reads only IGNIS's own imports and finds none of your classes. `controllers` stays empty in a browser application.

An IGNIS artifact group (`isArtifactGroup: true`) is also accepted by `artifacts()`. Its kind fields throw when read, so `start()` never reads them. A group that carries `content` (a flat index a bundler plugin inlined) is checked as that index. A group without `content` is resolved first: `start()` awaits its `resolve()`, which imports the application's modules and so decorates their classes, then checks the flat index it returns before it registers anything. A group with neither `content` nor a `resolve` function, such as one made by `ArtifactGroup.define()` or `ArtifactGroup.application()`, cannot be resolved here: `start()` throws and names `AutoArtifacts` and `IgnisArtifactsPlugin`, the two ways to give it its classes.

### Without a generated file: ignis-boot auto

`@venizia/ignis-boot` 0.2.1 and later can also hand the application its own decorated classes, found by the scanner, as `AutoArtifacts`. The scan follows ARDOR's re-exports of the decorators, so it needs no flag.

```ts no-check
import AutoArtifacts from '@venizia/ignis-boot/auto';
import { BaseArdorApplication, type IArtifactIndex } from '@venizia/ardor';

class Application extends BaseArdorApplication {
  override artifacts(): Array<IArtifactIndex> {
    return [AutoArtifacts];
  }
  // ... getAppInfo() and bindContext() as usual.
}
```

`AutoArtifacts` is a group with a `resolve()`, so `start()` resolves it before it registers anything. How the list gets built depends on how you run the application:

| How you run it | Result |
| --- | --- |
| `bun run` from source | `start()` awaits `AutoArtifacts.resolve()`, which scans the application from its entry file (`Bun.main`), whatever the working directory, and imports the modules. |
| `Bun.build` with `plugins: [IgnisArtifactsPlugin.create()]`, server target | The bundle carries the class list, with no scanner. `AutoArtifacts` has a `resolve()` over the bundle's own imports, and `start()` checks the index it returns like a generated index. |
| The same plugin with `target: 'browser'` | The list is imported eagerly and sits in `AutoArtifacts` as `content`, which `start()` checks as it is. Eager imports keep the bundle tree-shakeable; a lazy index doubled a measured browser bundle. No `node:fs` in the bundle. |
| A Vite build with `IgnisArtifactsVitePlugin.create()` from `@venizia/ignis-boot/vite` | The list is built into the bundle and imported eagerly, so `AutoArtifacts` carries it as `content` and the bundle stays tree-shakeable. The plugin pins the name of each class it lists, including the classes of a borrowed kit group (see [Borrowing a kit's classes in a browser build](#borrowing-a-kit-s-classes-in-a-browser-build)), with an injected `static { Object.defineProperty(this, 'name', ...) }` (binding keys come from `Class.name`, which a minifier renames; needs ignis-boot 0.2.1 or later), so the rest of the bundle minifies as usual, and it runs under Node. Measured on `examples/5-mins-qs` and `examples/vert-admin` in a minified build in a browser. |

Auto registers what is decorated: a class that loses its decorator is simply not registered, in every mode. A generated index fails the boot instead, so prefer it when you want that guarantee.

In a browser build, import `@venizia/ignis-boot/auto` from the application's own module, never from a shared kit. The eager import evaluates the application's classes when the auto module loads, and a kit that imports it would evaluate them inside its own half-loaded module graph. The same holds for the application module itself: keep every decorated class in a file of its own, and keep the module that imports `AutoArtifacts` free of them. When a cycle leaves `undefined` in the list, `start()` throws `[artifacts] 'services' lists an entry that is not a class (position 1)` and names the cause, as IGNIS's own index check does.

In a Vite build, add the plugin before `react()` and keep one decorated class per file:

```ts no-check
// vite.config.ts
import { IgnisArtifactsVitePlugin } from '@venizia/ignis-boot/vite';

export default defineConfig({
  plugins: [IgnisArtifactsVitePlugin.create(), react()],
  // ... the rest of the config
});
```

Setting `output.keepNames` for the whole build instead adds about 105 KB (14 KB gzipped) to `examples/5-mins-qs`; the plugin pins only the listed classes.

A group made with `ArtifactGroup.define()` or `ArtifactGroup.application()` has no `resolve()` of its own. Without content inlined by `IgnisArtifactsPlugin`, `start()` throws and names the plugin.

### Borrowing a kit's classes in a browser build

A shared package (a kit) declares the classes it offers once, as a group, and an application borrows it from `artifacts()`:

```ts no-check
// kit/src/index.ts
import { ArtifactGroup } from '@venizia/ignis-kernel/metadata';

export const KitServices = ArtifactGroup.define({ folder: 'services' });

// app/src/application.ts (the rest of the class is as usual)
// ...
override artifacts(): Array<IArtifactIndex> {
  return [AutoArtifacts, KitServices];
}
```

- **Import `ArtifactGroup` from `@venizia/ignis-kernel/metadata`**, the browser-safe entry (ignis-kernel 0.2.2 or later). The `@venizia/ignis-kernel` root re-exports the HTTP server, and a browser build that imports it fails on the optional `hono` and `@hono/zod-openapi` peers.
- **The plugin pins the kit's class names too** (ignis-boot 0.2.1 or later). It also scans the `src` of every package that defines a group the application can borrow, so a borrowed class keeps its name under minification and its key stays `services.GreetingService`, not `services.T`. Without this, the minifier renames a borrowed class: its key is wrong, or two kits collide and `start()` throws.
- **The kit must be a workspace package or a dependency the application can resolve**, and `folder` must be a string literal: the plugin reads it at build time.
- **The list is scanned once, when the dev server starts.** Editing a decorated class keeps hot reload. Adding or removing a decorated class, or a group, needs a `vite dev` restart, as it does on the backend: Vite fires no hook for a file that was just created, and a rescan on every save is too slow on a large application. A `vite build` always scans afresh.

## Registration by hand

`service()`, `repository()`, `dataSource()` and `component()` register one class, as in IGNIS. Each returns the `Binding`.

```ts no-check
interface IArtifactRegistration {
  binding?: { namespace: string; key: string }; // instead of <namespace>.<ClassName>
  scope?: TBindingScope; // default: singleton
  allowOverride?: boolean; // false refuses to replace an existing binding
}
```

- Key: `opts.binding`, else the class's stereotype binding, else `<namespace>.<ClassName>` (`services`, `repositories`, `datasources`, `components`).
- Scope: `opts.scope`, else the stereotype's, else `BindingScopes.SINGLETON`. IGNIS's server defaults services and repositories to transient; a browser does not, because a hook resolves on every render.
- The key is recorded on the class, so `@inject({ target })` and the `use*({ target })` hooks resolve it by class.

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

class ApiClient {}
class ProductRepository {}
class EmailService {}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext() {
    this.dataSource(ApiClient); // datasources.ApiClient
    this.repository(ProductRepository); // repositories.ProductRepository
    this.service(EmailService, { binding: { namespace: 'services', key: 'mail' } }); // services.mail
  }
}
```

`injectable(scope, value, tags?)` binds under `<scope>.<ClassName>` as a singleton with tags, and records the key too. Prefer the per-kind methods; see [Binding keys](../best-practices/binding-keys) for registration by stereotype.

## ArdorApplication - handing the container to React

`ArdorApplication` is the root component. It takes the started application as `container`, resolves the three default providers from it, and renders react-admin's `CoreAdmin`.

```tsx no-check
interface IApplication extends Omit<CoreAdminProps, 'children'> {
  container: Container;
  enableDebug?: boolean;
  reduxStore: Store;
  suspense: ReactNode;
  resources?: Array<ResourceProps>; // the application's own; each feature's mount after them
  routes?: Array<RouteProps>; // same for routes
}
```

What the component does:

1. Inside a `useMemo` keyed on `container` and the remaining props, it calls `container.get({ key })` for `CoreBindings.DEFAULT_REST_DATA_PROVIDER`, `CoreBindings.DEFAULT_AUTH_PROVIDER` and `CoreBindings.DEFAULT_I18N_PROVIDER`. The data and i18n keys must be bound before the component renders; the auth key is optional - leave it unbound and the admin runs with no sign-in (see [An application with no sign-in](../references/auth-provider#an-application-with-no-sign-in)). See [Data provider](../references/data-provider), [Auth provider](../references/auth-provider) and [i18n](../references/i18n).
2. Wraps the tree in `ApplicationContext.Provider` with `{ container, logger }`. The logger is `Logger.getInstance({ scope: 'ArdorApplication', enableDebug })`.
3. Wraps that in `ReduxProvider` with `reduxStore`, then `React.Suspense` with `suspense` as the fallback.
4. Renders `CoreAdmin` with `dataProvider`, `authProvider`, `i18nProvider` and every other `CoreAdminProps` prop you passed.
5. Renders one `Resource` per entry in `resources`, and one `Route` per entry in `routes` inside `CustomRoutes`, then the same for each feature. Route keys are `route.id ?? route.path`.

```tsx
import { ArdorApplication } from '@venizia/ardor';

export const Root = () => (
  <ArdorApplication
    container={container}
    reduxStore={store}
    suspense={<Spinner />}
    resources={[{ name: 'products', list: ProductList }]}
    routes={[{ path: '/about', element: <div>About</div> }]}
  />
);
```

Everything under `ArdorApplication` can reach the container with `useApplicationContext()` or `useInjectable()` and the logger with `useApplicationLogger()`.

## Common pitfalls

- **Rendering before `start()` resolves.** `ArdorApplication` calls `container.get` for the three default provider keys during render. Await `app.start()` first, then mount.
- **Calling `super.bindContext()`.** `bindContext()` is abstract. There is nothing to call.
- **Overriding `preConfigure()` without `super.preConfigure()`.** The override then skips binding `APPLICATION_INSTANCE` and `APPLICATION_INFO` and never runs `bindContext()`.
- **Async `getAppInfo()`.** `preConfigure()` binds the return value without awaiting it. Return a plain object.
- **Expecting `this.container`.** The application is the container. Use `this.bind(...)` and `this.get(...)`. Legacy ra-core-infra code that used `this.container.bind({ key, value })` becomes `this.bind({ key }).toValue(value)` - see the [migration guide](../guides/migration/from-ra-core-infra).
- **Typing a derived key.** A derived key contains the class name, which a production build renames. Resolve such classes by `target`, not by a typed `'services.X'` string.
- **`Two classes derive the binding key` at `start()`.** Two discovered classes share a name, usually two short names a minifier gave classes in different chunks. Pin `binding: { namespace, key }` on one of them, or keep the class names: `keepNames` in a bundler, or in a Vite build the plugin of ignis-boot 0.2.1 or later, which pins the names of the classes it lists.
- **Two instances of a service.** Registering the same class under two scopes gives two singletons, one per key.

## Related

- [Binding keys](../references/binding-keys)
- [Data provider](../references/data-provider)
- [Auth provider](../references/auth-provider)
- [i18n](../references/i18n)
- [Hooks](../references/hooks)
- [Quickstart](../guides/get-started/quickstart)
- [Migration from ra-core-infra](../guides/migration/from-ra-core-infra)
