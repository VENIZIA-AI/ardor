---
title: Dependency Injection
description: How IGNIS dependency injection works in the browser - binding decorated classes, build-time artifact discovery, constructor injection, and React hooks.
---

# Dependency Injection

ARDOR applications use IGNIS inversion of control in the browser to bind decorated classes and resolve them inside React components. The container manages services, repositories, and datasources as singletons across the tab session.

```tsx
import React from 'react';
import { BaseService, service, useService } from '@venizia/ardor';

@service()
export class PriceCalculationService extends BaseService {
  constructor() {
    super({ scope: PriceCalculationService.name });
  }

  calculate(opts: { amount: number }): number {
    return opts.amount * 1.1;
  }
}

export function PriceDisplay(props: { amount: number }) {
  const priceService = useService({ target: PriceCalculationService });
  const total = priceService.calculate({ amount: props.amount });

  return <span>Total: {total}</span>;
}
```

## The container is the application

`BaseArdorApplication` in `packages/kernel/src/base/applications/abstract.ts` extends `Container` from `@venizia/ignis-inversion` directly. The application instance is the container.

`preConfigure()` itself binds three keys: `CoreBindings.APPLICATION_INSTANCE`, `CoreBindings.APPLICATION_INFO`, and `CoreBindings.FEATURES`. The bind order inside `preConfigure()` is "least explicit first, so the most explicit wins: stereotype, features, bindingList(), bindContext()". Everything else is bound by the application through `@provide` methods, `bindingList()`, `bindContext()`, or stereotype discovery in `registerArtifacts()` (see [Configuration](./configuration)).

## Stereotype decorators and derived keys

ARDOR exports four class stereotypes from `@venizia/ardor` (re-exported from `packages/kernel/src/base/metadata/index.ts`). Each derives a conventional binding key `<namespace>.<ClassName>` recorded in `MetadataRegistry`:

| Stereotype decorator | Namespace | Default derived key |
| --- | --- | --- |
| `@service()` | `services` | `services.<ClassName>` |
| `@repository()` | `repositories` | `repositories.<ClassName>` |
| `@datasource()` | `datasources` | `datasources.<ClassName>` |
| `@component()` | `components` | `components.<ClassName>` |

When code resolves a dependency by passing `{ target: ClassName }`, ARDOR reads the recorded key directly from metadata.

## Build discovery: AutoArtifacts and Vite

In the browser, ARDOR discovers decorated classes at build time. In `vite.config.ts`, `IgnisArtifactsVitePlugin.create()` scans `src/`, bundles decorated classes into the virtual module `@venizia/ignis-boot/auto`, and pins class names against minification.

In `src/application.ts`, return `AutoArtifacts` from `artifacts()`:

<<< @/../../../examples/5-mins-qs/src/application.ts{ts}

When `application.start()` runs, `registerArtifacts()` binds each discovered class as a singleton.

> [!WARNING]
> Keep `src/application.ts` free of decorated classes. The module that imports `AutoArtifacts` must never declare decorated classes or be imported by modules that declare decorated classes, which creates an import cycle at startup.

To register classes without build discovery, use helper methods in `bindContext()`:

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

export class PricingService {
  getPrice(opts: { id: string }): number {
    return 100;
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.service(PricingService);
  }
}
```

The application helper methods bind under `<namespace>.<Target.name>` as a singleton: `this.service(Target)`, `this.repository(Target)`, `this.dataSource(Target)`, and `this.component(Target)`.

## Resolving dependencies from React components

React components resolve dependencies through typed hooks exported from `@venizia/ardor`:

| I want to resolve | Hook to use | Accepted options | What it checks |
| --- | --- | --- | --- |
| A repository | `useRepository` | `{ target: TClass<T> }` or `{ key: TUseInjectableKeys }` | Throws when the class is bound under another namespace. |
| A service | `useService` | `{ target: TClass<T> }` or `{ key: TUseInjectableKeys }` | Throws when the class is bound under another namespace. |
| A provider | `useProvider` | `{ target: TClass<T> }` or `{ key: TUseInjectableKeys }` | Throws when the class is bound under another namespace. |
| A configuration | `useConfiguration` | `{ target: TClass<T> }` or `{ key: TUseInjectableKeys }` | Throws when the class is bound under another namespace. |
| A component | `useComponent` | `{ target: TClass<T> }` or `{ key: TUseInjectableKeys }` | Throws when the class is bound under another namespace. |
| Any binding or core key | `useInjectable` | `{ target: TClass<AnyType> }` or `{ key: TUseInjectableKeys }` | Resolves any binding across all namespaces or `CoreBindings`. |
| The active DI container | `useInjectableContainer` | `{ container?: Container }` (optional) | Returns `opts.container` else the context container and throws when neither exists. |
| The application container | `useApplicationContext` | None | Returns the container and throws outside the application context. |
| The application logger | `useApplicationLogger` | None | Returns the application logger and throws outside the application context. |

When resolving with `{ target }`, TypeScript infers the return type from the class constructor without manual type casting.

## Injecting dependencies into a class

Classes instantiated by the container declare dependencies in constructor parameters using `@inject({ key })`.

Every constructor parameter of a container-instantiated class must carry `@inject`. The check runs when the container instantiates the class (IGNIS `instantiate()`, which throws `[ClassName] Constructor parameter N has no @inject | Every parameter of a container-instantiated class must be decorated - the container cannot supply an undecorated one`), not during startup. Pass any class options to `super({ scope: ClassName.name })`, never as an undecorated parameter.

This rule has one exception: a `@repository`-decorated class whose first constructor parameter is its datasource needs no `@inject`, because the `@repository` decorator writes that injection metadata programmatically (`registry.setInjectMetadata({ target, index: 0, ... })`).

```ts
import { BaseService, inject, service } from '@venizia/ardor';

@service()
export class AuditLogService extends BaseService {
  constructor() {
    super({ scope: AuditLogService.name });
  }

  record(opts: { action: string; resource: string }): void {
    this.logger.info('[audit] action: %s | resource: %s', opts.action, opts.resource);
  }
}

@service()
export class OrderProcessingService extends BaseService {
  constructor(
    @inject({ key: 'services.AuditLogService' })
    private readonly auditLogService: AuditLogService,
  ) {
    super({ scope: OrderProcessingService.name });
  }

  processOrder(opts: { orderId: string }): void {
    this.auditLogService.record({ action: 'process', resource: opts.orderId });
    this.logger.info('[order] processed order %s', opts.orderId);
  }
}
```

When `OrderProcessingService` is resolved, the container resolves `services.AuditLogService` first and passes the instance into the constructor.

## Scopes: singleton by default in the browser

In ARDOR, all registrations default to `BindingScopes.SINGLETON` because hooks resolve on every render (`packages/kernel/src/base/applications/abstract.ts`). To opt out, pass `{ scope: BindingScopes.TRANSIENT }` (from `@venizia/ignis-inversion`) when registering with `@service({ scope: BindingScopes.TRANSIENT })` or `this.service(Target, { scope: BindingScopes.TRANSIENT })` if an instance must hold mutable, caller-specific state.

## Common startup errors and how to fix them

When configuring dependency injection and build discovery, you may encounter one of three startup errors from `packages/kernel/src/base/applications/abstract.ts`:

**Missing artifact group content or resolver:**
```
[artifacts] A group has neither content nor resolve | Return AutoArtifacts from @venizia/ignis-boot/auto, or build with IgnisArtifactsPlugin so the group arrives with its content
```
Return `[AutoArtifacts]` from `artifacts()` in `src/application.ts` and add `IgnisArtifactsVitePlugin.create()` to `plugins` in `vite.config.ts`.

**Import cycle in application artifacts:**
```
[artifacts] '<kind>' lists an entry that is not a class (position <position>) | Usually an import cycle: the module that imports the index (or @venizia/ignis-boot/auto) must not define decorated classes or be imported by them
```
Isolate each decorated class in its own file under `src/services/`, `src/repositories/`, or `src/datasources/`. Keep `src/application.ts` free of decorated classes, and do not import `application.ts` from any artifact module.

**Class was never discovered:**
```
[artifacts] '<kind>' lists <ClassName>, which was never discovered | Decorate it with its stereotype and regenerate the index
```
Add the stereotype decorator (`@service()`, `@repository()`, `@datasource()`, or `@component()`) to the class. If running `vite dev`, restart the development server so `IgnisArtifactsVitePlugin` detects the decorator.

## Related

- [Application](./application) - Application container lifecycle and startup
- [Configuration](./configuration) - Configuring providers with `@configuration` and `@provide`
- [5-Minute Quickstart](../get-started/5-minute-quickstart) - End-to-end working example
- [Hooks](../../references/hooks) - Complete reference for React hooks
