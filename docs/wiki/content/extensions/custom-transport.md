---
title: A data provider over a non-HTTP transport
description: Subclass DefaultRestDataProvider so the react-admin calls route through IPC, a Worker, or an in-memory API while keeping the IDataProvider shape and the base filter mapping.
---

# A data provider over a non-HTTP transport

`DefaultRestDataProvider` does two jobs. It maps react-admin parameters (pagination, sort, filter, meta) into a filter object, and it hands the mapped request to its `DefaultNetworkRequestService`. A desktop shell (Tauri), a Worker, or a test harness wants the first job and not the second. This page shows a subclass that keeps the mapping and swaps the transport for an injected function, with one override.

## Prerequisites

You have an application whose container class extends `BaseArdorApplication` (`ArdorApplication` is the React shell that mounts it) and know how a binding key is resolved - see [Binding keys](../references/binding-keys) and [Data provider](../references/data-provider).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `DefaultRestDataProvider` | class | The base you subclass. Extends `BaseProvider<IDataProvider<TResource>>`. |
| `IRestRequestOptions` | interface | The argument of the protected `request()`, the one seam you override. |
| `INetworkResponse` | interface | `{ data, total?, count?, extra?, ... }` - the shape your transport returns. |
| `IDataProvider` | interface | The shape the container hands to react-admin. Unchanged by the subclass. |
| `IRestDataProviderOptions` | interface | Injected under `CoreBindings.REST_DATA_PROVIDER_OPTIONS`. `url` is required. |
| `IApplicationInfo` | interface | Injected under `CoreBindings.APPLICATION_INFO`. |
| `CoreBindings` | class | Keys for the two base constructor injections and the provider slot you replace. |
| `@configuration()`, `@provide()` | decorators | Bind the transport function under a key of your own. |
| `TRequestType`, `TRequestMethod` | types | Types of the request type and method constants. |

## What the base class does per call

Every react-admin method in `DefaultRestDataProvider`, and `send()`, ends in one protected call:

```ts
import { type INetworkResponse, type IResponseSchema, type IRestRequestOptions } from '@venizia/ardor';

declare class DefaultRestDataProvider<TResource extends string = string> {
  protected request<TResult>(
    opts: IRestRequestOptions<TResource> & { schema: IResponseSchema<TResult> },
  ): Promise<INetworkResponse<TResult>>;
  protected request(
    opts: IRestRequestOptions<TResource> & { schema?: IResponseSchema },
  ): Promise<INetworkResponse>;
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
import { type INetworkResponse, type TRequestMethod, type TRequestType } from '@venizia/ardor';

export interface ITransportRequest {
  type: TRequestType;
  method: TRequestMethod;
  paths: string[];
  query?: { filter?: { limit?: number; skip?: number } } & Record<string, unknown>;
  headers?: HeadersInit;
  body?: unknown;
  /** The abort signal of the call: react-admin aborts a read that a newer filter replaced. */
  signal?: AbortSignal;
}

export type TTransport = (req: ITransportRequest) => Promise<INetworkResponse>;

// A transport answers parsed JSON, as a server does; its `data` is `unknown` until a schema checks it.
const reply = async (opts: { data: unknown; total?: number }): Promise<INetworkResponse> => {
  return { data: opts.data, total: opts.total };
};

// An in-memory transport, useful in tests.
const products = [
  { id: 1, name: 'Anvil' },
  { id: 2, name: 'Rope' },
];

export const memoryTransport: TTransport = async req => {
  const [resource, id] = req.paths;
  if (resource !== 'products') {
    return reply({ data: [] });
  }
  if (id !== undefined) {
    return reply({ data: products.find(p => `${p.id}` === id) });
  }
  const limit = req.query?.filter?.limit ?? products.length;
  const skip = req.query?.filter?.skip ?? 0;
  return reply({ data: products.slice(skip, skip + limit), total: products.length });
};
```

The same type fits a Tauri `invoke` wrapper or a `postMessage` bridge to a Worker. Only the body of the function changes.

## The subclass

The subclass keeps the two base injections, adds a third for the transport, and overrides `request()`. The transport type from the previous section is repeated here so the snippet stands on its own.

```ts
import {
  BindingKeys,
  CoreBindings,
  DefaultRestDataProvider,
  type IApplicationInfo,
  inject,
  type INetworkResponse,
  type IResponseSchema,
  type IRestDataProviderOptions,
  type IRestRequestOptions,
  NetworkResponseReader,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor';
import { HttpHeaders } from '@venizia/ignis-helpers/core';

// Same contract as in "The transport contract" above.
export interface ITransportRequest {
  type: TRequestType;
  method: TRequestMethod;
  paths: string[];
  query?: { filter?: { limit?: number; skip?: number } } & Record<string, unknown>;
  headers?: HeadersInit;
  body?: unknown;
  /** The abort signal of the call: react-admin aborts a read that a newer filter replaced. */
  signal?: AbortSignal;
}

export type TTransport = (req: ITransportRequest) => Promise<INetworkResponse>;

// A key for a value with no class: the transport function.
export class TransportBindings {
  static readonly TRANSPORT = BindingKeys.build<TTransport>({ key: 'app.transport' });
}

export class TransportDataProvider<
  TResource extends string = string,
> extends DefaultRestDataProvider<TResource> {
  constructor(
    @inject({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
    restDataProviderOptions: IRestDataProviderOptions,
    @inject({ key: CoreBindings.APPLICATION_INFO })
    applicationInfo: IApplicationInfo,
    @inject({ key: TransportBindings.TRANSPORT })
    protected transport: TTransport,
  ) {
    super(restDataProviderOptions, applicationInfo);
  }

  // getList, getOne, ..., send: every method has already mapped its params by the time it calls this.
  protected override request<TResult>(
    opts: IRestRequestOptions<TResource> & { schema: IResponseSchema<TResult> },
  ): Promise<INetworkResponse<TResult>>;
  /** With no schema the data is unknown. */
  protected override request(
    opts: IRestRequestOptions<TResource> & { schema?: IResponseSchema },
  ): Promise<INetworkResponse>;
  protected override request(
    opts: IRestRequestOptions<TResource> & { schema?: IResponseSchema },
  ): Promise<INetworkResponse> {
    const {
      schema,
      resource,
      type,
      method,
      paths = [resource],
      query,
      body,
      bodyType,
      extra,
      headers,
      requestCountData,
      signal,
    } = opts;

    // Still from the base: headers built from the options and application info.
    const props = this.networkService.getRequestProps({
      resource,
      body,
      bodyType,
      extra,
      requestCountData,
      restDataProviderOptions: this.restDataProviderOptions,
      applicationInfo: this.applicationInfo,
    });

    const answered = this.transport({
      type,
      method,
      paths,
      query,
      // A header the caller named wins over the computed ones, as in the base.
      headers: headers
        ? Object.fromEntries(
            HttpHeaders.merge({ layers: [new Headers(props.headers), new Headers(headers)] }),
          )
        : props.headers,
      body: props.body,
      signal,
    });

    // The transport answers unchecked data; a schema checks and types it. `checkData` sees the data only: refuse an empty answer in the transport.
    if (!schema) {
      return answered;
    }

    return answered.then((response) => NetworkResponseReader.checkData({ response, schema }));
  }
}
```

`@inject` comes from `@venizia/ardor`. A key made by `BindingKeys.build` is right for `TransportBindings.TRANSPORT`: the value is a function with no class, and the key carries its type. Keep the key in a `static readonly` constants class.

`getRequestProps` throws a 401 error, "Invalid auth token to fetch!", when no token is stored and the resource is not a no-auth path. The error reaches `checkError` like any request error. An application with no sign-in sets `noAuth: { regex: /./ }` in its options so that no request needs a token.

What still comes from the base:

- The `BaseProvider<IDataProvider<TResource>>` contract. The container resolves your subclass exactly as it resolves `DefaultRestDataProvider`; you override nothing on the provider side.
- The protected `createNetworkService()`, called once on first use, which reads `url`, `noAuth.paths`, `noAuth.regex`, `headers`, and `authRecovery` from the options and builds the `DefaultNetworkRequestService`. `getNetworkService()` still returns it.
- `getRequestProps`, reached through `this.networkService`, which produces the `headers` and `body` for a request.
- Not the abort and the timeout: the `signal` of a call reaches your transport in `ITransportRequest.signal`, and the `timeout` option applies to `doRequest`, which a transport replaces. Pass the signal on to what sends the request, and put your own time limit in the transport.
- The filter mapping: the protected `buildListFilter({ params })` (a delegate of `ListFilterBuilder.build`) is shared by `getList` and `getManyReference`, and `getMany` builds its own with `ListFilterBuilder.extractQueryParams`. Keep it when you override a method, or re-use the same mapping.
- `updateMany` and `deleteMany` read the affected ids from `result.data` (`toAffectedIds`), so a transport answers the affected rows, as the server does.

## Binding the subclass

Two of the three injections are options you bind: `CoreBindings.REST_DATA_PROVIDER_OPTIONS` (with `url`) and, from the framework, `CoreBindings.APPLICATION_INFO`. Bind the third, `TransportBindings.TRANSPORT`, with a `@provide` method of a `@configuration()` class. Replace the default data provider with one line in `bindContext()`: your provider class under `CoreBindings.DEFAULT_REST_DATA_PROVIDER`, as a singleton.

```ts
import { BindingScopes, type TBindingKey } from '@venizia/ignis-inversion';

import {
  BaseArdorApplication,
  configuration,
  CoreBindings,
  type DefaultRestDataProvider,
  type IApplicationInfo,
  type INetworkResponse,
  type IRestDataProviderOptions,
  provide,
  type TRequestMethod,
  type TRequestType,
} from '@venizia/ardor';

// Declared in the sections above.
interface ITransportRequest {
  type: TRequestType;
  method: TRequestMethod;
  paths: string[];
}
type TTransport = (req: ITransportRequest) => Promise<INetworkResponse>;
declare const memoryTransport: TTransport;
declare class TransportDataProvider extends DefaultRestDataProvider {}
declare class TransportBindings {
  static readonly TRANSPORT: TBindingKey<TTransport>;
}

@configuration()
export class TransportConfiguration {
  @provide({ key: TransportBindings.TRANSPORT })
  transport(): TTransport {
    return memoryTransport;
  }

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    // The url is required but never used by this transport; no sign-in, so no request needs a token.
    return { url: '/api', noAuth: { regex: /./ } };
  }
}

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'desktop', version: '1.0.0', description: 'Desktop shell' };
  }

  bindContext(): void {
    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
      .toProvider(TransportDataProvider)
      .setScope(BindingScopes.SINGLETON);
  }
}
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
