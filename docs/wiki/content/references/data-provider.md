---
title: REST data provider
description: Options, configuration, HTTP mapping, and error handling for DefaultRestDataProvider and IDataProvider in ARDOR.
---

# REST data provider

`DefaultRestDataProvider` maps react-admin data queries to REST HTTP requests against an IGNIS backend. The configuration class is the main way to configure ARDOR: a `@configuration()` class whose `@provide({ key })` methods return the options or the provider instances; `start()` binds each as a lazy SINGLETON:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  type IDataProvider,
  inject,
  type IRestDataProviderOptions,
  provide,
} from '@venizia/ardor';

@configuration()
export class RestDataConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return {
      url: 'https://api.example.com',
      noAuthPaths: ['/auth/sign-in'],
      requestTracingChannel: 'admin',
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider(): IDataProvider {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }
}
```

## What it does

`DefaultRestDataProvider` (`packages/admin/src/providers/rest-data.ts`) instantiates the default REST `IDataProvider`. For backends that query a separate count endpoint instead of `Content-Range`, see [CountRestDataProvider](../extensions/count-provider).

| Export | Kind | Purpose |
| --- | --- | --- |
| `DefaultRestDataProvider<TResource>` | class | Inversion-of-control provider that instantiates and configures the default REST `IDataProvider`. |
| `CountRestDataProvider<TResource>` | class | Subclass of `DefaultRestDataProvider` that queries `/{resource}/count` for list totals. |
| `IRestDataProviderOptions` | interface | Configuration options bound to `CoreBindings.REST_DATA_PROVIDER_OPTIONS`. |
| `INoAuthOptions` | interface | Base options for paths requested without an `Authorization` header. |
| `IDataProvider<TResource>` | interface | The twelve-method provider interface consumed by react-admin and ARDOR services. |
| `IReactAdminDataProvider<TResource>` | interface | The standard nine-method react-admin data provider interface. |
| `ISendParams` | interface | Parameters accepted by `IDataProvider.send()`. |
| `ISendResponse<T>` | interface | Response object returned by `IDataProvider.send()`. |
| `ICustomParams` | interface | Custom parameter dictionary supported on read operations via `params.params`. |
| `CoreBindings` | class | Container keys: `REST_DATA_PROVIDER_OPTIONS` and `DEFAULT_REST_DATA_PROVIDER`. |
| `RequestMethods` | class | HTTP method string constants (`GET`, `POST`, `PATCH`, `DELETE`, etc.). |
| `RequestBodyTypes` | class | Body serialization constants (`json`, `form-data`, `x-www-form-urlencoded`, `binary`, `none`). |
| `RequestCountData` | class | Count request constants (`DATA_ONLY`, `DATA_WITH_COUNT`). |

## Options

`IRestDataProviderOptions` extends `INoAuthOptions` to configure network connectivity, authentication exclusions, default headers, and token recovery. For custom token refresh workflows, see [Auth recovery](../best-practices/auth-recovery).

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `url` | `string` | (Required) | Base URL prepended to all resource request paths. |
| `noAuthPaths` | `Array<string>` | `undefined` | Exact resource path strings requested without an `Authorization` header and excluded from 401 refresh. Entries are compared by exact equality with the request resource as written, so a path written without the leading slash (such as `'auth/sign-in'`) does not match. |
| `noAuthPathRegex` | `string \| RegExp \| Array<string \| RegExp>` | `undefined` | Regular expression patterns matching resource paths that must omit `Authorization` headers. Set to `/./` to disable authentication on all paths. String patterns are compiled with `new RegExp(...)` and tested against both the resource string and the full joined URL path. |
| `headers` | `HeadersInit` | `undefined` | Default HTTP headers included on every network request. |
| `requestTracingChannel` | `string` | `'100_WEB'` | Channel name sent in the `x-request-channel` HTTP header. Defaults to `RequestChannel.WEB` (`'100_WEB'`). |
| `authRecovery` | `IAuthRecoveryOptions` | `undefined` | Recovery options. `authRecovery.refreshTokenPath` sets the path of the token refresh endpoint to prevent recursive 401 recovery loops. |

## Example

```ts
import { type IDataProvider } from '@venizia/ardor';
import { type RaRecord } from 'ra-core';

interface Product extends RaRecord {
  id: string;
  name: string;
  price: number;
  status: string;
}

export async function manageProducts(dataProvider: IDataProvider): Promise<void> {
  const listResult = await dataProvider.getList<Product>('products', {
    pagination: { page: 1, perPage: 10 },
    sort: { field: 'price', order: 'DESC' },
    filter: { status: 'active' },
  });

  const items = listResult.data;

  const created = await dataProvider.create<Omit<Product, 'id'>, Product>('products', {
    data: { name: 'Desk Lamp', price: 45, status: 'draft' },
  });

  await dataProvider.update<Product>('products', {
    id: created.data.id,
    data: { status: 'active' },
    previousData: created.data,
  });

  if (items.length > 0) {
    await dataProvider.updateMany<Product>('products', {
      ids: items.map((product) => product.id),
      data: { status: 'archived' },
    });
  }
}
```

## HTTP request and response mapping

| react-admin method | HTTP method | Path | Request body / query | Result conversion |
| --- | --- | --- | --- | --- |
| `getList` | `GET` | `/{resource}` | Query `filter` JSON string (`where`, `order`, `limit`, `skip`, `offset`, `include`, `fields`) plus query keys from `filter.params` and `meta`. Header `x-request-extra` from `meta.extra`. No body. | `{ data: RecordType[], total: number, meta?: { extra: ... } }`. `total` read from `Content-Range` header, falling back to `data.length`. |
| `getOne` | `GET` | `/{resource}/{id}` | Query `filter` JSON string containing `params.meta.filter` (without `params`), plus query keys from `meta.filter.params`. `params.filter` is ignored. No body. | `{ data: RecordType }` from JSON response body. |
| `getMany` | `GET` | `/{resource}` | Always a GET with the ids in `filter.where.id.inq` (query `filter` JSON string containing `{ ...meta.filter, where: { ...meta.filter.where, id: { inq: ids } } }` without `params`, plus query keys from `meta.filter.params`). A very long id list can answer 414 or 431. No body. | `{ data: RecordType[] }` from JSON response array. |
| `getManyReference` | `GET` | `/{resource}` | Same as `getList`, with `filter.where[target] = id`. Header `x-request-extra` from `meta.extra`. No body. | `{ data: RecordType[], total: number, meta?: { extra: ... } }`. `total` read from `Content-Range` header, falling back to `data.length`. |
| `create` | `POST` | `/{resource}` | JSON body `params.data`. No query. | `{ data: ResultRecordType }` containing the assigned `id`. |
| `update` | `PATCH` | `/{resource}/{id}` | JSON body `params.data`. `previousData` is not sent. No query. | `{ data: RecordType }` from JSON response body. |
| `updateMany` | `PATCH` | `/{resource}` | JSON body `{ ...params.data, where: { id: { inq: ids } } }`. No query. Throws if `ids` is empty or if `params.data` contains a `where` property. | `{ data: Identifier[] \| undefined }` mapped from returned row IDs (`toAffectedIds`). Returns `undefined` if response body is not an array. |
| `delete` | `DELETE` | `/{resource}/{id}` | No body. No query. | `{ data: RecordType }` from JSON response body. |
| `deleteMany` | `DELETE` | `/{resource}` | JSON body `{ where: { id: { inq: ids } } }`. No query. Throws if `ids` is empty. | `{ data: Identifier[] \| undefined }` mapped from returned row IDs (`toAffectedIds`). Returns `undefined` if response body is not an array. |

> [!NOTE]
> `updateMany` and `deleteMany` send row selectors in the request body rather than the URL query string to avoid HTTP 414 and 431 errors on long ID lists. Backend endpoints handling bulk operations must support body-based selectors.

## Filter and pagination encoding

`getList` and `getManyReference` build filter parameters through the protected method `buildListFilter({ params })` in `packages/admin/src/providers/rest-data.ts`:
- **Filter modes**: If `params.filter.where` is defined, the filter is treated as an explicit IGNIS filter and sent as `{ ...filterInput, where: { ...filterInput.where } }`. Otherwise, flat keys in `params.filter` become properties in `where`, except `include`, `fields`, `params`, and `noLimit`, which are lifted to the top level of the filter.
- **Sorting**: `params.sort.field` is serialized to `order: ["<field> <order>"]` (for example, `["price DESC"]`).
- **Pagination**: By default, `limit` is set to `perPage`, and `skip` and `offset` are set to `(page - 1) * perPage`. If `params.filter.noLimit` is truthy, `limit`, `skip`, `offset`, and `noLimit` are set to `undefined`, disabling pagination.
- **Top-level query parameters**: Parameters in `params.filter.params` and `params.meta` (excluding `meta.extra`) are moved out of the JSON filter payload and appended directly as top-level query parameters.
- **Extra parameters**: In `buildListFilter`, every other defined key of `params` (everything except `pagination`, `sort`, `filter`, `meta`) is copied into the filter; for `getManyReference`, `target` and `id` are taken out first and become `where[target] = id`.
- **Totals**: The provider parses collection totals from the HTTP `Content-Range` header formatted as `<unit> <range-start>-<range-end>/<total>` (for example, `records 0-19/120`). If the header is absent or non-numeric (such as `records 0-19/*`), `total` defaults to the page row count (`data.length`). When a backend provides a dedicated count route instead of `Content-Range`, use `CountRestDataProvider` (see [CountRestDataProvider](../extensions/count-provider)).

## Extended provider methods

`IDataProvider` extends react-admin's nine data methods with exactly three more: `send`, `getNetworkService`, `getDataSourceAuth`:
1. `send<ReturnType = AnyType>(opts: { resource: TResource; params: ISendParams }): Promise<ISendResponse<ReturnType>>`: Issues arbitrary HTTP requests through the configured network transport with automatic authorization, tracing, and 401 refresh.
2. `getNetworkService(): DefaultNetworkRequestService`: Returns the underlying `DefaultNetworkRequestService` to configure dynamic headers, inspect the base URL, or execute direct network requests.
3. `getDataSourceAuth(): IDataSourceAuth`: Returns authentication resolvers (`authTokenResolver`, `headersResolver`, `onUnauthorized`, `errorRootKey`) to configure an `HttpDataSource` in a repository so it shares headers, token, and 401 refresh with the data provider.

```ts
import {
  type IDataProvider,
  RequestBodyTypes,
  RequestCountData,
  RequestMethods,
} from '@venizia/ardor';

export async function exportProducts(dataProvider: IDataProvider): Promise<string> {
  const response = await dataProvider.send<{ downloadUrl: string }>({
    resource: 'products/export',
    params: {
      method: RequestMethods.POST,
      bodyType: RequestBodyTypes.JSON,
      body: { format: 'csv' },
      query: { notify: 'true' },
      requestCountData: RequestCountData.DATA_ONLY,
    },
  });

  return response.data.downloadUrl;
}

export function configureNetwork(dataProvider: IDataProvider): void {
  const networkService = dataProvider.getNetworkService();
  networkService.setHeaders({ headers: { 'x-tenant-id': 'tenant-42' } });

  const dataSourceAuth = dataProvider.getDataSourceAuth();
  if (dataSourceAuth.errorRootKey !== 'error') {
    throw new Error('Unexpected error root key');
  }
}
```

## Error handling

When the backend responds with an HTTP status outside the 200-299 range:
1. `DefaultNetworkRequestService` in `packages/kernel/src/base/services/network-request.ts` unwraps the response payload using the `'error'` root key (`HttpResponseReader.readError`).
2. The service creates an application error via `getError` with:
   - `statusCode`: HTTP status code from `response.status` (for example, 400, 401, 403, 404, 500).
   - `message`: `server.normalized?.text ?? server.message ?? \`HTTP ${response.status}\``. This provides the user-facing error message displayed by react-admin notifications.
   - `messageCode`: Server error code from `server.normalized?.code` (for example, `ERR_NOT_FOUND`).
   - `messageArgs`: Localization arguments from `server.normalized?.args`.
   - `extra`: Dictionary containing `extra.requestId` (assigned from `server.requestId`, preserving any upstream request ID in `extra.upstreamRequestIds`), or `undefined` if empty.
   - `cause`: Underlying server cause details from `server.details?.cause`.
3. React-admin catches the thrown error and forwards it to `authProvider.checkError(error)`.
4. `DefaultAuthProvider.checkError` inspects `error?.status ?? error?.statusCode`. If status is 401, it clears local session storage (`DefaultAuthService.cleanUp()`) and rejects with `{ redirectTo: this.loginPagePath }`, prompting react-admin to redirect the user to the login screen. If status is 403, it rejects with `{ redirectTo: this.unauthorizedPagePath, logoutUser: false }`.
