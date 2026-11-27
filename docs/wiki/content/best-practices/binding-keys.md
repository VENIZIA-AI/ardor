---
title: Binding keys and registration
description: The two ways to register a class, as in IGNIS - discovery by stereotype and registration by hand - how keys are built, the singleton default, and injecting the data provider.
---

# Binding keys and registration

ARDOR's application is an IGNIS `Container`. Every service, repository, provider and option lives under a string key. This page covers the two ways to register a class, how their keys are built, and how a class reaches the data provider without hard-coding a key.

A class has no key of yours: you resolve it by the class (`Ardor.useService({ target: X })`, `@inject({ target: X })`), and the key stays an implementation detail. Only a value with no class, such as a `CoreBindings` option, has a key you write.

## Prerequisites

An application class that extends `BaseArdorApplication` (see [Application](../references/application)). It binds a data provider at `CoreBindings.DEFAULT_REST_DATA_PROVIDER` for you (see [Data provider](../references/data-provider)).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `service`, `repository`, `dataSource`, `component` | application methods | Register one class by hand under `<namespace>.<ClassName>` |
| `@service()`, `@component()`, `@datasource()`, `@repository()` | decorators | Stereotypes the application discovers and binds at `start()` |
| `@configuration()`, `@provide()`, `@provide()` | decorators | A class that binds the keys of values with no class |
| `RepositoryTypes` | class | `REMOTE` declares a repository with no model, such as an `HttpRepository` |
| `bindingList()` | application method | Classes under literal keys, before `bindContext()` |
| `Container.bind({ key })` | method (inherited from IGNIS) | Manual registration, any key, any scope |
| `CoreBindings` | class | The framework's own keys - use these, never the raw strings |
| `LocalStorageKeys` | class | Keys for auth state in local storage |
| `HttpRepository` | class | One repository per REST resource, from `@venizia/ardor/repository` |
| `api()` | function | Method decorator that logs and rethrows failures with the method name |

## Two ways to register

The same two IGNIS offers: let the application discover decorated classes, or register them by hand. Mix them freely.

| Aspect | Discovery | By hand |
| --- | --- | --- |
| How | Decorate the class: `@service()`, `@component()`, `@datasource()`, `@repository(...)` | In `bindContext()`: `this.service(X)`, `this.repository(X)`, `this.dataSource(X)`, `this.component(X)` |
| When | `start()` binds every stereotyped class that has been imported | When you call it |
| Key | Recorded by the stereotype: `<namespace>.<ClassName>` | `opts.binding`, else the class's stereotype, else `<namespace>.<ClassName>` |
| Scope | The stereotype's `scope`, else singleton | `opts.scope`, else the stereotype's, else singleton |
| Resolve | `@inject({ target })`, `Ardor.useService({ target })`, `Ardor.useRepository({ target })` | Same |

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

Registration runs least explicit first, so the most explicit wins a shared key: the defaults of `BaseArdorApplication`, then stereotypes, then features, then `bindingList()`, then `bindContext()`. A lower step never replaces a class declared `allowOverride: false` (by a stereotype or by a by-hand call); `bindingList()` throws for it, and only `bindContext()` replaces it. Two classes that pin one key with `binding` throw at `start()` instead of letting the later import win.

An `HttpRepository` has no model, so it is declared `@repository({ type: RepositoryTypes.REMOTE, dataSource })`, and `@repository` injects the datasource into the first constructor parameter. The two ways mix: `@inject({ target })` on a datasource registered by hand works there too. See [Repositories](../references/repository).

## Framework slots: bind the options, keep the defaults

`BaseArdorApplication` binds the four default providers itself, each a singleton, so react-admin, the auth provider and every hook share one instance: `DefaultRestDataProvider`, `DefaultAuthService`, `DefaultAuthProvider` and `DefaultI18nProvider`. Your application binds their options, in a `@configuration()` class with one `@provide({ key })` method per key. The compiler checks each method against the options type of its key.

```ts
import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  type IApplicationInfo,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
} from '@venizia/ardor';

@configuration()
export class ApiConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: '/api', noAuth: { paths: ['/auth/sign-in'] } };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: true };
  }
}

export class App extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {}
}
```

`start()` discovers `ApiConfiguration` through its stereotype and binds each provided key as lazy and singleton. `{ use: true }` turns sign-in on; `{ use: false }`, or no binding, is a guest application.

To replace a default, bind your provider class under its key in `bindContext()`, which runs last:

```ts
import { BindingScopes } from '@venizia/ignis-inversion';

import {
  BaseArdorApplication,
  CoreBindings,
  DefaultRestDataProvider,
  type IApplicationInfo,
} from '@venizia/ardor';

// A provider of the app's own: its overrides of the default one go here.
class ShopDataProvider extends DefaultRestDataProvider {}

export class App extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      .toProvider(ShopDataProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}
```

A bare `bind({ key })` is transient unless you add `.setScope(BindingScopes.SINGLETON)`, and it records nothing on a class, so the key is the only handle. Reserve it for replacing a default.

Ordinary classes need none of this: a stereotype, or the by-hand method `service()`, derives and records the key.

```ts no-check
// In bindContext() - ordinary classes, not framework slots.
...
this.service(PricingService); // services.PricingService
```

## Singleton by default, and when to opt out

Every way of registering defaults to `BindingScopes.SINGLETON`, one instance per application. IGNIS's server defaults services and repositories to transient; a browser does not, because every component would then get its own repository or service. A hook resolves on every render, so a transient binding gives a new instance each time: keep an instance that holds state in a singleton binding.

A singleton is the right choice for a service that wraps a REST resource. It holds no per-request state and it is cheap to share.

Opt out only when an instance must not be shared - for example a class that keeps mutable state for one caller:

```ts
import { BindingScopes } from '@venizia/ignis-inversion';

import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

export class DraftBuffer {
  readonly lines: Array<string> = [];
}

export class App extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.service(DraftBuffer, { scope: BindingScopes.TRANSIENT });
  }
}
```

Do not opt out by habit. A transient service that holds a socket connection or a warmed cache creates one per resolve.

## Injecting the data provider into a service

A service should not construct a data provider. It should ask the container for the one bound at `CoreBindings.DEFAULT_REST_DATA_PROVIDER`. That is the same instance react-admin receives, so a service and the admin UI share one transport, one auth header and one base URL. This key has no class, so the key form of `@inject` is the right one here.

Both `inject` and the `IDataProvider` type come from `@venizia/ardor`:

```ts
import { BaseService, CoreBindings, inject, type IDataProvider, service } from '@venizia/ardor';

interface IProduct {
  id: number;
  price: number;
}

@service()
export class PricingService extends BaseService {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    private readonly dataProvider: IDataProvider,
  ) {
    super({ scope: PricingService.name });
  }

  async getPrice(opts: { id: number }): Promise<number> {
    const { data } = await this.dataProvider.getOne<IProduct>('products', { id: opts.id });

    return data.price;
  }
}
```

Note the two calling conventions. ARDOR's own APIs take options objects: `bind({ key })`, `inject({ key })`, `super({ scope })`. The `IDataProvider` you get back is react-admin's contract, so its methods are positional on purpose: `dataProvider.getOne(resource, params)`.

## One repository per resource

A class about one REST resource is a repository: extend `HttpRepository` from `@venizia/ardor/repository` and name it `<Resource>Repository`. Declare it `@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })` (or register it by hand with `this.repository(X)`) and resolve it with `Ardor.useRepository({ target })`. The [repository reference](../references/repository) has the datasource settings and the wiring.

`@api()` works on any `BaseService` method. On failure it logs `[methodName] resource: <resource> | error: <error>` through the service's logger, where `<resource>` is the class's `resource` field or `-`, then rethrows. The return value is untouched.

```ts
import { api, BaseService, service } from '@venizia/ardor';

@service()
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

  static readonly FEATURES = '@app/application/features';
  static readonly PERMISSION_PROVIDER = '@app/application/permission/provider';
  static readonly PERMISSION_PROVIDER_OPTIONS = '@app/application/options/permission';
}
```

Write `CoreBindings.DEFAULT_REST_DATA_PROVIDER`, never `'@app/application/data/rest/default'`. The string is an implementation detail. The constant is the contract. If the string ever changes, code that uses the constant keeps working and code that copied the string silently binds to a key nothing reads.

The same rule applies to `LocalStorageKeys` when you read or clear auth state in local storage. An application with an `IApplicationInfo.id` keeps its session under scoped keys, so ask the auth service for them: `authService.keys` answers the keys of this application, and `LocalStorageKeys.scoped({ id })` answers them from an `id`. The bare constants (`KEY_AUTH_TOKEN` and the other two) are the keys of an application with no `id`.

```ts
import { CoreBindings, LocalStorageKeys } from '@venizia/ardor';

// Good: the constant is the contract.
const dataProviderKey: string = CoreBindings.DEFAULT_REST_DATA_PROVIDER;
const tokenKey: string = LocalStorageKeys.scoped({ id: 'shop' }).token;
```

Your own classes have no entry in `CoreBindings`: a stereotype or a by-hand method registers them, and you resolve them by class. A class that needs a key of its own takes `binding: { namespace, key }` on its stereotype and is still resolved by `{ target }`. Only a value with no class takes a literal key; keep that literal in a `static readonly` constants class (see [Module augmentation](./module-augmentation)).

## Common pitfalls

- **Registering a framework slot with `service()`.** `this.service(MyRestDataProvider)` binds `services.MyRestDataProvider`. Nothing reads that key. Replace a default by binding your provider class under `CoreBindings.X` in `bindContext()`.
- **Hand-wiring a default provider.** `BaseArdorApplication` already binds `DefaultRestDataProvider`, `DefaultAuthService`, `DefaultAuthProvider` and `DefaultI18nProvider`. Bind their options and nothing else.
- **Resolving before `start()`.** `preConfigure()` binds `APPLICATION_INSTANCE` and `APPLICATION_INFO`, then calls `bindContext()`. Until `start()` has run, none of these keys exist.
- **Assuming `bind().toClass()` is a singleton.** Stereotypes, the by-hand methods and `bindingList()` default to singleton; `bind()` is transient unless you call `setScope`.
- **Two classes with the same name.** Two stereotyped classes deriving one key make `start()` throw. Only registration by hand replaces silently: pass `allowOverride: false` to refuse the replacement.
- **Two classes pinned to one key.** `start()` throws and names both. Give one of them another key, select one with `when`, or bind the intended one in `bindContext()`.
- **Using `@api()` outside a `BaseService`.** The decorator needs `this.logger`. It will not type-check on another class.
- **Expecting `@api()` to swallow errors.** It logs and rethrows. Callers still need their own handling.
- **Copying a `CoreBindings` string.** Use the constant. The string is not part of the public contract.

## Related

- [Binding keys reference](../references/binding-keys) - the full list of `CoreBindings` and `LocalStorageKeys`
- [Application](../references/application) - `preConfigure`, `bindContext`, `start`
- [Services and repositories](./services) - patterns for `BaseService` and `HttpRepository`
- [Data provider](../references/data-provider) - what is bound at `DEFAULT_REST_DATA_PROVIDER`
- [Hooks](../references/hooks) - `useService`, `useRepository` and `useInjectable` in React
- [Module augmentation](./module-augmentation) - typing translation keys and the keys of values bound by hand
