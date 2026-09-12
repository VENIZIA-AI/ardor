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

The default `preConfigure()` in `AbstractArdorApplication` does three things, in order:

1. Binds `CoreBindings.APPLICATION_INSTANCE` to `this` - the container can hand itself out as a value.
2. Binds `CoreBindings.APPLICATION_INFO` to whatever `this.getAppInfo()` returns. This is bound as-is, not awaited, so `getAppInfo()` should return a plain object rather than a Promise if downstream consumers expect a resolved value.
3. Returns `this.bindContext()` - an abstract method every concrete application must implement, where provider options, the three default providers, and application services get bound.

Because `bindContext()` can be async and its return value is what `preConfigure()` returns, `start()`'s `await this.preConfigure()` also waits for `bindContext()` to finish. This ordering matters: any subclass overriding `preConfigure()` must call `super.preConfigure()` or the two core bindings and `bindContext()` never happen.

## postConfigure()

A no-op by default. It exists as a hook for work that depends on bindings made in `bindContext()` - for example resolving a service and calling an async initializer on it. Because it runs after `preConfigure()` fully resolves, everything bound in `bindContext()` is safe to `get()` here.

## injectable() and service()

Both are registration helpers on the application, not part of the lifecycle steps themselves, but they are almost always called from inside `bindContext()`.

`injectable(scope, value, tags?)` binds a class under the key `` `${scope}.${value.name}` ``, using `toClass(value)`, and forces `BindingScopes.SINGLETON` - one instance per application, constructed lazily on first `get()`. Optional tags are applied with `setTags(...tags)`.

`service(value)` is shorthand for `injectable('services', value)`. This singleton-by-default behavior is deliberate: before it existed, every service or provider had to be registered by hand, one instance per app, and this default simply codifies that existing pattern rather than introducing new semantics. See [binding key namespaces](/conventions/binding-key-namespaces.md) for how scope prefixes like `services.` are used elsewhere.

## How ArdorApplication (React) consumes the container

The `ArdorApplication` React component, from the admin package, is handed a fully-started application's container as a prop. It does not call `start()`, `bindContext()`, or any lifecycle method itself - by the time React sees the container, `preConfigure()` and `postConfigure()` have already completed.

Inside `ArdorApplication`, a memoized `adminProps` block resolves exactly three bindings by key from the container:

- `CoreBindings.DEFAULT_REST_DATA_PROVIDER` for the data provider
- `CoreBindings.DEFAULT_AUTH_PROVIDER` for the auth provider
- `CoreBindings.DEFAULT_I18N_PROVIDER` for the i18n provider

These three resolved values, together with the rest of the props passed to `ArdorApplication`, become the props fed to react-admin's `CoreAdmin`. The container is also placed on `ApplicationContext` so hooks throughout the tree can call `container.get(...)` for anything else bound during `bindContext()`. See [hooks and context](/architecture/hooks-and-context.md) for how components reach back into the container, and [the providers reference](/reference/providers.md) for what each of the three default providers does.

Because `ArdorApplication` resolves these bindings unconditionally, an application's `bindContext()` must bind all three default provider keys before `start()` finishes, or the React tree fails to mount.
