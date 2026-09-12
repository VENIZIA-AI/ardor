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
| `CountRestDataProvider` | class | `DefaultRestDataProvider` subclass that overrides `getListHelper` |
| `DefaultRestDataProvider` | class | The base provider; supplies `getList`, `getOne`, `getMany` and the network service |
| `RequestTypes` | class | `GET_LIST` for the list call, `SEND` for the count call |
| `RequestCountData` | class | Both calls use `RequestCountData.DATA_ONLY` |
| `CoreBindings` | class | Holds `DEFAULT_REST_DATA_PROVIDER`, the key you bind this class under |
| `TRequestType`, `TRequestMethod` | types | Parameter types of `getListHelper` |

## What it overrides

`CountRestDataProvider` extends `DefaultRestDataProvider` and overrides only `getListHelper`. Everything else - the constructor, `getOne`, `getMany`, filter building in `getList`, `getNetworkService()` - is inherited unchanged.

```ts no-check
class CountRestDataProvider<TResource extends string = string>
  extends DefaultRestDataProvider<TResource> {

  override getListHelper<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, AnyType>;
    filter: Record<string, AnyType>;
    requestProps: { headers?: HeadersInit; body?: AnyType; method: TRequestMethod };
  }): Promise<{ data: RecordType[]; total: number }>;
  // ...
}
```

`getList` in the base class builds `filter` (with `where`, `order`, `limit`, `skip`, `offset`, `include`, `fields`) and `queryKey` (from `filter.params` and `meta`), then delegates to `getListHelper`. The override receives exactly those arguments.

## The two requests

The override fires two requests in parallel through the inherited `networkService`:

1. The list request. Identical to the base class: `type` as passed by `getList` (`RequestTypes.GET_LIST`), path `[resource]`, query `{ ...queryKey, filter }`.
2. The count request. `type: RequestTypes.SEND`, path `[resource, 'count']`, query `{ ...queryKey, where: filter?.where }`.

Both spread the same `requestProps` - so they share the method (`GET`, set by `getList`), headers, and body.

Only `filter.where` reaches the count endpoint. `order`, `limit`, `skip`, `offset`, `include`, and `fields` are not sent, so the count reflects every record matching the filter, not just the current page.

```ts
import {
  CountRestDataProvider,
  RequestMethods,
  RequestTypes,
  type TRequestMethod,
} from '@venizia/ardor';

declare const provider: CountRestDataProvider<'products'>;

export async function loadProducts() {
  // getList() normally builds these arguments; calling the helper directly
  // shows what the two requests receive.
  const page = await provider.getListHelper({
    type: RequestTypes.GET_LIST,
    resource: 'products',
    queryKey: {},
    filter: { where: { status: 'active' }, limit: 25, skip: 0 },
    requestProps: { method: RequestMethods.GET as TRequestMethod },
  });

  // GET /products?filter=...            -> page.data
  // GET /products/count?where=...       -> page.total
  return page;
}
```

## Return shape

The result is `Promise.all` over the two responses, mapped to the react-admin `getList` contract:

```ts no-check
// excerpt of the value resolved by getListHelper
const result = {
  data: listResponse.data,
  total: countResponse.data?.count ?? 0,
};
// ...
```

`total` comes from `data.count` on the count response. If the count endpoint returns nothing, or returns an object without `count`, `total` is `0`.

## Binding it

Bind the class under `CoreBindings.DEFAULT_REST_DATA_PROVIDER` in place of `DefaultRestDataProvider`. The constructor is inherited, so it still injects `CoreBindings.REST_DATA_PROVIDER_OPTIONS` and `CoreBindings.APPLICATION_INFO` from the container - bind the class, not a hand-built instance.

```ts no-check
import { CoreBindings, CountRestDataProvider } from '@venizia/ardor';

// ...
container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toClass(CountRestDataProvider);
// ...
```

See [Binding keys](../best-practices/binding-keys) for the exact binding call used by your application setup. The `IDataProvider` handed to react-admin by the container keeps its positional `(resource, params)` methods; nothing on the react-admin side changes.

## Extending it

Because `getListHelper` is a public method, you can subclass `CountRestDataProvider` and narrow the resource union or adjust the helper further.

```ts
import { CountRestDataProvider } from '@venizia/ardor';

export class AppDataProvider extends CountRestDataProvider<'products' | 'categories'> {}
```

## Common pitfalls

- The API must expose `GET <resource>/count` for every resource that has a list view, and it must answer with `{ count: number }`. A missing endpoint or a different field name does not throw at this layer - `total` silently becomes `0`, and react-admin shows an empty pagination.
- The count request only carries `where`. Filters that rely on `include` or `fields` to restrict rows are not applied to the count.
- Keys from `meta` and from `filter.params` are copied into `queryKey`, and `queryKey` is spread into both requests. Anything you put there also hits the count endpoint.
- The count call uses `RequestTypes.SEND`, not `RequestTypes.GET_LIST`. Any logic that branches on request type sees `SEND` for the second call.
- The two requests run in parallel and the result waits for both. If the count endpoint is slow, the list is slow.
- Do not instantiate the class yourself - it depends on constructor injection of `REST_DATA_PROVIDER_OPTIONS` and `APPLICATION_INFO`.

## Related

- [Data provider](../references/data-provider) - `DefaultRestDataProvider`, `getList` filter building, `IDataProvider`
- [Binding keys](../references/binding-keys) - `CoreBindings.DEFAULT_REST_DATA_PROVIDER`
- [Binding keys - best practices](../best-practices/binding-keys)
- [Network](../references/network) - `DefaultNetworkRequestService`, `RequestTypes`, `RequestCountData`
- [Custom transport](./custom-transport) - replacing the network layer instead of the provider
- [Application](../references/application)
