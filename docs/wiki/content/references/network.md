---
title: Network service
description: DefaultNetworkRequestService - HTTP transport, headers, timeouts, 401 token recovery, and repository data source authentication.
---

# Network service

ARDOR sends HTTP requests through `DefaultNetworkRequestService`, which wraps the platform `fetch` API. It builds headers, formats request bodies, parses responses, coordinates 401 token refresh, and shares authentication state with repository data sources.

```ts
import {
  CoreBindings,
  type IDataProvider,
  inject,
  RequestCountData,
  RequestMethods,
  RequestTypes,
  service,
} from '@venizia/ardor';

export interface AuditReport {
  id: string;
  filename: string;
  generatedAt: string;
  recordCount: number;
}

@service()
export class AuditReportService {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    private readonly dataProvider: IDataProvider,
  ) {}

  async exportAuditLog(category: string): Promise<AuditReport> {
    const networkService = this.dataProvider.getNetworkService();

    networkService.setHeaders({
      headers: {
        'x-client-scope': 'audit-logs',
      },
    });

    const response = await networkService.doRequest<AuditReport>({
      type: RequestTypes.SEND,
      method: RequestMethods.POST,
      paths: ['/audit/export'],
      body: JSON.stringify({ category }),
      headers: {
        'content-type': 'application/json',
      },
      requestCountData: RequestCountData.DATA_ONLY,
    });

    return response.data;
  }
}
```

## What it does

| Export | Kind | Purpose |
|---|---|---|
| `DefaultNetworkRequestService` | class | Core HTTP request service handling headers, bodies, response parsing, and 401 recovery |
| `NodeFetchNetworkRequest` | class | The IGNIS transport helper (`@venizia/ignis-helpers/core`) `DefaultNetworkRequestService` sends through: standard `fetch` with timeout and abort support |
| `NetworkHeaders` | class | Header transformation and case-insensitive merge utilities |
| `HeaderConstants` | class | Standard HTTP header name constants used across ARDOR |
| `RequestBodyTypes` | class | Supported body format constants (`JSON`, `FORM_DATA`, `FORM_URL_ENCODED`, etc.) |
| `RequestMethods` | class | HTTP method constants (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc.) |
| `RequestTypes` | class | React-admin and kernel request type constants |
| `RequestCountData` | class | Flag constants for count responses (`DATA_ONLY`, `DATA_WITH_COUNT`) |
| `RequestChannel` | class | Default channel constant (`WEB`) |
| `LocalStorageKeys` | class | Local storage key constants including `KEY_AUTH_TOKEN` |
| `IAuthTokenRecord` | interface | Authentication token structure (`value`, `type`, `provider`) |
| `IDataSourceAuth` | interface | Authentication configuration shared with an `HttpDataSource` |
| `IDataSourceRequestContext` | interface | Request path context passed to data source auth resolvers |
| `INoAuthOptions` | interface | Options defining path strings and regex patterns that bypass authentication |
| `IAuthRecoveryOptions` | interface | Authentication recovery configuration (`refreshTokenPath`) |
| `IGetRequestPropsParams` | interface | Input parameters passed to `getRequestProps` |
| `IGetRequestPropsResult` | interface | Normalized headers and body returned by `getRequestProps` |

## How to provide it

`DefaultNetworkRequestService` is not bound directly under its own container key. Instead, the REST data provider (`DefaultRestDataProvider`, bound under `CoreBindings.DEFAULT_REST_DATA_PROVIDER`) instantiates it in its protected `createNetworkService()` method and caches it. Callers access the service via `dataProvider.getNetworkService()`.

The data provider constructs the service using options injected from `CoreBindings.REST_DATA_PROVIDER_OPTIONS`:
- `url` becomes `baseUrl`
- `headers` becomes base headers
- `noAuthPaths` and `noAuthPathRegex` configure unauthenticated endpoints
- `authRecovery` configures token refresh exclusion paths

To supply custom network behavior - such as handling token refresh or in-memory credentials - subclass `DefaultNetworkRequestService` and override `createNetworkService()` on a `DefaultRestDataProvider` subclass (see [Auth recovery](../best-practices/auth-recovery) and [Data provider](./data-provider)).

The configuration relies on the following defaults and container keys:
- Default class: `DefaultNetworkRequestService`, instantiated by `DefaultRestDataProvider` in `packages/admin/src/providers/rest-data.ts`.
- Options key: `CoreBindings.REST_DATA_PROVIDER_OPTIONS` (`@app/application/options/rest/data`).
- Provider key: `CoreBindings.DEFAULT_REST_DATA_PROVIDER` (`@app/application/data/rest/default`).

## Options

`DefaultNetworkRequestService` accepts constructor options conforming to `INoAuthOptions & { name: string; baseUrl?: string; headers?: HeadersInit; authRecovery?: IAuthRecoveryOptions }`. In standard ARDOR applications, these options are configured through `IRestDataProviderOptions` and passed by the data provider to the network service.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | `string` | *(required)* | Identifier scope used for logger tagging and the underlying `NodeFetchNetworkRequest` transport instance. In `DefaultRestDataProvider`, this defaults to `'default-application-network-service'`. |
| `baseUrl` / `url` | `string` | `''` | Base endpoint URL prepended to all request paths. Trailing slashes are automatically stripped. In `IRestDataProviderOptions`, this is specified as `url`. |
| `headers` | `HeadersInit` | `{}` | Base headers included in every HTTP request. Keys are converted to lowercase and merged with runtime headers. |
| `noAuthPaths` | `string[]` | `undefined` | Exact resource path strings that bypass the `Authorization` header. Entries are compared as written, matching the leading slash of paths like `'/auth/sign-in'`. |
| `noAuthPathRegex` | `string \| RegExp \| Array<string \| RegExp>` | `undefined` | Regular expression pattern or patterns tested against `resource` or joined paths to bypass authorization. String patterns are compiled via `new RegExp`. Set to `/./` to bypass authorization on all endpoints. |
| `authRecovery.refreshTokenPath` | `string` | `undefined` | Endpoint path substring that is excluded from 401 recovery retries to prevent recursive refresh loops. |
| `requestTracingChannel` | `string` | `RequestChannel.WEB` (`'100_WEB'`) | Channel identifier sent in the `x-request-channel` header when `getRequestProps` prepares request options from `IRestDataProviderOptions`. |

## Fetch transport and timeout

ARDOR uses standard platform `fetch` through the IGNIS `NodeFetchNetworkRequest` (`@venizia/ignis-helpers/core`); it keeps no copy of it. `DefaultNetworkRequestService` holds one (`protected networkRequest`, constructed in its constructor at `packages/kernel/src/base/services/network-request.ts`) with `queryString: { nullish: 'skip', nested: 'json' }`, so a filter object is sent as one JSON parameter and a `null` is left out.

- `getNetworkService()` returns the fetcher, whose `send` resolves a `Response`.
- `getWorker()` returns the global `fetch` function.

For non-HTTP transports such as WebSockets or custom protocols, see [Custom transport](../extensions/custom-transport).

The fetcher handles request timeouts. If a `timeout` value in milliseconds is provided, it creates an `AbortController` and schedules a timer, combined with the caller's `signal`. If the request does not complete within the specified duration, the request is aborted and `fetch` rejects with an `AbortError`. The timer is cleared in a `finally` block:

```ts
import { NodeFetchNetworkRequest } from '@venizia/ignis-helpers/core';

export async function requestWithTimeout(): Promise<number> {
  const transport = new NodeFetchNetworkRequest({
    name: 'custom-transport',
    networkOptions: { baseUrl: 'https://api.example.com' },
  });

  const service = transport.getNetworkService();
  const response = await service.send({
    url: 'https://api.example.com/health',
    timeout: 3000,
  });

  return response.status;
}
```

## Headers and token resolution

`DefaultNetworkRequestService` manages headers through the `NetworkHeaders` utility class in `packages/kernel/src/helpers/networks/headers.ts`. All header keys are normalized to lowercase by `NetworkHeaders.toRecord` and merged by `NetworkHeaders.merge`, ensuring later values replace earlier values without case collisions.

Headers are assembled in layers:
1. **Base and session headers:** Constructed from constructor `headers` and dynamic headers added via `setHeaders({ headers })` (or removed via `removeHeaders({ keys })`). Session headers automatically include `timezone` (`App.TIMEZONE`) and `timezone-offset` (`App.TIMEZONE_OFFSET`).
2. **Locale header:** The `useRequestHeaderLocale` hook connects react-admin locale state with the network service, executing `networkService.setHeaders({ headers: { [HeaderConstants.X_LOCALE]: locale } })` so that subsequent requests include the active locale.
3. **Tracing headers:** `x-request-channel` is set to `restDataProviderOptions.requestTracingChannel` (default `RequestChannel.WEB` which is `'100_WEB'`). `x-request-id` is generated via `buildRequestTracingId({ applicationInfo })`, defaulting to `${applicationInfo.name}_${uuidV4()}`.
4. **Authorization header:** When `isNoAuthPath({ resource })` returns `false`, `getRequestAuthorizationHeader()` retrieves the authentication token via the protected `resolveAuthToken()` hook. By default, `DefaultNetworkRequestService.readAuthTokenFromStorage()` reads `LocalStorageKeys.KEY_AUTH_TOKEN` (`@app/auth/token`) from `localStorage`. The header is set as `${type ?? 'Bearer'} ${value}`. If `provider` is defined on the token record, an `x-auth-provider` header is attached.

If an endpoint path matches an entry in `noAuthPaths` or matches a pattern in `noAuthPathRegex`, the `Authorization` header is omitted:

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

export function configureHeaders(): Record<string, string> {
  const network = new DefaultNetworkRequestService({
    name: 'api',
    baseUrl: 'https://api.example.com',
    noAuthPaths: ['/auth/sign-in'],
    noAuthPathRegex: [/^public\//],
  });

  network.setHeaders({ headers: { 'x-tenant-id': 'tenant-42' } });
  network.removeHeaders({ keys: ['x-tenant-id'] });

  return network.getRequestHeader({ resource: '/auth/sign-in' });
}
```

## Error handling and 401 recovery

When a response returns a non-2xx HTTP status, `DefaultNetworkRequestService.doRequest` throws an `ApplicationError` created via `getError` by `ResponseReader.toError` in `packages/kernel/src/helpers/networks/response-reader.ts`. The error body is parsed using `HttpResponseReader.readError` with root key `'error'`:
- `error.statusCode`: The HTTP status code of the response.
- `error.message`: Server normalized text, server message, or `'HTTP ' + response.status`.
- `error.normalized`: Server normalized details containing `text`, `code` (`error.normalized.code`, defaulting to `'core.system_error'`), and interpolation arguments `args` (`error.normalized.args`).
- `error.extra`: Server extra metadata, including `requestId` and `upstreamRequestIds`.
- `error.cause`: Underlying cause details (`server.details?.cause`).

When a request receives a 401 Unauthorized status, `doRequest` triggers token recovery if `AuthRecovery.canRecover({ paths })` returns `true`:
- The resource must not match `noAuthPaths` or `noAuthPathRegex`.
- The path must not contain `authRecovery.refreshTokenPath`.

Recovery calls `refresh()`, which delegates to the protected `refreshToken()` hook:
- Concurrent requests share a single in-flight promise (`AuthRecovery.refresh`), preventing duplicate refresh calls.
- If `refreshToken()` resolves `true`, `doRequest` retrieves updated authorization headers and retries the original request once.
- If `refreshToken()` resolves `false` (the default behavior), no retry is attempted and the 401 error is thrown.
- If `refreshToken()` throws, `onAuthFailure()` runs, and the original 401 error is thrown.

## Repository data source authentication

`DefaultNetworkRequestService.prototype.getDataSourceAuth(opts)` provides an `IDataSourceAuth` configuration object. `DefaultRestDataProvider.prototype.getDataSourceAuth()` forwards this to repository data sources (`HttpDataSource` in `@venizia/ardor/repository`), ensuring repository queries share the exact authentication, headers, and refresh handling of the data provider.

The hand-off implements four properties defined in `packages/kernel/src/base/services/network-request.ts`:
- `authTokenResolver`: Resolves the authentication token via `resolveAuthToken()`, or returns `undefined` for paths matching `isNoAuthPath`.
- `headersResolver`: Merges session headers (`timezone`, `timezone-offset`, dynamic headers) with tracing headers (`x-request-channel`, `x-request-id`).
- `onUnauthorized`: Coordinates 401 recovery using the same shared `refresh()` method so data provider calls and repository requests share a single refresh attempt.
- `errorRootKey`: Configured to `'error'` to match IGNIS server error payloads.

```ts
import {
  CoreBindings,
  type IDataProvider,
  inject,
} from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

export class AppDataSource extends HttpDataSource {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    dataProvider: IDataProvider,
  ) {
    super({
      baseUrl: 'https://api.example.com',
      ...dataProvider.getDataSourceAuth(),
    });
  }
}
```

For more details on repositories and data sources, see [Repositories](./repository), [Data provider](./data-provider), [Auth provider](./auth-provider), and [Auth recovery](../best-practices/auth-recovery).
