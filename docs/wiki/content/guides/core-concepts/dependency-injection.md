---
title: Dependency Injection
description: How IGNIS dependency injection works in the browser - stereotyped classes, build-time discovery, constructor injection, and hooks that resolve a class.
---

# Dependency Injection

ARDOR applications use IGNIS inversion of control in the browser. You decorate a class with a stereotype, the application binds it, and a component resolves it by the class itself. The container keeps services, repositories and datasources as singletons across the tab session.

```tsx
import { Ardor, BaseService, service } from '@venizia/ardor';

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
  const priceService = Ardor.useService({ target: PriceCalculationService });
  const total = priceService.calculate({ amount: props.amount });

  return <span>Total: {total}</span>;
}
```

`@service()` decorates the class and the build finds it (see [Build discovery](#build-discovery-autoartifacts-and-vite)); `Ardor.useService({ target })` resolves it and infers its type. `Ardor.useService` is the same function as `useService`: the `Ardor` namespace of `@venizia/ardor` gathers every hook under one name, and this page uses it for hooks.

## The container is the application

`AbstractArdorApplication` in `packages/kernel/src/base/applications/abstract.ts` extends `Container` from `@venizia/ignis-inversion` directly, and `BaseArdorApplication` (`packages/admin/src/applications/base.ts`) extends it. The application instance is the container.

`preConfigure()` binds `CoreBindings.APPLICATION_INSTANCE` and `CoreBindings.APPLICATION_INFO`, then the base application binds the default providers, then stereotype discovery in `registerArtifacts()` binds your classes, `registerFeatures()` binds `CoreBindings.FEATURES`, and last come `bindingList()` and `bindContext()`. The order is "least explicit first, so the most explicit wins" (see [Configuration](./configuration#the-bind-order)).

## Stereotype decorators and derived keys

ARDOR exports class stereotypes from `@venizia/ardor` (re-exported from `packages/kernel/src/base/metadata/index.ts`). Each derives a conventional binding key `<namespace>.<ClassName>` and records it on the class in `MetadataRegistry`:

| Stereotype decorator | Namespace | Default derived key |
| --- | --- | --- |
| `@service()` | `services` | `services.<ClassName>` |
| `@repository()` | `repositories` | `repositories.<ClassName>` |
| `@datasource()` | `datasources` | `datasources.<ClassName>` |
| `@component()` | `components` | `components.<ClassName>` |
| `@configuration()` | `configurations` | `configurations.<ClassName>` (see [Configuration](./configuration)) |

You never write that key. A hook or `@inject` that receives `{ target: ClassName }` reads the recorded key from the class, so a rename or a minifier that changes the class name cannot break the lookup.

### Leave a class out with `when`

A stereotype takes `when`, a function that answers `true` or `false` when the application starts. A class whose `when` returns `false` is not bound, and neither are its `@provide` methods, so a development mock does not reach production:

```ts
import { service } from '@venizia/ardor';

const useMocks = false;

@service({ when: () => useMocks })
export class MockMailService {
  send(): void {}
}
```

`when` receives `{ application }`, runs once, and must answer at once: a promise or a `when` that throws stops `start()` with an error that names the class. `order` and `after` are not read. To bind a class whatever its `when` says, call `this.service(MockMailService)` in `bindContext()`.

## Build discovery: AutoArtifacts and Vite

In the browser, ARDOR finds decorated classes at build time: a Vite plugin scans `src/`, builds the list of classes with a stereotype, and keeps their names from being renamed; `src/application.ts` returns `AutoArtifacts` from `artifacts()`, and `start()` binds every class it finds, in the scope its stereotype declares (a singleton when it declares none). The full guide, with the setup, what is discovered and skipped, kits and features, and every `[artifacts]` error, is [Auto boot](./auto-boot).

> [!WARNING]
> Keep `src/application.ts` free of decorated classes. The module that imports `AutoArtifacts` must never declare decorated classes or be imported by modules that declare decorated classes, which creates an import cycle at startup.

To register a class without build discovery, give it no stereotype and register it by hand in `bindContext()`:

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

export class PricingService {
  getPrice(): number {
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

`this.service(Target)`, `this.repository(Target)`, `this.dataSource(Target)` and `this.component(Target)` bind the class under the key of the `binding` option, else the one its stereotype declares, else `<namespace>.<Target.name>`. The scope is the `scope` option, else the one the class declares, else a singleton. They record the key on the class, so `Ardor.useService({ target: PricingService })` resolves it like a decorated class.

## Resolving dependencies from React components

React components resolve dependencies through typed hooks exported from `@venizia/ardor`. Resolve a class by the class:

| I want to resolve | Hook to use | Options | What it checks |
| --- | --- | --- | --- |
| A repository | `Ardor.useRepository` | `{ target: TClass<T> }` | Throws when the class is bound under another namespace. |
| A service | `Ardor.useService` | `{ target: TClass<T> }` | Throws when the class is bound under another namespace. |
| A configuration | `Ardor.useConfiguration` | `{ target: TClass<T> }` | Throws when the class is bound under another namespace. |
| A component | `Ardor.useComponent` | `{ target: TClass<T> }` | Throws when the class is bound under another namespace. |
| A provider class | `Ardor.useProvider` | `{ target: TClass<T> }` | Throws when the class is bound under another namespace. |
| A framework provider | `Ardor.useProvider` | `{ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }` | The key is typed: no generic, no augmentation. |
| A binding with no class | `Ardor.useInjectable` | `{ key }` | The key must be made by `BindingKeys.build<T>`; the hook returns `T`. |
| Any class, in any namespace | `Ardor.useInjectable` | `{ target: TClass<T> }` | Infers the instance type of the class. |
| The active DI container | `Ardor.useApplicationContainer` | `{ container?: Container }` (optional) | Returns `opts.container` else the context container and throws when neither exists. |
| The application container | `Ardor.useApplicationContext` | None | Returns the container and throws outside the application context. |
| The application logger | `Ardor.useApplicationLogger` | None | Returns the application logger and throws outside the application context. |

With `{ target }`, TypeScript infers the return type from the class constructor, so no cast and no generic are needed. Every hook, `useInjectable` included, throws when another class of the same name holds the key, and names the key and the class. A hook resolves on every render (see [Scopes](#scopes-singleton-by-default-in-the-browser)).

The five namespace hooks also accept a `{ key }`, but a class never needs one. A key is for a binding that has no class: a value you bind by hand, or a `CoreBindings` provider. Keep such keys as `static readonly` members of a constants class, and make each with `BindingKeys.build<T>` so `useInjectable` returns its type with no generic and no augmentation:

```tsx
import { Ardor, BaseArdorApplication, BindingKeys, type IApplicationInfo } from '@venizia/ardor';

export class ClockKeys {
  static readonly NOW = BindingKeys.build<() => number>({ key: '@app/clock/now' });
}

export class ClockApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'clock', version: '1.0.0', description: 'A clock' };
  }

  bindContext(): void {
    this.bind({ key: ClockKeys.NOW }).toValue(() => Date.now());
  }
}

export function Clock() {
  const now = Ardor.useInjectable({ key: ClockKeys.NOW });

  return <time>{now()}</time>;
}
```

## Injecting dependencies into a class

Classes instantiated by the container declare dependencies in constructor parameters using `@inject({ target })`.

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
    @inject({ target: AuditLogService })
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

When `OrderProcessingService` is resolved, the container reads the key recorded on `AuditLogService`, resolves it first, and passes the instance into the constructor. A class that has no recorded key fails here with a message that says to register it.

## Scopes: singleton by default in the browser

In ARDOR, all registrations default to `BindingScopes.SINGLETON`, so every component and every class that injects the same dependency shares one instance (`packages/kernel/src/base/applications/abstract.ts`). To opt out, pass `{ scope: BindingScopes.TRANSIENT }` (from `@venizia/ignis-inversion`) when registering with `@service({ scope: BindingScopes.TRANSIENT })` or `this.service(Target, { scope: BindingScopes.TRANSIENT })` if an instance must hold mutable, caller-specific state.

A hook resolves on every render, as the container does for every `get`. A `TRANSIENT` binding therefore gives a new instance on each render, so state kept on it is lost: keep an instance that holds state in a `SINGLETON` binding (the default), or hold it yourself in `useState`.

## Common startup errors and how to fix them

The `[artifacts]` errors at startup (a group with no content, an import cycle in the index, a class that was never discovered) and the errors of the scan are listed with their cause and fix in [Auto boot](./auto-boot#when-it-does-not-work).

## Related

- [Auto boot](./auto-boot) - How classes are found at build time and bound at start
- [Application](./application) - Application container lifecycle and startup
- [Configuration](./configuration) - Configuring options with `@configuration` and `@provide`
- [Quickstart](../get-started/5-minute-quickstart) - End-to-end working example
- [Hooks](../../references/hooks) - Complete reference for React hooks
