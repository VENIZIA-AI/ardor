---
type: Concept
title: DI in the browser
description: How ARDOR applications use the IGNIS inversion Container to bind and resolve values, classes, and providers, in a normal browser runtime with no server-side container.
resource: packages/kernel/src/base/applications/abstract.ts
tags: [architecture, dependency-injection, ignis, container, kernel]
---

# DI in the browser

ARDOR has no server, no controllers, no request scope. Dependency injection still matters because an ARDOR app wires together providers, services, auth, i18n and data access, and needs one place to hold and hand out those instances while the app runs in a tab. That place is the IGNIS inversion `Container`.

## The application is the container

`AbstractArdorApplication` (`packages/kernel/src/base/applications/abstract.ts`) extends `Container` directly. There is no separate DI object you construct and pass around - the application instance you write for your project *is* the container. Calling `this.bind(...)` inside your application class registers a binding in the same container that later resolves it.

The lifecycle is `preConfigure()` then `postConfigure()`, both run from `start()`. `preConfigure()` binds `APPLICATION_INSTANCE` (the app itself) and `APPLICATION_INFO` (the result of `getAppInfo()`), registers stereotyped classes and `bindingList()` entries, then calls your abstract `bindContext()`, where you register everything else - options, providers, services. A later bind on the same key replaces an earlier one, so `bindContext()` wins. See [Application lifecycle](/architecture/application-lifecycle.md) for the full sequence.

## Three ways to bind

The IGNIS `bind({ key })` call returns a builder with three terminal methods:

- `.toValue(x)` - binds a plain value or already-constructed object. Used for options objects and for the application instance itself.
- `.toClass(SomeClass)` - binds a class; the container constructs an instance when the key is resolved.
- `.toProvider(SomeProvider)` - binds an IGNIS provider. A provider is a class extending `BaseProvider<T>` (`packages/kernel/src/base/providers/base.ts`) with a `value(container: Container): T` method that computes the bound value, typically by pulling other bindings out of the container it receives. A plain `(container) => value` function is accepted too.

A binding is TRANSIENT unless told otherwise. A bare `bind()` re-runs its resolver on every `get()`: `toClass` constructs a new instance, and `toProvider` instantiates the provider and calls `value()` again. Only `.setScope(BindingScopes.SINGLETON)` caches the first result. The registration paths ARDOR owns (`injectable()`, `bindingList()`, stereotypes) set that scope for you; a provider you bind by hand in `bindContext()` gets it only if you add it.

## Constructor injection with `@inject`

A class the container constructs declares its dependencies as constructor parameters decorated with `@inject({ key })` or `@inject({ target: SomeClass })`, imported from `@venizia/ardor`, which re-exports IGNIS's. The container reads only that `@inject` metadata, never the parameter types, so it cannot supply an undecorated parameter - every constructor parameter of a container-instantiated class must carry `@inject`. `{ target }` resolves through the key recorded on the class, so it needs a stereotyped class (see below). `reflect-metadata` has to be installed (it is a peer dependency of `@venizia/ardor`). `@venizia/ignis-inversion` imports it from its own entry, so the decorators work without an app-level import. Importing it first in the entry point, as the examples do, is harmless.

## Singleton through `injectable()`

`AbstractArdorApplication.injectable(scope, value, tags?)` binds a class under the key `${scope}.${ClassName}` with `BindingScopes.SINGLETON` set explicitly. This means: one instance per application for anything bound through `injectable()`, matching the way every consumer already expected services to behave before this default was codified. `service(value)` is just `injectable('services', value)`, so anything registered through `application.service(SomeService)` lives at `services.SomeService` and is a singleton. See [Binding key namespaces](/conventions/binding-key-namespaces.md) for the naming scheme this implies.

## Resolving from React: `useInjectable`

Inside components, `useInjectable` (`packages/react/src/hooks/use-injectable.ts`) is the bridge from the IGNIS container to React. It reads the container off `ApplicationContext` (or accepts an explicit `container` override) and resolves in one of two ways:

- **By key**: `useInjectable({ key: CoreBindings.SOME_KEY })` calls `container.get({ key })` directly. The `key` type is a union built from every string value of `CoreBindings`, extendable by augmenting `IUseInjectableKeysOverrides`.
- **By class**: `useInjectable({ target: SomeClass })` does not guess a key from the class name. It asks `container.getMetadataRegistry().getBindingKey({ target })` to look up the key a stereotype (`@service()`, `@component()` and the rest) recorded on that class, then resolves that key. Only a stereotyped class resolves by `target`. A class registered with `application.service(X)`, `injectable(scope, X)` or `bindingList()` is bound under a string key but records no key on the class, so `useInjectable({ target: X })` throws - resolve it by `{ key }` instead. The error's hint to "register it on the application" does not apply to ARDOR's imperative registration.

The options type is a discriminated union - you pass either `key` or `target`, never both, and `useInjectable` throws if it can determine neither a container nor a resolvable key/target.

## Registration by stereotype

A class marked with a stereotype - `@service()` and the rest, re-exported by ARDOR from
`@venizia/ignis-kernel/metadata` - registers itself. The decorator writes the binding key onto the
class through `reflect-metadata` and appends the class to a module-level discovery list;
`AbstractArdorApplication.registerArtifacts()` reads that list during `preConfigure()` and binds each
entry as a singleton under the key it already carries.

There is no filesystem scan. Discovery happens at import time, which is why a browser bundle works
unchanged: a class exists at run time only because something imported it, and that import is what
registers it.

The list is global rather than per application. Two applications in one process bind the same
classes - what a test suite wants, and what a page never encounters.

`registerArtifacts()` is not IGNIS's boot sequence. From a stereotype's options it honours only the
binding key - the default `<namespace>.<ClassName>`, or an explicit `binding: { namespace, key }`.
`scope`, `when`, `order`, `after` and `allowOverride` are silently ignored, and a `@provide({ key })`
method is never bound, even though `provide` is re-exported. For a non-singleton, a conditional
binding or a provider, bind it by hand in `bindContext()`.

The list is read once, during `preConfigure()`. A class whose module is first imported after
`start()` - in a lazy route chunk, for example - is never bound. Import it before `start()`, or bind
it by hand.

## Why this matters

Because the application itself is the container, there is exactly one DI graph per running app instance, no nested child containers or per-request scoping to reason about. That keeps the mental model close to what a browser app actually is: one page, one container, singletons that live as long as the tab does. For where providers fit in the bigger picture, see [Data provider pipeline](/architecture/data-provider-pipeline.md), and for the full binding key catalogue see [Binding keys](/reference/binding-keys.md).
