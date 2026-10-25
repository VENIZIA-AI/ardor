---
title: A data provider over a non-HTTP transport
description: Subclass DefaultRestDataProvider so the react-admin calls route through IPC, a Worker, or an in-memory API while keeping the IDataProvider shape and the base filter mapping.
---

# A data provider over a non-HTTP transport

`DefaultRestDataProvider` does two jobs. It maps react-admin parameters (pagination, sort, filter, meta) into a filter object, and it hands the mapped request to its `DefaultNetworkRequestService`. A desktop shell (Tauri), a Worker, or a test harness wants the first job and not the second. This page shows a subclass that keeps the mapping and swaps the transport for an injected function, with one override.

## Prerequisites

You have an application built with `ArdorApplication` and know how a binding key is resolved - see [Binding keys](../references/binding-keys) and [Data provider](../references/data-provider).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `DefaultRestDataProvider` | class | The base you subclass. Extends `BaseProvider<IDataProvider<TResource>>`. |
| `IRestRequestOptions` | interface | The argument of the protected `request()`, the one seam you override. |
| `INetworkResponse` | interface | `{ data, total?, count?, extra?, ... }` - the shape your transport returns. |
| `IDataProvider` | interface | The shape the container hands to react-admin. Unchanged by the subclass. |
| `IRestDataProviderOptions` | interface | Injected under `CoreBindings.REST_DATA_PROVIDER_OPTIONS`. `url` is required. |
| `IApplicationInfo` | interface | Injected under `CoreBindings.APPLICATION_INFO`. |
| `CoreBindings` | class | Keys for the two base constructor injections. |
| `TRequestType`, `TRequestMethod` | types | Types of the request type and method constants. |

## What the base class does per call

Every react-admin method in `DefaultRestDataProvider`, and `send()`, ends in one protected call:

```ts
import { type AnyType, type INetworkResponse, type IRestRequestOptions } from '@venizia/ardor';

declare class DefaultRestDataProvider<TResource extends string = string> {
  protected request<TResult = AnyType>(
    opts: IRestRequestOptions<TResource>,
  ): Promise<INetworkResponse<TResult>>;
}
```

`request()` asks `this.networkService.getRequestProps(...)` for the headers and the body, then calls `this.networkService.doRequest(...)`. The list methods reach it through `requestList()`, which only adds the filter to the query and turns the extras a route answered into `meta.extra`.

So there is one seam: override `request()` and every method moves to your transport, `send()` and the list methods included.

## What the filter mapping produces

This is the part you keep. Your transport receives a `query` whose `filter` is already in the shape the base builds:

- `filter.where` - the react-admin filter with `include`, `params`, `noLimit` and `fields` removed. If the incoming filter already has a `where`, it is passed through as-is.
- `filter.include`, `filter.fields` - copied from the react-admin filter.
- `filter.order` - `[\`${sort.field} ${sort.order}\`]` when `sort.field` is set.
- `filter.limit`, `filter.skip` - from `pagination`: `limit` is `perPage` and `skip` is `(page - 1) * perPage`, with the page defaulting to 1. No `perPage` (or 0) sends neither. When `filter.noLimit` is truthy, both are cleared.
- `getMany` adds `where.id = { inq: params.ids }`.
- `getManyReference` adds `where[target] = id`.

Keys of `filter.params` and of `meta` are lifted to the top level of `query`, next to `filter`, and `filter.params` is then dropped.

## The transport contract

Define a function type for your transport. It receives what the base would have handed to `doRequest` and resolves to an `INetworkResponse`.

```ts
import { type AnyType, type INetworkResponse, type TRequestMethod, type TRequestType } from '@venizia/ardor';

export interface ITransportRequest {
  type: TRequestType;
  method: TRequestMethod;
  paths: string[];
  query?: Record<string, AnyType>;
  headers?: HeadersInit;
  body?: AnyType;
}

export type TTransport = (req: ITransportRequest) => Promise<INetworkResponse>;

// An in-memory transport, useful in tests and Storybook.
const products = [
  { id: 1, name: 'Anvil' },
  { id: 2, name: 'Rope' },
];

export const memoryTransport: TTransport = async req => {
  const [resource, id] = req.paths;
  if (resource !== 'products') {
    return { data: [] };
  }
  if (id !== undefined) {
    return { data: products.find(p => `${p.id}` === id) };
  }
  const limit = req.query?.filter?.limit ?? products.length;
  const skip = req.query?.filter?.skip ?? 0;
  return { data: products.slice(skip, skip + limit), total: products.length };
};
```

The same type fits a Tauri `invoke` wrapper or a `postMessage` bridge to a Worker. Only the body of the function changes.

## The subclass

The subclass keeps the two base injections, adds a third for the transport, and overrides `request()`. The transport type from the previous section is repeated here so the snippet stands on its own.

```ts
import { inject } from '@venizia/ignis-inversion';
import {
  type AnyType,
  CoreBindings,
  DefaultRestDataProvider,
  type IApplicationInfo,
  type INetworkResponse,
  type IRestDataProviderOptions,
  type IRestRequestOptions,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor';

// Same contract as in "The transport contract" above.
export interface ITransportRequest {
  type: TRequestType;
  method: TRequestMethod;
  paths: string[];
  query?: Record<string, AnyType>;
  headers?: HeadersInit;
  body?: AnyType;
}

export type TTransport = (req: ITransportRequest) => Promise<INetworkResponse>;

export const TRANSPORT_KEY = 'app.transport';

export class TransportDataProvider<
  TResource extends string = string,
> extends DefaultRestDataProvider<TResource> {
  constructor(
    @inject({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
    restDataProviderOptions: IRestDataProviderOptions,
    @inject({ key: CoreBindings.APPLICATION_INFO })
    applicationInfo: IApplicationInfo,
    @inject({ key: TRANSPORT_KEY })
    protected transport: TTransport,
  ) {
    super(restDataProviderOptions, applicationInfo);
  }

  // getList, getOne, ..., send: every method has already mapped its params by the time it calls this.
  protected override request<TResult = AnyType>(
    opts: IRestRequestOptions<TResource>,
  ): Promise<INetworkResponse<TResult>> {
    const { resource, type, method, paths = [resource], query, body, bodyType, extra } = opts;

    // Still from the base: headers built from the options and application info.
    const props = this.networkService.getRequestProps({
      resource,
      body,
      bodyType,
      extra,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    return this.transport({
      type,
      method,
      paths,
      query,
      headers: props.headers,
      body: props.body,
    }) as Promise<INetworkResponse<TResult>>;
  }
}
```

What still comes from the base:

- The `BaseProvider<IDataProvider<TResource>>` contract. The container resolves your subclass exactly as it resolves `DefaultRestDataProvider`; you override nothing on the provider side.
- The protected `createNetworkService()`, called once on first use, which reads `url`, `noAuthPaths`, `noAuthPathRegex`, `headers` and `authRecovery` from the options and builds the `DefaultNetworkRequestService`. `getNetworkService()` still returns it.
- `getRequestProps`, reached through `this.networkService`, which produces the `headers` and `body` for a request.
- The filter mapping: the protected `buildListFilter({ params })` (a delegate of `ListFilterBuilder.build`) is shared by `getList` and `getManyReference`, and `getMany` builds its own with `ListFilterBuilder.extractQueryParams`. Keep it when you override a method, or re-use the same mapping.
- `updateMany` and `deleteMany` read the affected ids from `result.data` (`toAffectedIds`), so a transport answers the affected rows, as the server does.

## Binding the subclass

Two of the three injections are already bound by the application: `CoreBindings.REST_DATA_PROVIDER_OPTIONS` and `CoreBindings.APPLICATION_INFO`. You add a binding for `TRANSPORT_KEY` with your transport function, and register `TransportDataProvider` under the key the application uses for its data provider in place of `DefaultRestDataProvider`.

```ts no-check
// In a @configuration() class - see the binding keys reference for the exact shape.
// 1. bind TRANSPORT_KEY -> memoryTransport (or a Tauri / Worker bridge)
// 2. @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) returning
//    application.instantiate(TransportDataProvider).value(application)
// ...
```

The `IDataProvider` react-admin receives from the container is unchanged: positional `(resource, params)` methods, as documented in [Data provider](../references/data-provider). Your subclass methods use the options object form, as the base does.

## Common pitfalls

- **`url` is still required.** `createNetworkService()` passes `restDataProviderOptions.url` to `DefaultNetworkRequestService`. `IRestDataProviderOptions.url` is a required string, so bind options with a `url` even when no HTTP request is ever made.
- **Override `request()`, not the methods.** Each method builds its params and calls `request()`; overriding `getOne` alone leaves the other nine on HTTP.
- **`getMany` and `getManyReference` mutate `where`.** `getMany` sets `where.id = { inq: params.ids }`; `getManyReference` sets `where[target] = id`. Your transport has to understand a LoopBack-style filter (`where`, `include`, `fields`, `order`, `limit`, `skip`, `offset`), or you translate it inside the transport.
- **`noLimit` clears pagination.** When `filter.noLimit` is truthy, `limit` and `skip` are set to `undefined`. Do not fall back to a default page size in the transport unless you mean to.
- **`meta` and `filter.params` are not inside `filter`.** Their keys are spread onto the top level of `query`. Read them from `req.query`, not from `req.query.filter`.
- **Only `skip` is sent.** IGNIS reads `offset` as an alias of `skip`; a transport that wants `offset` maps it itself.

## Related

- [Data provider](../references/data-provider) - the `IDataProvider` shape and how `DefaultRestDataProvider` maps each react-admin method.
- [Binding keys](../references/binding-keys) and [Binding keys best practices](../best-practices/binding-keys) - where `CoreBindings.REST_DATA_PROVIDER_OPTIONS` and `CoreBindings.APPLICATION_INFO` come from, and how to add your own key.
- [Network](../references/network) - `DefaultNetworkRequestService`, the transport you are replacing.
- [Count provider](./count-provider) - another `DefaultRestDataProvider` subclass, for comparison.
- [Application](../references/application) - where providers are registered.
