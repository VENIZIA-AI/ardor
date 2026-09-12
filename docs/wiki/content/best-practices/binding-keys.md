---
title: Binding keys and service registration
description: How service() names bindings, when to use bind().toClass() instead, the singleton default, injecting the data provider into a service, and one BaseApiService per resource.
---

# Binding keys and service registration

ARDOR's application is an IGNIS `Container`. Every service, provider and option lives under a string key. This page covers how those keys are produced, how to register classes, and how a service reaches the data provider without hard-coding a key.

## Prerequisites

An application class that extends `BaseArdorApplication` (see [Application](../references/application)) and a data provider bound at `CoreBindings.DEFAULT_REST_DATA_PROVIDER` (see [Data provider](../references/data-provider)).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `AbstractArdorApplication.service(value)` | method | Registers a class under `services.<ClassName>` as a singleton |
| `AbstractArdorApplication.injectable(scope, value, tags?)` | method | Same as `service`, with a scope you choose |
| `Container.bind({ key })` | method (inherited from IGNIS) | Manual registration, any key, any scope |
| `CoreBindings` | class | The framework's own keys - use these, never the raw strings |
| `LocalStorageKeys` | class | Keys for auth state in local storage |
| `BaseApiService` | class | Base for one service per REST resource |
| `api()` | function | Method decorator that logs and rethrows failures with the resource name |

## The `services.<ClassName>` vocabulary

`service(value)` calls `injectable('services', value)`. `injectable` builds the key from the scope and the class name:

```ts no-check
// packages/kernel/src/base/applications/abstract.ts (excerpt)
export abstract class AbstractArdorApplication extends Container {
  // ...

  injectable<T>(scope: string, value: TClass<T>, tags?: Array<string>) {
    this.bind({ key: `${scope}.${value.name}` })
      .toClass(value)
      .setScope(BindingScopes.SINGLETON)
      .setTags(...(tags ?? []));
  }

  service<T>(value: TClass<T>) {
    this.injectable('services', value);
  }

  // ...
}
```

So `this.service(ProductApiService)` binds the key `services.ProductApiService`. The class name is the key. Two consequences:

- Rename the class and the key changes. Anything that resolved it by string will break.
- Two classes with the same name in different files collide on the same key. Keep service class names unique across the application.

Register services inside `bindContext()`, which `preConfigure()` calls after it has bound `APPLICATION_INSTANCE` and `APPLICATION_INFO`:

```ts no-check
import { BaseArdorApplication } from '@venizia/ardor';

export class App extends BaseArdorApplication {
  bindContext() {
    this.service(ProductApiService);
    this.service(OrderApiService);
    // ...
  }

  getAppInfo() {
    // ...
  }
}
```

`injectable` accepts a different scope when a class is not a service. The key follows the same pattern, `<scope>.<ClassName>`. Tags are optional and are passed straight to `setTags`.

## `service()` vs `bind().toClass()`

`service()` is the short path. It fixes three things for you: the key, the scope (singleton) and the tags (none unless you use `injectable`). Use it for every class where those defaults are right.

Use `bind({ key }).toClass(value)` directly when you need control over any of those three:

- The key must be a framework key from `CoreBindings`, not `services.<ClassName>`. This is how a custom data provider, auth provider or auth service is installed.
- The instance must not be a singleton.
- You want a key that does not depend on the class name.

```ts no-check
import { BaseArdorApplication, CoreBindings } from '@venizia/ardor';

export class App extends BaseArdorApplication {
  bindContext() {
    // Framework slot: the key is fixed by CoreBindings, so service() cannot be used.
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toClass(MyRestDataProvider);

    // Ordinary services: let service() derive the key.
    this.service(ProductApiService);
    // ...
  }
}
```

`bind().toClass()` returns the same binding object that `injectable` uses, so `setScope` and `setTags` are available on it. Nothing is set for you on that path.

## Singleton by default, and when to opt out

`injectable` (and therefore `service`) calls `setScope(BindingScopes.SINGLETON)`. One instance per application. The source comment explains why: this is what every consumer used to bind by hand, so it became the default.

A singleton is the right choice for a service that wraps a REST resource. It holds no per-request state and it is cheap to share.

Opt out only when an instance must not be shared - for example a class that keeps mutable state for one caller. In that case register it with `bind().toClass()` and set the scope you want with `setScope`, using the scope constants from IGNIS's `BindingScopes`. `service()` cannot do this; it always sets singleton.

```ts no-check
import { BindingScopes } from '@venizia/ignis-inversion';

this.bind({ key: 'services.DraftBuffer' })
  .toClass(DraftBuffer)
  .setScope(/* a non-singleton scope from BindingScopes */);
// ...
```

Do not opt out by habit. A transient service that holds an axios instance or a socket connection creates one per resolve.

## Injecting the data provider into a service

A service should not construct a data provider. It should ask the container for the one bound at `CoreBindings.DEFAULT_REST_DATA_PROVIDER`. That is the same instance react-admin receives, so a service and the admin UI share one transport, one auth header and one base URL.

The `inject` decorator comes from IGNIS's inversion package, not from `@venizia/ardor`. The `IDataProvider` type does come from `@venizia/ardor`:

```ts no-check
import { inject } from '@venizia/ignis-inversion';
import { BaseApiService, CoreBindings, type IDataProvider } from '@venizia/ardor';

export class ProductApiService extends BaseApiService {
  @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  private dataProvider: IDataProvider;

  constructor() {
    super({ scope: ProductApiService.name, resource: 'products' });
  }
  // ...
}
```

Note the two calling conventions. ARDOR's own APIs take options objects: `bind({ key })`, `inject({ key })`, `super({ scope, resource })`. The `IDataProvider` you get back is react-admin's contract, so its methods are positional on purpose: `dataProvider.getOne(resource, params)`.

## One `BaseApiService` per resource

`BaseApiService` adds one field on top of `BaseService`: a protected `resource` string, set from the constructor options.

```ts no-check
// packages/kernel/src/base/services/api.ts (excerpt)
export class BaseApiService extends BaseService {
  protected resource: string;

  constructor(opts: { scope: string; resource: string }) {
    super({ scope: opts.scope });
    this.resource = opts.resource;
  }

  // ...
}
```

Give each REST resource its own subclass. `resource` should be the react-admin resource name, so it lines up with what the data provider receives as its first positional argument.

Mark methods that talk to the backend with `@api()`. The decorator awaits the method, and on failure logs `[methodName] resource: <resource> | error: <error>` through the service's logger, then rethrows. The return value is untouched. Callers still see the original error; you only gain a log line that names the method and the resource.

```ts
import { BaseApiService, api } from '@venizia/ardor';

export class ProductApiService extends BaseApiService {
  constructor() {
    super({ scope: ProductApiService.name, resource: 'products' });
  }

  @api()
  async describe(opts: { id: string }): Promise<string> {
    return `${this.resource}/${opts.id}`;
  }
}
```

Register it with `this.service(ProductApiService)` and resolve it as `services.ProductApiService`. In React, `useInjectable` from `@venizia/ardor` resolves it by that key (see [Hooks](../references/hooks)).

`@api()` only applies to a method of a `BaseApiService` subclass. Its `this` type is `BaseApiService`, and it reads `this.logger` and `this.resource`. Putting it on a plain class will not compile.

## Never hard-code a key `CoreBindings` already has

`CoreBindings` is a class of static readonly strings:

```ts no-check
// packages/kernel/src/common/keys.ts
export class CoreBindings {
  static readonly APPLICATION_INSTANCE = '@app/application/instance';
  static readonly APPLICATION_INFO = '@app/application/info';

  static readonly DEFAULT_AUTH_PROVIDER = '@app/application/auth/default';
  static readonly DEFAULT_I18N_PROVIDER = '@app/application/i18n/default';
  static readonly DEFAULT_REST_DATA_PROVIDER = '@app/application/data/rest/default';

  static readonly AUTH_PROVIDER_OPTIONS = '@app/application/options/auth';
  static readonly DEFAULT_AUTH_SERVICE = '@app/application/service/auth/default';

  static readonly REST_DATA_PROVIDER_OPTIONS = '@app/application/options/rest/data';

  static readonly I18N_PROVIDER_OPTIONS = '@app/application/options/i18n';
}
```

Write `CoreBindings.DEFAULT_REST_DATA_PROVIDER`, never `'@app/application/data/rest/default'`. The string is an implementation detail. The constant is the contract. If the string ever changes, code that uses the constant keeps working and code that copied the string silently binds to a key nothing reads.

The same rule applies to `LocalStorageKeys` (`KEY_AUTH_TOKEN`, `KEY_AUTH_IDENTITY`, `KEY_AUTH_PERMISSION`) when you read or clear auth state in local storage.

```ts
import { CoreBindings, LocalStorageKeys } from '@venizia/ardor';

// Good: the constant is the contract.
const dataProviderKey: string = CoreBindings.DEFAULT_REST_DATA_PROVIDER;
const tokenKey: string = LocalStorageKeys.KEY_AUTH_TOKEN;
```

Keys that `CoreBindings` does not define - your own services - come from `service()`. Only reach for a literal string when you deliberately chose `bind().toClass()` with a custom key, and keep that literal in one place.

## Common pitfalls

- **Registering a framework slot with `service()`.** `this.service(MyRestDataProvider)` binds `services.MyRestDataProvider`. Nothing reads that key. Framework slots must be bound with `bind({ key: CoreBindings.X }).toClass(...)`.
- **Resolving before `start()`.** `preConfigure()` binds `APPLICATION_INSTANCE` and `APPLICATION_INFO`, then calls `bindContext()`. Until `start()` has run, none of these keys exist.
- **Assuming `bind().toClass()` is a singleton.** Only `injectable`/`service` add `setScope(BindingScopes.SINGLETON)`. On the manual path you set the scope yourself.
- **Two classes with the same name.** The key is `services.<ClassName>`. The second `service()` call replaces the first binding.
- **Using `@api()` outside `BaseApiService`.** The decorator needs `this.logger` and `this.resource`. It will not type-check on another class.
- **Expecting `@api()` to swallow errors.** It logs and rethrows. Callers still need their own handling.
- **Copying a `CoreBindings` string.** Use the constant. The string is not part of the public contract.

## Related

- [Binding keys reference](../references/binding-keys) - the full list of `CoreBindings` and `LocalStorageKeys`
- [Application](../references/application) - `preConfigure`, `bindContext`, `start`
- [Services](./services) - patterns for `BaseService` and `BaseApiService`
- [Data provider](../references/data-provider) - what is bound at `DEFAULT_REST_DATA_PROVIDER`
- [Hooks](../references/hooks) - `useInjectable` for resolving services in React
- [Module augmentation](./module-augmentation) - typing your `services.*` keys for `useInjectable`
