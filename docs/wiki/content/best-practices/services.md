---
title: Writing services and repositories
description: How to write ARDOR services on BaseService and resource repositories on HttpRepository - options objects, the @api() decorator, error handling, and how components reach them through the container.
---

# Writing services and repositories

A service is a plain class that owns one job and one logger: extend `BaseService`. Reading one backend resource is a repository's job: extend `HttpRepository` from `@venizia/ardor/repository`. This page shows how to write both so they stay small, testable, and free of react-admin types.

## Prerequisites

A running ARDOR application with a container - see the [quickstart](../guides/get-started/quickstart).

## Quick Reference

| Export | Kind | Use it for |
| --- | --- | --- |
| `BaseService` | class | Any service. Takes `{ scope }` and sets `this.logger`. |
| `HttpRepository` | class | Reads one backend resource over an `HttpDataSource`. From `@venizia/ardor/repository`. |
| `api` | function | Method decorator for any `BaseService`. Logs a failure with the method name, then rethrows. |
| `Logger` | class | One instance per scope. `getInstance({ scope })`. |
| `ISendParams` / `ISendResponse` | interface | The kernel's transport contract. Enough for a service - no react-admin types needed. |
| `useService` / `useRepository` | const | How a component resolves a service or a repository from the container. |

## BaseService: scope + logger

`BaseService` does one thing. It takes a `scope` and creates a `Logger` for it. Every line the service writes is prefixed with a timestamp, the level, and that scope.

```ts no-check
class BaseService {
  protected logger: Logger;
  constructor(opts: { scope: string });
}
```

Use the class name as the scope. That way the log line names the class that wrote it.

```ts
import { BaseService } from '@venizia/ardor';

export class ClockService extends BaseService {
  constructor() {
    super({ scope: ClockService.name });
  }

  now(opts: { format: 'iso' | 'ms' }): string | number {
    this.logger.debug('[now] format: %s', opts.format);
    return opts.format === 'iso' ? new Date().toISOString() : Date.now();
  }
}
```

`Logger.getInstance` returns the same instance for the same scope. Two services with the same scope share one logger. Keep scopes unique.

## A resource: HttpRepository

A class about one backend collection, such as `products` or `orders`, is a repository. `HttpRepository` reads it through an `HttpDataSource` with the IGNIS filter vocabulary, and reads totals from the `Content-Range` header.

```ts
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

interface IProduct {
  id: number;
  price: number;
}

export class ProductRepository extends HttpRepository<IProduct> {
  constructor(opts: { dataSource: HttpDataSource }) {
    super({ dataSource: opts.dataSource, resource: 'products' });
  }

  countAbove(opts: { price: number }) {
    return this.count({ where: { price: { gte: opts.price } } });
  }
}
```

See the [repository reference](../references/repository) for the datasource settings and what `count` and `find` refuse to guess.

## Options objects on every method

Every constructor here takes a single options object. Do the same on every public method you add. `getPrice({ id })`, never `getPrice(id)`. Callers can add a field later without breaking every call site, and the argument names show up at the call site.

The one exception is the react-admin facing `IDataProvider` the container returns. Its methods are positional `(resource, params)` because react-admin calls them. That contract belongs to the provider, not to your service.

## @api() for logging failures

`api()` is a method decorator for any `BaseService` subclass. It wraps the method, awaits it, and on failure logs one error line with the method name, the class's `resource` if it has one (`-` otherwise), and the error. Then it rethrows. It does not swallow the error and it does not change the result on success.

```ts no-check
function api(): (
  _target: BaseService,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor;
```

The logged line looks like `[getPrice] resource: products | error: ...`. You get this for free on every method you decorate, so you do not write a `try/catch` just to log.

```ts
import { api, BaseService } from '@venizia/ardor';

export class PricingService extends BaseService {
  protected resource = 'products';

  constructor() {
    super({ scope: PricingService.name });
  }

  @api()
  async getPrice(opts: { id: number }): Promise<number> {
    const response = await fetch(`/${this.resource}/${opts.id}/price`);
    if (!response.ok) {
      throw new Error(`price lookup failed with ${response.status}`);
    }
    return response.json();
  }
}
```

## Return `response.data`

When a method goes through the kernel transport, unwrap the response before returning. The caller wants the payload, not the envelope. Keep the envelope handling inside the service.

```ts no-check
import { api, BaseService, ISendParams, ISendResponse } from '@venizia/ardor';

export class PricingService extends BaseService {
  ...

  @api()
  async list(opts: ISendParams): Promise<ISendResponse['data']> {
    const response = await ... // your transport call, see the network reference
    return response.data;
  }
}
```

## Throw with `getError`

The kernel throws its own errors with `getError` from `@venizia/ignis-inversion`, using an options object. The `Logger` itself does this when it has no logger to write to:

```ts no-check
import { getError } from '@venizia/ignis-inversion';

...
throw getError({ message: '[info] Invalid logger instance!' });
```

Do the same in a service. Throw, do not return `null` or `undefined` on failure. `@api()` will log it, and the caller decides what to do.

## Keep react-admin types out

A service in the kernel layer should not import from `ra-core`. `GetListParams`, `RaRecord`, and friends belong to `IReactAdminDataProvider` in the admin package. That is the adapter between react-admin and your services.

Inside a service, `ISendParams` and `ISendResponse` are enough. They describe what goes over the wire. If a service signature needs a react-admin type, the react-admin logic has leaked one layer too far. Move it into the data provider.

## One instance per application

A service is registered once in the container and lives for the life of the application. Every component that resolves it gets the same object.

So do not keep per-request state on the class. No `this.currentId`, no `this.lastResult`. Pass what a call needs in its options object and return what it produced. The only long-lived field a service should hold is what it was built with: `logger`, `resource`, and injected collaborators.

## Where a service lives and how a component reaches it

Register the class by stereotype or by hand (`this.service(PricingService)`, `this.repository(ProductRepository)`); either binds a singleton and records the key on the class. A component does not import the class and `new` it. It asks the container by class, and the hook checks the class is bound under `services.` or `repositories.`.

```tsx no-check
import { useRepository, useService } from '@venizia/ardor';

export function ProductPrice(props: { id: number }) {
  const pricing = useService({ target: PricingService });
  const products = useRepository({ target: ProductRepository });
  ...
}
```

The component never sees how the class was built. Swap the implementation in the container and the component does not change. See [binding keys](./binding-keys) for how to name keys and [hooks](../references/hooks) for the hook signatures.

## Common pitfalls

- **Expecting `@api()` to swallow errors.** It logs and rethrows. The caller still gets the error.
- **Decorating a sync method.** `@api()` replaces the method with an `async` function. The result is always a promise.
- **Reusing a scope.** `Logger.getInstance` returns the same logger for the same scope. Two classes with one scope are indistinguishable in the log.
- **Filtering the console by level.** Every level, including `error`, is written through `console.info`. Filter by the `[error]` prefix in the message, not by the console's level filter.
- **Passing `enableDebug` from one service.** It is a process-wide switch. Passing it from any scope flips debug logging for every scope.
- **Storing request state on the class.** The service is a singleton. State on the instance is shared by every caller.

## Related

- [Binding keys](./binding-keys) - naming and registering services and repositories in the container
- [Hooks](../references/hooks) - `useService`, `useRepository` and the other React hooks
- [Network](../references/network) - the transport a service calls
- [Data provider](../references/data-provider) - where react-admin types belong
- [Types](../references/types) - `ISendParams`, `ISendResponse`, and other kernel types
- [Module augmentation](./module-augmentation) - typing your own binding keys
