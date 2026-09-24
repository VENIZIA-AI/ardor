---
title: Binding keys and registration
description: The two ways to register a class, as in IGNIS - discovery by stereotype and registration by hand - how keys are built, the singleton default, and injecting the data provider.
---

# Binding keys and registration

ARDOR's application is an IGNIS `Container`. Every service, repository, provider and option lives under a string key. This page covers the two ways to register a class, how their keys are built, and how a class reaches the data provider without hard-coding a key.

## Prerequisites

An application class that extends `BaseArdorApplication` (see [Application](../references/application)) and a data provider bound at `CoreBindings.DEFAULT_REST_DATA_PROVIDER` (see [Data provider](../references/data-provider)).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `service`, `repository`, `dataSource`, `component` | application methods | Register one class by hand under `<namespace>.<ClassName>` |
| `@service()`, `@component()`, `@datasource()`, `@repository()` | decorators | Stereotypes the application discovers and binds at `start()` |
| `RepositoryTypes` | class | `REMOTE` declares a repository with no model, such as an `HttpRepository` |
| `bindingList()` | application method | Classes under literal keys, before `bindContext()` |
| `Container.bind({ key })` | method (inherited from IGNIS) | Manual registration, any key, any scope |
| `CoreBindings` | class | The framework's own keys - use these, never the raw strings |
| `LocalStorageKeys` | class | Keys for auth state in local storage |
| `HttpRepository` | class | One repository per REST resource, from `@venizia/ardor/repository` |
| `api()` | function | Method decorator that logs and rethrows failures with the method name |

## Two ways to register

The same two IGNIS offers: let the application discover decorated classes, or register them by hand. Mix them freely.

| | Discovery | By hand |
| --- | --- | --- |
| How | Decorate the class: `@service()`, `@component()`, `@datasource()`, `@repository(...)` | In `bindContext()`: `this.service(X)`, `this.repository(X)`, `this.dataSource(X)`, `this.component(X)` |
| When | `start()` binds every stereotyped class that has been imported | When you call it |
| Key | Recorded by the stereotype: `<namespace>.<ClassName>` | `opts.binding`, else the class's stereotype, else `<namespace>.<ClassName>` |
| Scope | The stereotype's `scope`, else singleton | `opts.scope`, else the stereotype's, else singleton |
| Resolve | `@inject({ target })`, `useService({ target })`, `useRepository({ target })` | Same |

Both record the key on the class, so nothing resolves a class by a typed string: a production build renames classes, and the key goes with the class, not with its name.

```ts
import { BaseArdorApplication, component, type IApplicationInfo } from '@venizia/ardor';

// Discovery: bound at start(), because this module was imported.
@component()
export class AuditComponent {}

// By hand: bound when bindContext() calls it.
export class PricingService {}

export class App extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.service(PricingService);
  }
}
```

Registration runs least explicit first, so the most explicit wins a shared key: stereotypes, then `bindingList()`, then `bindContext()`. `allowOverride: false` on a by-hand call refuses to replace an existing binding instead.

An `HttpRepository` has no model, so it is declared `@repository({ type: RepositoryTypes.REMOTE, dataSource })`, and `@repository` injects the datasource into the first constructor parameter. The two ways mix: `@inject({ target })` on a datasource registered by hand works there too. See [Repositories](../references/repository#registering-a-repository).

## By-hand methods vs `bind().toClass()`

The by-hand methods take `{ binding, scope, allowOverride }`, so a custom key or a non-singleton scope does not need `bind()`. Use `bind({ key }).toClass(value)` for a framework slot: the key is fixed by `CoreBindings`, and this is how a custom data provider, auth provider or auth service is installed. `bind()` records nothing on the class, so resolve those by key.

```ts no-check
import { BaseArdorApplication, CoreBindings } from '@venizia/ardor';

export class App extends BaseArdorApplication {
  bindContext() {
    // Framework slot: the key is fixed by CoreBindings, so service() cannot be used.
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toClass(MyRestDataProvider);

    // Ordinary classes: the by-hand method derives and records the key.
    this.service(PricingService);
    // ...
  }
}
```

`bind().toClass()` returns a binding with `setScope` and `setTags`. Nothing is set for you on that path.

## Singleton by default, and when to opt out

Every way of registering defaults to `BindingScopes.SINGLETON`, one instance per application. IGNIS's server defaults services and repositories to transient; a browser cannot, because a React hook resolves on every render and a transient repository would hand each render a new instance.

A singleton is the right choice for a service that wraps a REST resource. It holds no per-request state and it is cheap to share.

Opt out only when an instance must not be shared - for example a class that keeps mutable state for one caller:

```ts no-check
import { BindingScopes } from '@venizia/ignis-inversion';

this.service(DraftBuffer, { scope: BindingScopes.TRANSIENT });
// ...
```

Do not opt out by habit. A transient service that holds a socket connection or a warmed cache creates one per resolve.

## Injecting the data provider into a service

A service should not construct a data provider. It should ask the container for the one bound at `CoreBindings.DEFAULT_REST_DATA_PROVIDER`. That is the same instance react-admin receives, so a service and the admin UI share one transport, one auth header and one base URL.

The `inject` decorator comes from IGNIS's inversion package, not from `@venizia/ardor`. The `IDataProvider` type does come from `@venizia/ardor`:

```ts no-check
import { inject } from '@venizia/ignis-inversion';
import { BaseService, CoreBindings, type IDataProvider } from '@venizia/ardor';

export class PricingService extends BaseService {
  @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  private dataProvider: IDataProvider;

  constructor() {
    super({ scope: PricingService.name });
  }
  // ...
}
```

Note the two calling conventions. ARDOR's own APIs take options objects: `bind({ key })`, `inject({ key })`, `super({ scope })`. The `IDataProvider` you get back is react-admin's contract, so its methods are positional on purpose: `dataProvider.getOne(resource, params)`.

## One repository per resource

A class about one REST resource is a repository: extend `HttpRepository` from `@venizia/ardor/repository` and name it `<Resource>Repository`. Bind it in `bindingList()` under `repositories.<Name>` and resolve it with `useRepository`. The [repository reference](../references/repository) has the datasource settings and the wiring.

`@api()` works on any `BaseService` method. On failure it logs `[methodName] resource: <resource> | error: <error>` through the service's logger, where `<resource>` is the class's `resource` field or `-`, then rethrows. The return value is untouched.

```ts
import { api, BaseService } from '@venizia/ardor';

export class PricingService extends BaseService {
  constructor() {
    super({ scope: PricingService.name });
  }

  @api()
  async describe(opts: { id: string }): Promise<string> {
    return `price/${opts.id}`;
  }
}
```

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

Keys that `CoreBindings` does not define - your own classes - come from a stereotype or a by-hand method, and you resolve those by class. Only reach for a literal string when you deliberately chose `bind().toClass()` with a custom key, and keep that literal in one place.

## Common pitfalls

- **Registering a framework slot with `service()`.** `this.service(MyRestDataProvider)` binds `services.MyRestDataProvider`. Nothing reads that key. Framework slots must be bound with `bind({ key: CoreBindings.X }).toClass(...)`.
- **Resolving before `start()`.** `preConfigure()` binds `APPLICATION_INSTANCE` and `APPLICATION_INFO`, then calls `bindContext()`. Until `start()` has run, none of these keys exist.
- **Assuming `bind().toClass()` is a singleton.** Stereotypes, the by-hand methods and `bindingList()` default to singleton; `bind()` is transient unless you call `setScope`.
- **Two classes with the same name.** Both derive `<namespace>.<ClassName>`, and the later registration replaces the earlier. Pass `binding` to one, or `allowOverride: false` to make the collision throw.
- **Using `@api()` outside a `BaseService`.** The decorator needs `this.logger`. It will not type-check on another class.
- **Expecting `@api()` to swallow errors.** It logs and rethrows. Callers still need their own handling.
- **Copying a `CoreBindings` string.** Use the constant. The string is not part of the public contract.

## Related

- [Binding keys reference](../references/binding-keys) - the full list of `CoreBindings` and `LocalStorageKeys`
- [Application](../references/application) - `preConfigure`, `bindContext`, `start`
- [Services and repositories](./services) - patterns for `BaseService` and `HttpRepository`
- [Data provider](../references/data-provider) - what is bound at `DEFAULT_REST_DATA_PROVIDER`
- [Hooks](../references/hooks) - `useService`, `useRepository` and `useInjectable` in React
- [Module augmentation](./module-augmentation) - typing your `services.*` keys for `useInjectable`
