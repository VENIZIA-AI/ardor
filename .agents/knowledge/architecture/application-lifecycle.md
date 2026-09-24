---
type: Concept
title: Application lifecycle
description: How an ARDOR application boots through start(), preConfigure and postConfigure, and how ArdorApplication resolves providers from the container.
resource: packages/kernel/src/base/applications/abstract.ts
tags: [architecture, application, lifecycle, container, kernel]
---

# Application lifecycle

ARDOR applications are built by subclassing `BaseArdorApplication`, which extends the IGNIS `Container` itself (see [DI in the browser](/architecture/di-in-the-browser.md)). There is no separate app object wrapping a container - the application instance *is* the container. This is why an app can call `this.bind(...)` and `this.get(...)` directly on itself.

## start()

`start()` is the single entry point and it is the only method you call from outside:

```ts
async start() {
  await this.preConfigure();
  await this.postConfigure();
}
```

Both steps are awaited in sequence. `postConfigure()` never runs concurrently with `preConfigure()`, and anything bound during `preConfigure()` is guaranteed to exist by the time `postConfigure()` runs.

## preConfigure()

The default `preConfigure()` in `AbstractArdorApplication` does five things, in order:

1. Binds `CoreBindings.APPLICATION_INSTANCE` to `this` - the container can hand itself out as a value.
2. Binds `CoreBindings.APPLICATION_INFO` to whatever `this.getAppInfo()` returns. This is bound as-is, not awaited, so `getAppInfo()` should return a plain object rather than a Promise if downstream consumers expect a resolved value.
3. Calls `this.registerArtifacts()`, which binds every class a stereotype (`@service()`, `@component()` and the rest) discovered, under the key the stereotype recorded on the class, in the scope it declares (singleton by default). A discovered class with no recorded key is skipped.
4. Binds every entry of `this.bindingList()` - a record of literal key to class, empty by default - with `toClass(...)` as a singleton, recording each key on its class.
5. Returns `this.bindContext()` - an abstract method every concrete application must implement, where provider options, the three default providers, and application artifacts get bound - by `this.bind(...)` or by hand with `this.service(X)`, `this.repository(X)`, `this.dataSource(X)`, `this.component(X)`.

Steps 3 to 5 run from least explicit to most explicit, and a later bind on the same key replaces the earlier one: stereotype, then `bindingList()`, then `bindContext()`. So a `bindingList()` entry overrides a stereotype on the same key, and a manual `this.bind(...)` in `bindContext()` overrides both. See [binding key namespaces](/conventions/binding-key-namespaces.md) for when to reach for each form.

Because `bindContext()` can be async and its return value is what `preConfigure()` returns, `start()`'s `await this.preConfigure()` also waits for `bindContext()` to finish. This ordering matters: any subclass overriding `preConfigure()` must call `super.preConfigure()`, or none of the five steps happen - not the two core bindings, not the stereotype and `bindingList()` registrations, and not `bindContext()`.

## postConfigure()

A no-op by default. It exists as a hook for work that depends on bindings made in `bindContext()` - for example resolving a service and calling an async initializer on it. Because it runs after `preConfigure()` fully resolves, everything bound in `bindContext()` is safe to `get()` here.

## Registration by hand

Registration helpers on the application, not lifecycle steps, called from inside `bindContext()`.

`service(X)`, `repository(X)`, `dataSource(X)` and `component(X)` bind one class under `opts.binding`, else the class's stereotype `binding`, else `<namespace>.<ClassName>`. Each records that key on the class, so `{ target }` resolves it, and returns the `Binding`. The scope is `opts.scope`, else the stereotype's, else `BindingScopes.SINGLETON`: a hook resolves on every render, and a new instance per render would loop an effect keyed on it. `allowOverride: false` throws instead of replacing an existing binding.

`injectable(scope, value, tags?)` is the older form: `` `${scope}.${value.name}` ``, singleton, optional tags, and it records the key too. See [binding key namespaces](/conventions/binding-key-namespaces.md).

## How ArdorApplication (React) consumes the container

The `ArdorApplication` React component, from the admin package, is handed a fully-started application's container as a prop. It does not call `start()`, `bindContext()`, or any lifecycle method itself - by the time React sees the container, `preConfigure()` and `postConfigure()` have already completed.

Inside `ArdorApplication`, a memoized `adminProps` block resolves exactly three bindings by key from the container:

- `CoreBindings.DEFAULT_REST_DATA_PROVIDER` for the data provider
- `CoreBindings.DEFAULT_AUTH_PROVIDER` for the auth provider
- `CoreBindings.DEFAULT_I18N_PROVIDER` for the i18n provider

The remaining props are spread after these three resolved values, so an explicit `dataProvider`, `authProvider` or `i18nProvider` prop overrides the bound one. The result is fed to react-admin's `CoreAdmin`.

The tree it mounts, outermost first:

- `ApplicationContext.Provider`, whose value carries the container (as both `container` and `registry`) and a `Logger` scoped to `ArdorApplication`. `enableDebug` (default `false`) goes to `Logger.getInstance` on every render, and that switch covers the whole process, so leaving it off turns debug logging off for every scope - see [debugging](/process/debugging.md). Hooks throughout the tree call `container.get(...)` through it for anything else the application bound.
- A react-redux `Provider` over `reduxStore` - a Redux store is always required.
- `React.Suspense` with `suspense` as its fallback.
- `CoreAdmin` with `adminProps`.

See [hooks and context](/architecture/hooks-and-context.md) for how components reach back into the container, and [the providers reference](/reference/providers.md) for what each of the three default providers does.

Because `ArdorApplication` resolves these bindings unconditionally, an application must bind all three default provider keys before `start()` finishes, or the React tree fails to mount - even when it passes its own provider props, since the three `container.get(...)` calls still run.
