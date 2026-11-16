---
title: CountRestDataProvider
description: A data provider that fetches the list and the total in two requests - GET resource and GET resource/count - for APIs that do not return a total with the list response.
---

# CountRestDataProvider

`CountRestDataProvider` is a drop-in replacement for `DefaultRestDataProvider`. It changes one thing: how `getList` obtains `total`. Instead of reading the total from the list response, it issues a second request to `resource/count` and takes `total` from that response's `count` field.

Use it when the API does not send a total with the list payload (for example, no `content-range` header) but does expose a `count` endpoint that accepts a `where` filter.

## Prerequisites

You have an ARDOR application with `REST_DATA_PROVIDER_OPTIONS` and `APPLICATION_INFO` bound - see [Application](../references/application) and [Binding keys](../references/binding-keys).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `CountRestDataProvider` | class | `DefaultRestDataProvider` subclass that overrides `requestList` |
| `DefaultRestDataProvider` | class | The base provider; supplies `getList`, `getOne`, `getMany` and the network service |
| `RequestTypes` | class | `GET_LIST` for the list call, `SEND` for the count call |
| `RequestCountData` | class | Both calls use `RequestCountData.DATA_ONLY` |
| `CoreBindings` | class | Holds `DEFAULT_REST_DATA_PROVIDER`, the key you bind this class under |
| `IDataProvider` | interface | What the container hands out: positional `(resource, params)` methods |
| `TRequestType` | type | Parameter type of `requestList` |
| `IListFilter` | interface | The list filter `requestList` receives (`where`, `order`, `limit`, `skip`, ...) |

## What it overrides

`CountRestDataProvider` extends `DefaultRestDataProvider` and overrides only the protected `requestList`. Everything else - the constructor, `getOne`, `getMany`, filter building in `getList`, `getNetworkService()` - is inherited unchanged.

```ts no-check
class CountRestDataProvider<TResource extends string = string>
  extends DefaultRestDataProvider<TResource> {

  protected override requestList<RecordType extends RaRecord = RaRecord>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, unknown>;
    filter: IListFilter;
    extra?: TExtraRequest;
  }): Promise<{ data: RecordType[]; total: number; meta?: { extra: ... } }>;
  // ...
}
```

`getList` in the base class builds `filter` (with `where`, `order`, `limit`, `skip`, `include`, `fields`) and `queryKey` (from `filter.params` and `meta`), then delegates to `requestList`. The override receives exactly those arguments, and the list extras the caller asked for in `extra`.

## The two requests

The override fires two requests in parallel through the inherited protected `request()`:

1. The list request, made by the base `requestList`: `type` as passed by `getList` (`RequestTypes.GET_LIST`), path `[resource]`, query `{ ...queryKey, filter }`, and the `x-request-extra` header when extras were asked for.
2. The count request. `type: RequestTypes.SEND`, path `[resource, 'count']`, query `{ ...queryKey, where: filter?.where }`.

Each is a `GET` that builds its own headers. The count request carries no list extras, and it has its own tracing id.

Only `filter.where` reaches the count endpoint. `order`, `limit`, `skip`, `include`, and `fields` are not sent, so the count reflects every record matching the filter, not just the current page.

```tsx
import { useEffect, useState } from 'react';
import { Ardor, CoreBindings } from '@venizia/ardor';

export function ProductTotal() {
  const dataProvider = Ardor.useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER });
  const logger = Ardor.useApplicationLogger();
  const [total, setTotal] = useState<number>();

  useEffect(() => {
    dataProvider
      .getList('products', {
        pagination: { page: 1, perPage: 25 },
        sort: { field: 'id', order: 'ASC' },
        filter: { status: 'active' },
      })
      .then((page) => setTotal(page.total))
      .catch((error: unknown) => {
        logger.error('[ProductTotal] getList failed | error: %o', error);
      });
  }, [dataProvider, logger]);

  // GET /products?filter=...      -> page.data
  // GET /products/count?where=... -> page.total
  return <p>{total}</p>;
}
```

`Ardor.useProvider` is the same function as the bare `useProvider`. It returns the `IDataProvider` the container built from `CountRestDataProvider`, with its positional `(resource, params)` methods and the auth service attached. Do not call the class's own methods on an instance you built: it has no auth service.

## Return shape

The result is `Promise.all` over the two responses, mapped to the react-admin `getList` contract:

```ts no-check
// excerpt of the value resolved by requestList
const result = {
  data: listResponse.data,
  total: countResponse.data?.count ?? 0,
};
// ...
```

`total` is `data.count` of the count response, as the server sent it: nothing converts it, so a `count` that is a string gives a string at run time. A `count` that is missing or `null`, or an answer with no body (204), gives `0`.

## Binding it

`BaseArdorApplication` binds `DefaultRestDataProvider` under `CoreBindings.DEFAULT_REST_DATA_PROVIDER`. Replace it with one line in `bindContext()`: the class, as a provider with the singleton scope. The constructor is inherited, so the container still injects `CoreBindings.REST_DATA_PROVIDER_OPTIONS` and `CoreBindings.APPLICATION_INFO`. Bind the options in a `@configuration()` class.

```ts
import { BindingScopes } from '@venizia/ignis-inversion';

import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  CountRestDataProvider,
  type IApplicationInfo,
  type IRestDataProviderOptions,
  provideOption,
} from '@venizia/ardor';

@configuration()
export class ShopConfiguration {
  @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: '/api' };
  }
}

export class ShopApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'Shop admin' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      .toProvider(CountRestDataProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}
```

See [Binding keys best practices](../best-practices/binding-keys) for the rest of the registration. The `IDataProvider` handed to react-admin by the container keeps its positional `(resource, params)` methods; nothing on the react-admin side changes.

## Extending it

Because `requestList` is protected, you can subclass `CountRestDataProvider` and narrow the resource union or adjust the hook further.

```ts
import { CountRestDataProvider } from '@venizia/ardor';

export class AppDataProvider extends CountRestDataProvider<'products' | 'categories'> {}
```

## Common pitfalls

- The API must expose `GET <resource>/count` for every resource that has a list view, and it must answer with `{ count: number }`. A missing endpoint answers 404, which rejects, and so does the whole list (`Promise.all`). A different field name does not reject: `total` silently becomes `0`, and react-admin shows an empty pagination.
- The count request only carries `where`. Filters that rely on `include` or `fields` to restrict rows are not applied to the count.
- Keys from `meta` and from `filter.params` are copied into `queryKey`, and `queryKey` is spread into both requests. Anything you put there also hits the count endpoint.
- The count call uses `RequestTypes.SEND`, not `RequestTypes.GET_LIST`. Any logic that branches on request type sees `SEND` for the second call.
- The count request is made without the list extras, so a route that answers extras by default answers them only on the list.
- The two requests run in parallel and the result waits for both. If the count endpoint is slow, the list is slow.
- Do not instantiate the class yourself - it depends on constructor injection of `REST_DATA_PROVIDER_OPTIONS` and `APPLICATION_INFO`, and only the container attaches the auth service to the provider it builds.

## Related

- [Data provider](../references/data-provider) - `DefaultRestDataProvider`, `getList` filter building, `IDataProvider`
- [Binding keys](../references/binding-keys) - `CoreBindings.DEFAULT_REST_DATA_PROVIDER`
- [Binding keys - best practices](../best-practices/binding-keys)
- [Network](../references/network) - `DefaultNetworkRequestService`, `RequestTypes`, `RequestCountData`
- [Custom transport](./custom-transport) - replacing the network layer instead of the provider
- [Application](../references/application)
