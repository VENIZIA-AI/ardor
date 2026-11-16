---
type: Concept
title: Application lifecycle
description: How an ARDOR application boots through start(), preConfigure and postConfigure, and how ArdorApplication resolves providers from the container.
resource: packages/kernel/src/base/applications/abstract.ts
tags: [architecture, application, lifecycle, container, kernel]
---

# Application lifecycle

ARDOR applications are built by subclassing `BaseArdorApplication` (from `@venizia/ardor-admin`), which extends the kernel's `AbstractArdorApplication`, which extends the IGNIS `Container` itself (see [DI in the browser](/architecture/di-in-the-browser.md)). There is no separate app object wrapping a container - the application instance *is* the container. This is why an app can call `this.bind(...)` and `this.get(...)` directly on itself.

## start()

`start()` is the single entry point and it is the only method you call from outside:

```ts
async start() {
  this.resolvedIndexes = await this.resolveArtifactIndexes();
  await this.preConfigure();
  await this.postConfigure();
}
```

`start()` first resolves the lazy groups of `artifacts()` into the indexes that `registerArtifacts()` checks against. The two configure steps are then awaited in sequence. `postConfigure()` never runs concurrently with `preConfigure()`, and anything bound during `preConfigure()` is guaranteed to exist by the time `postConfigure()` runs.

## preConfigure()

The default `preConfigure()` in `AbstractArdorApplication` does seven things, in order:

1. Binds `CoreBindings.APPLICATION_INSTANCE` to `this` - the container can hand itself out as a value.
2. Binds `CoreBindings.APPLICATION_INFO` to whatever `this.getAppInfo()` returns. `getAppInfo()` is a `ValueOrPromise<IApplicationInfo>`: a promise is awaited, and the resolved value is what gets bound. Steps 3 to 7 run after that bind.
3. Calls `this.bindDefaults()`, a protected hook that is empty in the kernel. `BaseArdorApplication` overrides it to bind four SINGLETON defaults: `DEFAULT_AUTH_SERVICE` to `DefaultAuthService` (`toClass`), and `DEFAULT_REST_DATA_PROVIDER`, `DEFAULT_I18N_PROVIDER`, `DEFAULT_AUTH_PROVIDER` to `DefaultRestDataProvider`, `DefaultI18nProvider`, `DefaultAuthProvider` (`toProvider`, which instantiates the class and returns `value(container)`). The kernel cannot import those classes, so the override lives in admin.
4. Calls `this.registerArtifacts()`, which binds every class a stereotype (`@service()`, `@component()` and the rest) discovered, under the key the stereotype recorded on the class, in the scope it declares (singleton by default). A discovered class with no recorded key is skipped. For a `@configuration()` class it also binds each `@provide({ key })` method under its key, as a lazy provider, SINGLETON unless the decorator passes a `scope` - the same as IGNIS's `bindProvidedKeys`.
5. Calls `this.registerFeatures({ features: this.features() })`, which registers each feature (see [feature modules](/architecture/feature-modules.md)).
6. Binds every entry of `this.bindingList()` - a record of literal key to class, empty by default - with `toClass(...)` as a singleton, recording each key on its class.
7. Returns `this.bindContext()` - an abstract method every concrete application must implement. It binds the provider options (`REST_DATA_PROVIDER_OPTIONS` is the one a minimal app needs; `AUTH_PROVIDER_OPTIONS` `{ use: true }` turns sign-in on; `I18N_PROVIDER_OPTIONS` is optional), unless a `@configuration()` class provides them, and application artifacts get bound by hand with `this.service(X)`, `this.repository(X)`, `this.dataSource(X)`, `this.component(X)`.

Steps 3 to 7 run from least explicit to most explicit, and a later bind on the same key replaces the earlier one: defaults, then stereotypes and `@provide`, then features, then `bindingList()`, then `bindContext()`. So a `@provide` method replaces a default, a `bindingList()` entry overrides a stereotype on the same key, and a manual `this.bind(...)` in `bindContext()` overrides all of them. A class declared `allowOverride: false` is replaced by `bindContext()` only: `bindingList()` throws for it. Replacing a default is one line in `bindContext()`: `this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(CountRestDataProvider).setScope(BindingScopes.SINGLETON)`. See [binding key namespaces](/conventions/binding-key-namespaces.md) for when to reach for each form.

Because `bindContext()` can be async and its return value is what `preConfigure()` returns, `start()`'s `await this.preConfigure()` also waits for `bindContext()` to finish. This ordering matters: any subclass overriding `preConfigure()` must call `super.preConfigure()`, or none of the seven steps happen - not the two core bindings, not the defaults, not the stereotype and `bindingList()` registrations, and not `bindContext()`.

## postConfigure()

A no-op by default. It exists as a hook for work that depends on bindings made in `bindContext()` - for example resolving a service and calling an async initializer on it. Because it runs after `preConfigure()` fully resolves, everything bound in `bindContext()` is safe to `get()` here.

## Registration by hand

Registration helpers on the application, not lifecycle steps, called from inside `bindContext()`.

`service(X)`, `repository(X)`, `dataSource(X)` and `component(X)` bind one class under `opts.binding`, else the class's stereotype `binding`, else `<namespace>.<ClassName>`. Each records that key on the class, so `{ target }` resolves it, and returns the `Binding`. The scope is `opts.scope`, else the stereotype's, else `BindingScopes.SINGLETON`, so every component shares one instance. `allowOverride: false` throws instead of replacing an existing binding.

The older `injectable(scope, value, tags?)` was removed in 0.4.8; `IArdorApplication` is picked from the class, so the interface cannot drift from it. See [binding key namespaces](/conventions/binding-key-namespaces.md).

## How ArdorApplication (React) consumes the container

The `ArdorApplication` React component, from the admin package, is handed a fully-started application's container as a prop. It does not call `start()`, `bindContext()`, or any lifecycle method itself - by the time React sees the container, `preConfigure()` and `postConfigure()` have already completed.

Inside `ArdorApplication`, `ApplicationProviders.resolve` (`packages/admin/src/components/resolve.ts`) resolves three bindings by key from the container:

- `CoreBindings.DEFAULT_REST_DATA_PROVIDER` for the data provider
- `CoreBindings.DEFAULT_AUTH_PROVIDER` for the auth provider - only when `CoreBindings.AUTH_PROVIDER_OPTIONS` is `{ use: true }`. Unbound or `{ use: false }`, `authProvider` is left out (though `BaseArdorApplication` bound one) and react-admin runs with no sign-in; `isAuthRequired: true` then throws
- `CoreBindings.DEFAULT_I18N_PROVIDER` for the i18n provider

The remaining props are spread after these three resolved values, so an explicit `dataProvider`, `authProvider` or `i18nProvider` prop overrides the bound one. The result is fed to react-admin's `CoreAdmin`.

The tree it mounts, outermost first:

- `ApplicationContext.Provider`, whose value (`IApplicationContextValue`) carries the container and an IGNIS `ILogger`: the `logger` prop of `ArdorApplication`, else a console logger named after the application (built once per name, not per render) - see [debugging](/process/debugging.md). Hooks throughout the tree call `container.get(...)` through it for anything else the application bound.
- A react-redux `Provider` over `reduxStore`, mounted only when the prop is passed.
- `React.Suspense` with `suspense` as its fallback.
- `CoreAdmin` with `adminProps`.

See [hooks and context](/architecture/hooks-and-context.md) for how components reach back into the container, and [the public surface](/reference/public-surface.md) for the providers and hooks each package exports.

Because `ArdorApplication` resolves these bindings unconditionally, an application must bind all three default provider keys before `start()` finishes, or the React tree fails to mount - even when it passes its own provider props, since the three `container.get(...)` calls still run.
