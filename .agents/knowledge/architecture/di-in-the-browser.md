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

The lifecycle is `preConfigure()` then `postConfigure()`, both run from `start()`. `preConfigure()` binds two keys before anything else: `APPLICATION_INSTANCE` (the app itself) and `APPLICATION_INFO` (the result of `getAppInfo()`), then calls your abstract `bindContext()` where you register everything else - options, providers, services. See [Application lifecycle](/architecture/application-lifecycle.md) for the full sequence.

## Three ways to bind

The IGNIS `bind({ key })` call returns a builder with three terminal methods:

- `.toValue(x)` - binds a plain value or already-constructed object. Used for options objects and for the application instance itself.
- `.toClass(SomeClass)` - binds a class; the container constructs an instance when the key is first resolved.
- `.toProvider(SomeProvider)` - binds an IGNIS provider. A provider is a class extending `BaseProvider<T>` (`packages/kernel/src/base/providers/base.ts`) with a `value(container: Container): T` method that computes the bound value, typically by pulling other bindings out of the container it receives.

Providers construct once: the container calls `value()` a single time per binding and caches the result, it does not re-run the provider logic on every resolve.

## Constructor injection with `@inject`

Classes bound with `toClass` can declare their dependencies as constructor parameters decorated with IGNIS's `@inject(key)`. This relies on `reflect-metadata` being loaded so the container can read parameter types and injected keys at construction time. Without `reflect-metadata` imported once at the app's entry point, `@inject` decorators have nothing to attach metadata to and resolution fails.

## Singleton by default

`AbstractArdorApplication.injectable(scope, value, tags?)` binds a class under the key `${scope}.${ClassName}` with `BindingScopes.SINGLETON` set explicitly. This means: one instance per application for anything bound through `injectable()`, matching the way every consumer already expected services to behave before this default was codified. `service(value)` is just `injectable('services', value)`, so anything registered through `application.service(SomeService)` lives at `services.SomeService` and is a singleton. See [Binding key namespaces](/conventions/binding-key-namespaces.md) for the naming scheme this implies.

## Resolving from React: `useInjectable`

Inside components, `useInjectable` (`packages/react/src/hooks/use-injectable.ts`) is the bridge from the IGNIS container to React. It reads the container off `ApplicationContext` (or accepts an explicit `container` override) and resolves in one of two ways:

- **By key**: `useInjectable({ key: CoreBindings.SOME_KEY })` calls `container.get({ key })` directly. The `key` type is a union built from every string value of `CoreBindings`, extendable by augmenting `IUseInjectableKeysOverrides`.
- **By class**: `useInjectable({ target: SomeClass })` does not guess a key from the class name. It asks `container.getMetadataRegistry().getBindingKey({ target })` to look up the key that decorators like `@service` or `@component` recorded for that class, then resolves that key. If the class was never decorated or registered, this throws, telling you to decorate it or register it on the application first.

The options type is a discriminated union - you pass either `key` or `target`, never both, and `useInjectable` throws if it can determine neither a container nor a resolvable key/target.

## Why this matters

Because the application itself is the container, there is exactly one DI graph per running app instance, no nested child containers or per-request scoping to reason about. That keeps the mental model close to what a browser app actually is: one page, one container, singletons that live as long as the tab does. For where providers fit in the bigger picture, see [Data provider pipeline](/architecture/data-provider-pipeline.md), and for the full binding key catalogue see [Binding keys](/reference/binding-keys.md).
