---
title: A data provider over a non-HTTP transport
description: Subclass DefaultRestDataProvider so the react-admin calls route through IPC, a Worker, or an in-memory API while keeping the IDataProvider shape and the base filter mapping.
---

# A data provider over a non-HTTP transport

`DefaultRestDataProvider` does two jobs. It maps react-admin parameters (pagination, sort, filter, meta) into a filter object, and it hands the mapped request to its `DefaultNetworkRequestService`. A desktop shell (Tauri), a Worker, or a test harness wants the first job and not the second. This page shows a subclass that keeps the mapping and swaps the transport for an injected function.

## Prerequisites

You have an application built with `ArdorApplication` and know how a binding key is resolved - see [Binding keys](../references/binding-keys) and [Data provider](../references/data-provider).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `DefaultRestDataProvider` | class | The base you subclass. Extends `BaseProvider<IDataProvider<TResource>>`. |
| `IDataProvider` | interface | The shape the container hands to react-admin. Unchanged by the subclass. |
| `IRestDataProviderOptions` | interface | Injected under `CoreBindings.REST_DATA_PROVIDER_OPTIONS`. `url` is required. |
| `IApplicationInfo` | interface | Injected under `CoreBindings.APPLICATION_INFO`. |
| `CoreBindings` | class | Keys for the two base constructor injections. |
| `RequestTypes`, `RequestMethods`, `RequestCountData` | classes | Constants the base passes on every request. |
| `TRequestType`, `TRequestMethod` | types | Types of those constants. |
| `ISendResponse` | interface | `{ data: T; [key: string]: any }` - the shape your transport returns. |
| `IGetRequestPropsResult` | interface | `{ headers?: HeadersInit; body?: any }` - what `getRequestProps` returns. |

## What the base class does per call

Every react-admin method in `DefaultRestDataProvider` follows the same steps:

1. Ask `this.networkService.getRequestProps({ requestCountData, resource, restDataProviderOptions, applicationInfo })` for headers and body. The result is an `IGetRequestPropsResult`.
2. Build a filter object from the react-admin params.
3. Call `this.networkService.doRequest({ requestCountData, type, method, paths, query, ...request })`.

For `getList`, step 3 goes through a public helper:

```ts
import { type GetListResult, type RaRecord } from 'ra-core';
import { type AnyType, type TRequestMethod, type TRequestType } from '@venizia/ardor';

declare class DefaultRestDataProvider<TResource extends string = string> {
  getListHelper<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, AnyType>;
    filter: Record<string, AnyType>;
    requestProps: { headers?: HeadersInit; body?: AnyType; method: TRequestMethod };
  }): Promise<GetListResult<RecordType>>;
}
```

`getList` maps the params, then calls `getListHelper`. `getOne`, `getMany` and `getManyReference` call `this.networkService.doRequest` directly. So the seams are: override `getListHelper` to catch lists, and override the other methods one by one.

## What the filter mapping produces

This is the part you keep. Your transport receives a `query` whose `filter` is already in the shape the base builds:

- `filter.where` - the react-admin filter with `include`, `params`, `noLimit` and `fields` removed. If the incoming filter already has a `where`, it is passed through as-is.
- `filter.include`, `filter.fields` - copied from the react-admin filter.
- `filter.order` - `[\`${sort.field} ${sort.order}\`]` when `sort.field` is set.
- `filter.limit`, `filter.skip`, `filter.offset` - from `pagination`. `skip` and `offset` are both `(page - 1) * perPage`. When `filter.noLimit` is truthy, all three are cleared.
- `getMany` adds `where.id = { inq: params.ids }`.
- `getManyReference` adds `where[target] = id`.

Keys of `filter.params` and of `meta` are lifted to the top level of `query`, next to `filter`, and `filter.params` is then dropped.

## The transport contract

Define a function type for your transport. It receives what the base would have handed to `doRequest` and resolves to an `ISendResponse`.

```ts
import {
  type AnyType,
  type ISendResponse,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor';

export interface ITransportRequest {
  type: TRequestType;
  method: TRequestMethod;
  paths: string[];
  query?: Record<string, AnyType>;
  headers?: HeadersInit;
  body?: AnyType;
}

export type TTransport = (req: ITransportRequest) => Promise<ISendResponse>;

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

The subclass keeps the two base injections, adds a third for the transport, and overrides the seams. The example overrides `getListHelper` (covers `getList`) and `getOne`. Add `getMany`, `getManyReference` and the write methods the same way. The transport type from the previous section is repeated here so the snippet stands on its own.

```ts
import { inject } from '@venizia/ignis-inversion';
import {
  type GetListResult,
  type GetOneParams,
  type GetOneResult,
  type QueryFunctionContext,
  type RaRecord,
} from 'ra-core';
import {
  type AnyType,
  CoreBindings,
  DefaultRestDataProvider,
  type IApplicationInfo,
  type ICustomParams,
  type IRestDataProviderOptions,
  type ISendResponse,
  RequestCountData,
  RequestMethods,
  RequestTypes,
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

export type TTransport = (req: ITransportRequest) => Promise<ISendResponse>;

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

  // getList has already mapped pagination, sort, filter and meta by the time it calls this.
  override getListHelper<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    type: TRequestType;
    queryKey: Record<string, AnyType>;
    filter: Record<string, AnyType>;
    requestProps: { headers?: HeadersInit; body?: AnyType; method: TRequestMethod };
  }) {
    const { type, resource, queryKey, filter, requestProps } = opts;

    return this.transport({
      type,
      method: requestProps.method,
      paths: [resource],
      query: { ...queryKey, filter },
      headers: requestProps.headers,
      body: requestProps.body,
    }) as Promise<GetListResult<RecordType>>;
  }

  // getOne does not go through a helper, so override the whole method.
  override getOne<RecordType extends RaRecord = AnyType>(opts: {
    resource: TResource;
    params: GetOneParams<RecordType> & QueryFunctionContext & ICustomParams;
  }): Promise<GetOneResult<RecordType>> {
    const { resource, params } = opts;

    // Still from the base: headers built from the options and application info.
    const request = this.networkService.getRequestProps({
      requestCountData: RequestCountData.DATA_ONLY,
      resource,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    const filter = params?.meta?.filter ?? {};

    return this.transport({
      type: RequestTypes.GET_ONE,
      method: RequestMethods.GET,
      paths: [resource, `${params.id}`],
      query: { filter },
      headers: request.headers,
      body: request.body,
    }) as Promise<GetOneResult<RecordType>>;
  }
}
```

What still comes from the base:

- The `BaseProvider<IDataProvider<TResource>>` contract. The container resolves your subclass exactly as it resolves `DefaultRestDataProvider`; you override nothing on the provider side.
- The constructor, which reads `url`, `useAuth`, `noAuthPaths`, `noAuthPathRegex`, `headers` and `authRecovery` from the options and builds the `DefaultNetworkRequestService`. `getNetworkService()` still returns it.
- `getRequestProps`, reached through `this.networkService`, which produces the `headers` and `body` for a request.
- The filter mapping inside `getList`, `getMany` and `getManyReference`, as long as you override at the helper level or re-use the same mapping when you override a method.

## Binding the subclass

Two of the three injections are already bound by the application: `CoreBindings.REST_DATA_PROVIDER_OPTIONS` and `CoreBindings.APPLICATION_INFO`. You add a binding for `TRANSPORT_KEY` with your transport function, and register `TransportDataProvider` under the key the application uses for its data provider in place of `DefaultRestDataProvider`.

```ts no-check
// In the application setup - see the binding keys reference for the exact calls.
// 1. bind TRANSPORT_KEY -> memoryTransport (or a Tauri / Worker bridge)
// 2. bind the data provider key -> TransportDataProvider instead of DefaultRestDataProvider
// ...
```

The `IDataProvider` react-admin receives from the container is unchanged: positional `(resource, params)` methods, as documented in [Data provider](../references/data-provider). Your subclass methods use the options object form, as the base does.

## Common pitfalls

- **`url` is still required.** The base constructor passes `restDataProviderOptions.url` to `DefaultNetworkRequestService`. `IRestDataProviderOptions.url` is a required string, so bind options with a `url` even when no HTTP request is ever made.
- **`getListHelper` only covers `getList`.** `getOne`, `getMany` and `getManyReference` call `this.networkService.doRequest` directly. If you override only the helper, those three still go to HTTP.
- **`getMany` and `getManyReference` mutate `where`.** `getMany` sets `where.id = { inq: params.ids }`; `getManyReference` sets `where[target] = id`. Your transport has to understand a LoopBack-style filter (`where`, `include`, `fields`, `order`, `limit`, `skip`, `offset`), or you translate it inside the transport.
- **`noLimit` clears pagination.** When `filter.noLimit` is truthy, `limit`, `skip` and `offset` are set to `undefined`. Do not fall back to a default page size in the transport unless you mean to.
- **`meta` and `filter.params` are not inside `filter`.** Their keys are spread onto the top level of `query`. Read them from `req.query`, not from `req.query.filter`.
- **Both `skip` and `offset` are sent.** They hold the same value. Pick one in the transport and ignore the other.

## Related

- [Data provider](../references/data-provider) - the `IDataProvider` shape and how `DefaultRestDataProvider` maps each react-admin method.
- [Binding keys](../references/binding-keys) and [Binding keys best practices](../best-practices/binding-keys) - where `CoreBindings.REST_DATA_PROVIDER_OPTIONS` and `CoreBindings.APPLICATION_INFO` come from, and how to add your own key.
- [Network](../references/network) - `DefaultNetworkRequestService`, the transport you are replacing.
- [Count provider](./count-provider) - another `DefaultRestDataProvider` subclass, for comparison.
- [Application](../references/application) - where providers are registered.
