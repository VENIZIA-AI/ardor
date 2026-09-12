---
title: Application
description: The ARDOR application base - BaseArdorApplication, the start() lifecycle, injectable() and service() registration, getAppInfo, and how ArdorApplication hands the container to the React tree.
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

  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>): void;
  service<T>(value: TClass<T>): void;

  start(): Promise<void>;
}

abstract class BaseArdorApplication extends AbstractArdorApplication {}
```

```ts
import {
  BaseArdorApplication,
  CoreBindings,
  type IApplicationInfo,
  type IRestDataProviderOptions,
} from '@venizia/ardor';

class ProductService {
  list() {
    return ['book', 'pen'];
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext() {
    const options: IRestDataProviderOptions = { url: 'https://api.example.com' };
    this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue(options);
    this.service(ProductService);
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

The default implementation does three things, in this order:

1. Binds `CoreBindings.APPLICATION_INSTANCE` to `this`.
2. Binds `CoreBindings.APPLICATION_INFO` to `this.getAppInfo()`.
3. Returns `this.bindContext()`.

Because `start()` awaits the return value, an async `bindContext()` finishes before `postConfigure()` runs. If you override `preConfigure()`, call `super.preConfigure()` or the two core keys are never bound and `bindContext()` is never called.

### bindContext()

Abstract. This is where you bind provider options, the default providers, and your own services. There is no base implementation, so do not call `super.bindContext()`.

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
    const config = this.get<ConfigService>({ key: 'services.ConfigService' });
    await config.load();
  }
}
```

## injectable() and service()

`injectable()` registers a class under a computed key. It is one of the few positional signatures in ARDOR.

```ts no-check
abstract class AbstractArdorApplication extends Container {
  ...
  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>): void;
}
```

What it does:

- Key is `` `${scope}.${value.name}` `` - for `injectable('services', ProductService)` the key is `services.ProductService`.
- The binding is `toClass(value)`.
- Scope is set to `BindingScopes.SINGLETON`. One instance per application, resolved lazily on first `get`.
- Tags, if given, are applied with `setTags(...tags)`.

`service()` is the shorthand for the `services` scope:

```ts no-check
abstract class AbstractArdorApplication extends Container {
  ...
  service<T>(value: TClass<T>): void {
    this.injectable('services', value);
  }
}
```

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

class ProductRepository {}
class EmailService {}
class ProductService {}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext() {
    this.injectable('repositories', ProductRepository); // key: repositories.ProductRepository
    this.injectable('services', EmailService, ['notifications']); // key: services.EmailService
    this.service(ProductService); // key: services.ProductService
  }
}
```

Resolve a registered class with `get({ key })` on the application, or with `useInjectable` inside React (see [Hooks](../references/hooks)).

## ArdorApplication - handing the container to React

`ArdorApplication` is the root component. It takes the started application as `container`, resolves the three default providers from it, and renders react-admin's `CoreAdmin`.

```tsx no-check
interface IApplication extends Omit<CoreAdminProps, 'children'> {
  container: Container;
  enableDebug?: boolean;
  reduxStore: Store;
  suspense: ReactNode;
  resources: Array<ResourceProps>;
  customRoutes?: {
    routes: Array<RouteProps>;
  };
}
```

What the component does:

1. Inside a `useMemo` keyed on `container` and the remaining props, it calls `container.get({ key })` for `CoreBindings.DEFAULT_REST_DATA_PROVIDER`, `CoreBindings.DEFAULT_AUTH_PROVIDER` and `CoreBindings.DEFAULT_I18N_PROVIDER`. These three keys must be bound before the component renders - see [Data provider](../references/data-provider), [Auth provider](../references/auth-provider) and [i18n](../references/i18n).
2. Wraps the tree in `ApplicationContext.Provider` with `{ container, registry: container, logger }`. The logger is `Logger.getInstance({ scope: 'ArdorApplication', enableDebug })`.
3. Wraps that in `ReduxProvider` with `reduxStore`, then `React.Suspense` with `suspense` as the fallback.
4. Renders `CoreAdmin` with `dataProvider`, `authProvider`, `i18nProvider` and every other `CoreAdminProps` prop you passed.
5. Renders one `Resource` per entry in `resources`, and one `Route` per entry in `customRoutes.routes` inside `CustomRoutes`. Route keys are `route.id ?? route.path`.

```tsx
import { ArdorApplication } from '@venizia/ardor';

export const Root = () => (
  <ArdorApplication
    container={container}
    reduxStore={store}
    suspense={<Spinner />}
    resources={[{ name: 'products', list: ProductList }]}
    customRoutes={{ routes: [{ path: '/about', element: <div>About</div> }] }}
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
- **Keys depend on the runtime class name.** `injectable()` builds the key from `value.name`. If a build step renames classes, `get({ key: 'services.ProductService' })` no longer matches. Use the stable keys in [Binding keys](../references/binding-keys) for the core bindings.
- **Two instances of a service.** Registering the same class under two scopes gives two singletons, one per key.

## Related

- [Binding keys](../references/binding-keys)
- [Data provider](../references/data-provider)
- [Auth provider](../references/auth-provider)
- [i18n](../references/i18n)
- [Hooks](../references/hooks)
- [Quickstart](../guides/get-started/quickstart)
- [Migration from ra-core-infra](../guides/migration/from-ra-core-infra)
