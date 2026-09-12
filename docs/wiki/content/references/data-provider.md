---
title: REST data provider
description: DefaultRestDataProvider and CountRestDataProvider - options, how react-admin calls become HTTP requests in the IGNIS filter vocabulary, send() for arbitrary endpoints, and the positional shape handed to react-admin.
---

# REST data provider

`DefaultRestDataProvider` is the ARDOR class that turns react-admin's data calls (`getList`, `getOne`, `create`, ...) into HTTP requests against a REST backend. The query language it emits is the IGNIS filter vocabulary: `{ where, order, limit, skip, offset, include, fields }`, JSON-serialised under a single `filter` query key.

`CountRestDataProvider` is a subclass that adds a second request to `/{resource}/count` for list totals.

Both are IGNIS providers: the container constructs them, and `value()` returns the object react-admin actually receives.

## Prerequisites

An ARDOR application with `CoreBindings.REST_DATA_PROVIDER_OPTIONS` and `CoreBindings.APPLICATION_INFO` bound - see [Application](../references/application) and [Binding keys](../references/binding-keys).

## Quick Reference

| Export | Kind | What it is |
| --- | --- | --- |
| `DefaultRestDataProvider<TResource>` | class | Provider that maps react-admin calls onto REST + IGNIS filters |
| `CountRestDataProvider<TResource>` | class | Same, plus a `/{resource}/count` request for `total` |
| `IRestDataProviderOptions` | interface | Options injected under `CoreBindings.REST_DATA_PROVIDER_OPTIONS` |
| `IDataProvider<TResource>` | interface | The positional, react-admin-facing object returned by `value()` |
| `IReactAdminDataProvider<TResource>` | interface | The react-admin subset of `IDataProvider` (no `send`, no `getNetworkService`) |
| `ISendParams` / `ISendResponse` | interfaces | Input and output of `send()` |
| `ICustomParams` | interface | Extra `params` bag accepted by the read calls |
| `RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `RequestCountData` | classes | Constants used in `send()` and internally |
| `HeaderConsts` | class | Header names, including `CONTENT_RANGE` |

## Options: `IRestDataProviderOptions`

```ts no-check
interface IRestDataProviderOptions {
  url: string;
  useAuth?: boolean;                 // default true
  noAuthPaths?: Array<string>;
  noAuthPathRegex?: string | RegExp | Array<string | RegExp>;
  headers?: HeadersInit;
  requestTracingId?: boolean | ((opts: { applicationInfo: IApplicationInfo }) => string);
  requestTracingChannel?: string;
  authRecovery?: {
    refreshToken?: () => Promise<unknown>;
    onAuthFailure?: () => ValueOrPromise<unknown>;
    refreshTokenPath?: string;
  };
}
```

| Option | Where it goes | Meaning |
| --- | --- | --- |
| `url` | `baseUrl` of the internal `DefaultNetworkRequestService` | Base URL every resource path is appended to |
| `useAuth` | network service | Attach the authorization header by default. Set `false` for apps that only call public APIs |
| `noAuthPaths` | network service | Exact resource paths requested without the authorization header |
| `noAuthPathRegex` | network service | Pattern(s) of paths requested without the authorization header. Strings are compiled with `new RegExp(...)` |
| `headers` | network service | Default headers for every request |
| `requestTracingId` | `getRequestProps` on each call | `true`, or a function that receives `{ applicationInfo }` and returns the id to send |
| `requestTracingChannel` | `getRequestProps` on each call | Channel value to send alongside the tracing id |
| `authRecovery` | network service | Hooks used when a request fails authentication |

The constructor builds one `DefaultNetworkRequestService` named `default-application-network-service` from `url`, `useAuth`, `noAuthPaths`, `noAuthPathRegex`, `headers` and `authRecovery`. The full options object, together with `applicationInfo`, is then passed to `networkService.getRequestProps(...)` on every call - that is how `requestTracingId` and `requestTracingChannel` reach the request. How the network service turns them into headers is covered in [Network](../references/network).

```ts
import { type IRestDataProviderOptions } from '@venizia/ardor';

const restDataProviderOptions: IRestDataProviderOptions = {
  url: 'https://api.example.com',
  useAuth: true,
  noAuthPaths: ['auth/sign-in', 'auth/sign-up'],
  noAuthPathRegex: [/^public\//, 'health'],
  headers: { 'x-client': 'shop-admin' },
  requestTracingId: ({ applicationInfo }) => `${applicationInfo.name}-${Date.now()}`,
  requestTracingChannel: 'admin',
  authRecovery: {
    refreshTokenPath: 'auth/refresh',
    onAuthFailure: () => {
      window.location.assign('/login');
    },
  },
};
```

## Constructing and `value()`

```tsx no-check
class DefaultRestDataProvider<TResource extends string = string>
  extends BaseProvider<IDataProvider<TResource>> {
  constructor(
    @inject({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }) restDataProviderOptions: IRestDataProviderOptions,
    @inject({ key: CoreBindings.APPLICATION_INFO }) applicationInfo: IApplicationInfo,
  );

  value(container: Container): IDataProvider<TResource>;
  getNetworkService(): DefaultNetworkRequestService;
}
```

The class methods take an options object: `getList({ resource, params })`. `value()` wraps them in the shape react-admin expects, where every method is positional: `getList(resource, params)`. `send` and `getNetworkService` keep their own shape on that object.

```ts
import {
  DefaultRestDataProvider,
  type IApplicationInfo,
  type IDataProvider,
  type IRestDataProviderOptions,
} from '@venizia/ardor';

const restDataProviderOptions: IRestDataProviderOptions = { url: 'https://api.example.com' };
const applicationInfo: IApplicationInfo = {
  name: 'shop-admin',
  version: '1.0.0',
  description: 'Shop administration',
};

// In an application the container does this; shown directly for clarity.
const provider = new DefaultRestDataProvider<'products' | 'orders'>(
  restDataProviderOptions,
  applicationInfo,
);

const dataProvider: IDataProvider<'products' | 'orders'> = provider.value(container);

// react-admin shape: positional on purpose
const products = await dataProvider.getList('products', {
  pagination: { page: 1, perPage: 20 },
  sort: { field: 'name', order: 'ASC' },
  filter: { status: 'active' },
});
```

`TResource` narrows the accepted resource names. It defaults to `string`.

## Call to request mapping

`{resource}` is the react-admin resource name, appended to `url`. "filter" means the `filter` query key, serialised as JSON. "query keys" means extra top-level query parameters.

| react-admin call | Verb | Path | Query / body |
| --- | --- | --- | --- |
| `getList` | GET | `/{resource}` | `filter = { where, include, fields, order, limit, skip, offset }` + query keys from `filter.params` and `meta` |
| `getOne` | GET | `/{resource}/{id}` | `filter = meta.filter` without `params`; query keys from `meta.filter.params` |
| `getMany` | GET | `/{resource}` | `filter = { ...meta.filter without params, where: { ...meta.filter.where, id: { inq: ids } } }`; query keys from `meta.filter.params` |
| `getManyReference` | GET | `/{resource}` | Same as `getList`, plus `where[target] = id` |
| `create` | POST | `/{resource}` | body = `params.data` |
| `update` | PATCH | `/{resource}/{id}` | body = `params.data` |
| `updateMany` | PATCH | `/{resource}` | `filter = { where: { id: { inq: ids } } }`; body = `params.data` |
| `delete` | DELETE | `/{resource}/{id}` | - |
| `deleteMany` | DELETE | `/{resource}/{id}`, one request per id | - |
| `send` | `params.method` | `/{resource}` | `params.query` as-is; body from `params.body` / `bodyType` |
| count (`CountRestDataProvider`, list calls only) | GET | `/{resource}/count` | `where = filter.where` + the same query keys |

Every call sends `requestCountData: RequestCountData.DATA_ONLY` (`'0'`). Every call's `type` is the matching `RequestTypes` constant (`GET_LIST`, `GET_ONE`, ... ); the count request uses `RequestTypes.SEND`.

## `getList` and `getManyReference`: building the filter

Both calls share one algorithm. The react-admin `filter` object is read in one of two ways:

- If `filter.where` exists, the whole `filter` is taken as-is. You are writing the IGNIS filter yourself.
- Otherwise every key of `filter` except `include`, `params`, `noLimit` and `fields` becomes `where`. Those four keys are lifted to the top level of the filter.

Then:

1. `sort.field` becomes `order: ["<field> <ASC|DESC>"]`.
2. Pagination: `limit = perPage`, `skip = offset = (page - 1) * perPage` - see `noLimit` below.
3. Any other truthy top-level key on `params` (anything that is not `pagination`, `sort`, `filter`, `meta`, and for `getManyReference` also not `target` or `id`) is copied into the filter under the same name.
4. `filter.params` is moved out into query keys and removed from the filter.
5. Every key of `meta` is added as a query key.

`getManyReference` additionally sets `where[target] = id` before sorting.

```ts
import { type IDataProvider } from '@venizia/ardor';

declare const dataProvider: IDataProvider;

// Flat filter: keys become `where`, include/fields are lifted.
// GET /products?filter={"where":{"status":"active"},"include":["category"],"fields":{"id":true,"name":true},"order":["name ASC"],"limit":20,"skip":0,"offset":0}
await dataProvider.getList('products', {
  pagination: { page: 1, perPage: 20 },
  sort: { field: 'name', order: 'ASC' },
  filter: { status: 'active', include: ['category'], fields: { id: true, name: true } },
});

// Explicit `where`: the filter object is sent verbatim, plus order/limit/skip/offset.
await dataProvider.getList('products', {
  pagination: { page: 2, perPage: 10 },
  sort: { field: 'createdAt', order: 'DESC' },
  filter: { where: { price: { gt: 100 } }, include: [{ relation: 'category' }] },
});

// Reference: where[target] = id
// GET /orders?filter={"where":{"customerId":"c-1","status":"paid"},...}
await dataProvider.getManyReference('orders', {
  target: 'customerId',
  id: 'c-1',
  pagination: { page: 1, perPage: 10 },
  sort: { field: 'createdAt', order: 'DESC' },
  filter: { status: 'paid' },
});
```

### `noLimit`

When `filter.noLimit` is truthy, `limit`, `skip`, `offset` and `noLimit` itself are all set to `undefined` and pagination is ignored. Use it to fetch a whole collection regardless of react-admin's default page size.

```ts
import { type IDataProvider } from '@venizia/ardor';

declare const dataProvider: IDataProvider;

// GET /categories?filter={"where":{},"order":["name ASC"]}
await dataProvider.getList('categories', {
  pagination: { page: 1, perPage: 25 },
  sort: { field: 'name', order: 'ASC' },
  filter: { noLimit: true },
});
```

### `filter.params` and `meta` as query keys

Anything under `filter.params` and anything under `meta` is sent as a top-level query parameter next to `filter`, not inside it. `filter.params` is removed from the filter afterwards.

```ts
import { type IDataProvider } from '@venizia/ardor';

declare const dataProvider: IDataProvider;

// GET /products?locale=vi&view=compact&filter={"where":{"status":"active"},"limit":20,"skip":0,"offset":0}
await dataProvider.getList('products', {
  pagination: { page: 1, perPage: 20 },
  filter: { status: 'active', params: { locale: 'vi' } },
  meta: { view: 'compact' },
});
```

## `getOne` and `getMany`

These read the IGNIS filter from `params.meta.filter`, not from `params.filter`. Only `meta.filter.params` becomes query keys; other `meta` keys are not used.

- `getOne`: `GET /{resource}/{id}?filter=<meta.filter without params>`.
- `getMany`: `GET /{resource}?filter=<meta.filter without params>` with `where` merged to `{ ...meta.filter.where, id: { inq: ids } }`.

```ts
import { type IDataProvider } from '@venizia/ardor';

declare const dataProvider: IDataProvider;

// GET /products/p-1?filter={"include":[{"relation":"category"}]}
await dataProvider.getOne('products', {
  id: 'p-1',
  meta: { filter: { include: [{ relation: 'category' }] } },
});

// GET /products?filter={"where":{"id":{"inq":["p-1","p-2"]}}}
await dataProvider.getMany('products', { ids: ['p-1', 'p-2'] });
```

## Write calls

- `create`: `POST /{resource}` with `params.data` as body.
- `update`: `PATCH /{resource}/{id}` with `params.data` as body. `previousData` is not sent.
- `updateMany`: `PATCH /{resource}?filter={"where":{"id":{"inq":[...]}}}` with `params.data` as body. Throws `[updateMany] No IDs to execute update!` when `ids` is empty.
- `delete`: `DELETE /{resource}/{id}`.
- `deleteMany`: one `DELETE /{resource}/{id}` per id, run with `Promise.all`; the result is `{ data: [<each response's data>] }`. Throws `[deleteMany] No IDs to execute delete!` when `ids` is empty.

```ts
import { type IDataProvider } from '@venizia/ardor';

declare const dataProvider: IDataProvider;

const created = await dataProvider.create('products', {
  data: { name: 'Lamp', status: 'draft' },
});

await dataProvider.update('products', {
  id: created.data.id,
  data: { status: 'active' },
  previousData: created.data,
});

await dataProvider.updateMany('products', { ids: ['p-1', 'p-2'], data: { status: 'archived' } });
await dataProvider.deleteMany('products', { ids: ['p-1', 'p-2'] });
```

## Totals

`DefaultRestDataProvider` never computes `total` itself. Its `getListHelper` returns the network service's response for `GET /{resource}` unchanged, so `total` is whatever the network layer derives from the response. The backend is expected to send a `content-range` header (`HeaderConsts.CONTENT_RANGE`) in the form `unit start-end/total`; parsing is described in [Network](../references/network).

`CountRestDataProvider` overrides `getListHelper` so that `getList` and `getManyReference` issue two requests in parallel:

1. `GET /{resource}?filter=...` (as above)
2. `GET /{resource}/count?where=<filter.where>` plus the same query keys

The result is `{ data: <first response>.data, total: <second response>.data.count ?? 0 }`. Use it when the backend exposes a `/count` endpoint instead of `content-range`. Every other method is inherited unchanged.

```ts
import {
  CountRestDataProvider,
  type IApplicationInfo,
  type IRestDataProviderOptions,
} from '@venizia/ardor';

const restDataProviderOptions: IRestDataProviderOptions = { url: 'https://api.example.com' };
const applicationInfo: IApplicationInfo = {
  name: 'shop-admin',
  version: '1.0.0',
  description: 'Shop administration',
};

const dataProvider = new CountRestDataProvider(restDataProviderOptions, applicationInfo).value(
  container,
);

// GET /products?filter={...}  and  GET /products/count?where={"status":"active"}
const { data, total } = await dataProvider.getList('products', {
  pagination: { page: 1, perPage: 20 },
  filter: { status: 'active' },
});
```

## `send()`: arbitrary endpoints

```ts no-check
class DefaultRestDataProvider<TResource extends string = string> {
  ...
  send<ReturnType = AnyType>(opts: {
    resource: TResource;
    params: ISendParams;
  }): Promise<ISendResponse<ReturnType>>;
}

interface ISendParams {
  id?: string | number;
  method?: TRequestMethod;          // required at runtime
  requestType?: TRequestType;       // default RequestTypes.SEND
  bodyType?: TRequestBodyType;      // 'none' | 'form-data' | 'x-www-form-urlencoded' | 'json' | 'binary'
  body?: any;
  file?: any;
  query?: { [key: string]: any };
  headers?: { [key: string]: string | number };
  requestCountData?: '0' | '1';     // RequestCountData.DATA_ONLY | DATA_WITH_COUNT
  [key: string]: any;
}

interface ISendResponse<T = AnyType> {
  data: T;
  [key: string]: any;
}
```

`send()` is for endpoints that are not plain CRUD. It:

- throws `[send] Invalid http method to send request!` when `method` is missing;
- passes `body`, `bodyType`, `requestCountData` and any other extra key to `networkService.getRequestProps(...)` together with the provider options and application info;
- merges `params.headers` on top of the computed headers, with every value converted to a string - a header you name wins;
- requests `/{resource}` with `params.method`, `params.query` as query parameters, and `params.requestType ?? RequestTypes.SEND` as type.

On the object returned by `value()`, `send` keeps the options-object shape: `dataProvider.send({ resource, params })`.

```ts
import {
  type IDataProvider,
  RequestBodyTypes,
  RequestCountData,
  RequestMethods,
} from '@venizia/ardor';

declare const dataProvider: IDataProvider;

// POST /products/export?format=csv
const exported = await dataProvider.send<{ url: string }>({
  resource: 'products/export',
  params: {
    method: RequestMethods.POST,
    bodyType: RequestBodyTypes.JSON,
    body: { status: 'active' },
    query: { format: 'csv' },
    headers: { 'x-export-version': 2 },
    requestCountData: RequestCountData.DATA_ONLY,
  },
});

exported.data.url;
```

## `getNetworkService()`

Returns the `DefaultNetworkRequestService` the provider built in its constructor. It is available both on the class and on the object returned by `value()`. Use it when a component or service needs the same base URL, auth rules and headers without going through react-admin's vocabulary. Its API is documented in [Network](../references/network).

```ts
import { type IDataProvider } from '@venizia/ardor';

declare const dataProvider: IDataProvider;

const networkService = dataProvider.getNetworkService();
```

## Common pitfalls

- **Omitting `pagination` sends `limit: 0`.** `page` and `perPage` default to `0`, and `perPage >= 0` sets `limit`. Pass `filter: { noLimit: true }` when you really want everything.
- **`filter.where` switches modes.** Once `where` is present the filter is sent verbatim. `include`, `fields` and other keys must then already be in their IGNIS positions; flat keys are no longer wrapped into `where`.
- **`getOne` and `getMany` ignore `params.filter`.** They only read `params.meta.filter`, and only `meta.filter.params` becomes query keys. Top-level `meta` keys are not sent for these two calls.
- **`send()` always targets `/{resource}`.** `params.id` is forwarded to `getRequestProps` but is not appended to the path. Put sub-paths into the resource string, for example `'products/export'`.
- **`send()` without `method` throws.** There is no default verb.
- **`updateMany` and `deleteMany` throw on an empty `ids` array.** Guard bulk actions in the UI.
- **`deleteMany` is N requests.** It fans out one `DELETE` per id and waits for all of them.
- **Extra truthy keys on list `params` leak into the filter.** Anything on `params` other than `pagination`, `sort`, `filter`, `meta` (and `target`/`id` for references) is copied into the filter as-is.
- **`DefaultRestDataProvider` has no `total` of its own.** If your backend does not send `content-range`, use `CountRestDataProvider` or expose a `/count` endpoint.
- **Two shapes, one class.** Class methods are `getList({ resource, params })`; the object from `value()` is `getList(resource, params)`. Only the latter is what react-admin and `useDataProvider` see.

## Related

- [Application](../references/application) - where the provider is registered and started
- [Binding keys](../references/binding-keys) - `CoreBindings.REST_DATA_PROVIDER_OPTIONS`, `CoreBindings.APPLICATION_INFO`
- [Network](../references/network) - `DefaultNetworkRequestService`, `getRequestProps`, `content-range`
- [Auth provider](../references/auth-provider) - who supplies the token that `useAuth` attaches
- [Types](../references/types) - `IRestDataProviderOptions`, `ISendParams`, `ICustomParams`, request constants
- [Migrating from ra-core-infra](../guides/migration/from-ra-core-infra)
