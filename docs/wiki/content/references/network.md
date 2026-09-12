---
title: Network layer
description: DefaultNetworkRequestService - request headers, the authorization token source, no-auth paths, body types, response parsing, error shape, count modes, 401 recovery, and the fetchers underneath.
---

# Network layer

`DefaultNetworkRequestService` is the HTTP layer of the ARDOR kernel. It builds headers, formats the body, sends the request through a `NodeFetchNetworkRequest`, parses the response, and recovers from a 401 once. Everything on this page is what the class does today - options are objects, never positional.

## Prerequisites

A runtime with global `fetch`, `Headers`, `FormData`, `URLSearchParams`, `localStorage` and `crypto.randomUUID` - a browser, or Node 18+ with a `localStorage` shim if you call the authenticated path.

## Quick Reference

| Export | Kind | Role |
|---|---|---|
| `DefaultNetworkRequestService` | class | The request service: headers, body, send, parse, recover |
| `INoAuthOptions` | interface | `useAuth`, `noAuthPaths`, `noAuthPathRegex` constructor options |
| `TNoAuthPathRegex` | type | One `RegExp \| string` or an array of them |
| `IAuthRecoveryOptions` | interface | `refreshToken`, `refreshTokenPath`, `onAuthFailure` |
| `IGetRequestPropsParams` / `IGetRequestPropsResult` | interface | Input and output of `getRequestProps` |
| `HeaderConsts` | class | Header names and the content-type / attachment regexes |
| `RequestBodyTypes` | class | `JSON`, `FORM_DATA`, `FORM_URL_ENCODED`, `NONE`, `BINARY` |
| `RequestCountData` | class | `DATA_ONLY` (`'0'`), `DATA_WITH_COUNT` (`'1'`) |
| `RequestChannel` | class | `WEB` (`'100_WEB'`), the default `x-request-channel` |
| `RequestMethods` / `RequestTypes` | class | HTTP methods and react-admin request types |
| `LocalStorageKeys` | class | `KEY_AUTH_TOKEN`, where the stored token is read from |
| `App` | class | `TIMEZONE` and `TIMEZONE_OFFSET` sent on every request |
| `BaseNetworkRequest` | class | Base helper: `getRequestUrl`, `getNetworkService`, `getWorker` |
| `NodeFetchNetworkRequest` / `NodeFetcher` | class | The default `fetch` based transport |
| `AxiosNetworkRequest` / `AxiosFetcher` | class | The axios based transport, not used by the service |

## Constructing the service

```ts
import type { IAuthRecoveryOptions, INoAuthOptions } from '@venizia/ardor';

declare class DefaultNetworkRequestService {
  constructor(opts: INoAuthOptions & {
    name: string;
    baseUrl?: string;          // default ''
    headers?: HeadersInit;     // default {}
    authRecovery?: IAuthRecoveryOptions;
  });
}
```

`headers` may be a plain record, a `Headers` instance or a tuple list; the service keeps a plain record. `useAuth` defaults to `true`. The constructor creates one `NodeFetchNetworkRequest` named `name` for the given `baseUrl`.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  headers: { 'x-app-version': '1.0.0' },
  noAuthPaths: ['auth/login'],
});
```

## Request headers

`getRequestHeader({ resource })` builds the base set. `getRequestProps` adds the tracing headers and the content type on top of it.

| Header | Value | Set by |
|---|---|---|
| `Timezone` | `App.TIMEZONE` - `Intl.DateTimeFormat().resolvedOptions().timeZone` | `getRequestHeader` |
| `Timezone-Offset` | `App.TIMEZONE_OFFSET` as a string - hours east of UTC, so `7` or `-5` | `getRequestHeader` |
| custom headers | constructor `headers` merged with `setHeaders` | `getRequestHeader` |
| `authorization` | `<type> <value>` from the token source below | `getRequestHeader`, skipped on no-auth paths |
| `x-auth-provider` | `provider` from the stored token object | `getRequestHeader`, skipped on no-auth paths |
| `x-request-channel` | `restDataProviderOptions.requestTracingChannel`, else `RequestChannel.WEB` (`'100_WEB'`) | `getRequestProps` |
| `x-request-count` | `requestCountData`, default `RequestCountData.DATA_ONLY` (`'0'`) | `getRequestProps` |
| `x-request-id` | `restDataProviderOptions.requestTracingId({ applicationInfo })` when it is a function, else `${applicationInfo.name}_${crypto.randomUUID()}` | `getRequestProps` |
| `content-type` | depends on the body type, see below | `getRequestProps` |

Custom headers are spread after the two timezone headers, so a custom `Timezone` header wins.

```ts
import type { IGetRequestPropsParams, IGetRequestPropsResult } from '@venizia/ardor';

declare class DefaultNetworkRequestService {
  getRequestHeader(opts: { resource: string }): Record<string, string>;
  getRequestProps(params: IGetRequestPropsParams): IGetRequestPropsResult;
}
```

## The authorization header and where the token comes from

```ts no-check
declare class DefaultNetworkRequestService {
  getRequestAuthorizationHeader(): { provider: string | undefined; token: string };
  setAuthToken(opts: { type?: string; value: string }): void;
}
```

The token is resolved in this order:

1. The in-memory token set with `setAuthToken({ type, value })`.
2. Otherwise `localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)`, parsed as JSON. The stored object may carry `type`, `value` and `provider`.

If neither has a `value`, the method throws an error with `statusCode: 401` and the request is never sent. `type` defaults to `Bearer`, so the header reads `Bearer <value>`. Note that `localStorage` is read first in every call, even when an in-memory token exists.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
});

network.setAuthToken({ value: 'eyJhbGciOi...' });
network.getRequestAuthorizationHeader().token; // 'Bearer eyJhbGciOi...'
```

`setAuthToken` has no `provider` field, so `x-auth-provider` is `undefined` for an in-memory token. Only the stored JSON object can supply it.

## No-auth paths

```ts
import type { TNoAuthPathRegex } from '@venizia/ardor';

declare class DefaultNetworkRequestService {
  isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean;
  setUseAuth(useAuth: boolean): void;
  setNoAuthPaths(noAuthPaths?: string[]): void;
  setNoAuthPathRegex(noAuthPathRegex?: TNoAuthPathRegex): void;
}
```

`isNoAuthPath` returns `true` when any of these hold, checked in order:

1. `useAuth` is `false` - every path is a no-auth path.
2. `resource` is an exact entry of `noAuthPaths`.
3. One of the `noAuthPathRegex` patterns matches `resource` or `paths.join('/')`. Strings are compiled with `new RegExp`; an invalid pattern is logged with `console.error` and dropped. `lastIndex` is reset before each test, so global regexes are safe.

`getRequestHeader` calls it with `{ resource }` only. The 401 recovery path calls it with `{ resource: paths[0], paths }`.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  noAuthPaths: ['auth/login'],
  noAuthPathRegex: [/^public\//, 'health$'],
});

network.isNoAuthPath({ resource: 'auth/login' }); // true - exact entry
network.isNoAuthPath({ resource: 'public', paths: ['public', 'banners'] }); // true - regex on 'public/banners'
network.isNoAuthPath({ resource: 'users' }); // false
```

## setHeaders and removeHeaders

```ts no-check
declare class DefaultNetworkRequestService {
  setHeaders(headers: HeadersInit): void;   // lodash merge into the current record
  removeHeaders(keys: string[]): void;      // delete by exact key
}
```

Keys are stored as given - `removeHeaders` does not normalise case, so remove the key with the same spelling you set it with.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  noAuthPaths: ['auth/login'],
});

network.setHeaders({ 'x-locale': 'vi', 'x-tenant': 'acme' });
network.removeHeaders(['x-tenant']);
network.getRequestHeader({ resource: 'auth/login' });
// { Timezone: ..., 'Timezone-Offset': ..., 'x-locale': 'vi' }
```

## Body types

`getRequestProps` switches on `bodyType`:

| `bodyType` | `content-type` header | Body sent |
|---|---|---|
| `RequestBodyTypes.JSON`, `NONE`, `BINARY`, or omitted | `application/json` | `body` unchanged; `NodeFetcher` runs `JSON.stringify` on it |
| `RequestBodyTypes.FORM_URL_ENCODED` (`'x-www-form-urlencoded'`) | `application/x-www-form-urlencoded` | `URLSearchParams`; falsy values are skipped, others go through `String()` |
| `RequestBodyTypes.FORM_DATA` (`'form-data'`) | not set - the runtime adds the boundary | `FormData`; each value is a `File`, `File[]` or `FileList`, appended with `item.name`; falsy values are skipped |

`doRequest` drops the body when `method` is `RequestMethods.GET`.

```ts
import { DefaultNetworkRequestService, RequestBodyTypes } from '@venizia/ardor';
import type { IApplicationInfo, IRestDataProviderOptions } from '@venizia/ardor';

declare const file: File;
declare const fileList: FileList;
declare const restDataProviderOptions: IRestDataProviderOptions; // tracing id and channel
declare const applicationInfo: IApplicationInfo;                 // its name prefixes x-request-id

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
});

const props = network.getRequestProps({
  resource: 'users/upload',
  bodyType: RequestBodyTypes.FORM_DATA,
  body: { avatar: file, documents: fileList },
  restDataProviderOptions,
  applicationInfo,
});
// props.headers has no content-type; props.body is a FormData
```

## Sending a request

```ts
import { RequestCountData } from '@venizia/ardor';
import type { IGetRequestPropsResult, TConstValue, TRequestMethod, TRequestType } from '@venizia/ardor';

declare class DefaultNetworkRequestService {
  doRequest<ReturnType>(opts: IGetRequestPropsResult & {
    baseUrl?: string;                 // default: constructor baseUrl
    query?: any;                      // serialised to the query string
    type: TRequestType;
    method: TRequestMethod;
    paths: string[];
    requestCountData?: TConstValue<typeof RequestCountData>;
  }): Promise<{
    data: ReturnType;
    count?: number;
    total?: number;                   // GET_LIST and GET_MANY_REFERENCE only
    filename?: string;                // attachments only
    contentDisposition?: string;      // attachments only
  }>;
}
```

Steps: throw if `baseUrl` is empty, build the URL with `getRequestUrl({ baseUrl, paths })`, send once, run the 401 recovery described below, throw on any non-2xx status, then parse. `headers` are sent exactly as given - `doRequest` does not call `getRequestProps` for you.

```ts
import { DefaultNetworkRequestService, RequestMethods, RequestTypes } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
});

async function createUser(name: string) {
  return network.doRequest<{ id: number; name: string }>({
    type: RequestTypes.CREATE,
    method: RequestMethods.POST,
    paths: ['users'],
    headers: {
      ...network.getRequestHeader({ resource: 'users' }),
      'content-type': 'application/json',
    },
    body: { name },
  });
}
```

## Response parsing

For a 2xx response:

| Condition | Result |
|---|---|
| status `204` | `{ data: {} }` - the body is not read |
| `content-disposition` starts with `attachment`, or `content-type` is missing or does not match `HeaderConsts.TEXTUAL_CONTENT_TYPE_RE` | `{ data: Blob, filename?, contentDisposition? }` |
| otherwise | `response.json()` passed to `convertResponse` |

`TEXTUAL_CONTENT_TYPE_RE` accepts `application/json`, `*+json`, `application/xml`, `*+xml`, `application/x-www-form-urlencoded`, `application/javascript`, `application/graphql` and anything under `text/`. The check is case-insensitive.

`filename` is read from `content-disposition` in this order: `filename*=<charset>'<lang>'<value>` (URI-decoded, falling back to the raw value), `filename="quoted"`, then bare `filename=value`. It is only present on the result when a name was found.

## Error shape on non-2xx

When the final status is outside `200..299`, `doRequest` reads the body as JSON and throws:

```ts
// What `doRequest` throws for a non-2xx response, given the parsed JSON body:
const toThrownError = (body: Record<string, unknown> | null): unknown => {
  return body?.error ?? body;
};

toThrownError({ error: { message: 'Not found', statusCode: 404 } }); // -> the inner `error`
toThrownError({ message: 'Validation failed' }); // -> the whole body
```

So a server body `{ error: { message, statusCode } }` throws the inner `error` object, and any other JSON body is thrown as-is. The `Response` object is not attached. The body is read with `response.json()`, so a non-JSON error body turns into a parse error instead.

## requestCountData modes

`requestCountData` is sent as `x-request-count` and drives `convertResponse`:

```ts
import { RequestCountData } from '@venizia/ardor';
import type { TConstValue } from '@venizia/ardor';

declare class DefaultNetworkRequestService {
  convertResponse<TData>(opts: {
    response: { data: TData | { data: TData; count?: number }; headers: Record<string, any> };
    type: string;
    requestCountData?: TConstValue<typeof RequestCountData>;
  }): { data: TData; count?: number; total?: number };
}
```

| `type` | `DATA_ONLY` (`'0'`, default) | `DATA_WITH_COUNT` (`'1'`) |
|---|---|---|
| `GET_LIST`, `GET_MANY_REFERENCE` | body wrapped in an array if it is not one; `total` = last segment of `content-range`, else the array length | body must be `{ data, count }` or an error is thrown; `data` wrapped in an array if needed; `count` = body `count` else array length; `total` from `content-range` as on the left |
| every other type | `data` = body; `count` = `parseInt(x-response-count)` - `NaN` when the header is absent | body returned as-is, no validation |

`content-range` follows `<unit> <start>-<end>/<total>`; only the `<total>` after the last `/` is parsed. `response.headers` must expose `.get()`, which the `fetch` `Headers` object does.

## Auth recovery

```ts
import type { IAuthRecoveryOptions } from '@venizia/ardor';

declare class DefaultNetworkRequestService {
  setAuthRecovery(authRecovery: Partial<IAuthRecoveryOptions>): void;   // shallow merge
  getAuthRecovery(): IAuthRecoveryOptions | undefined;
}
```

When the first send returns `401`, `doRequest` recovers only if all of these hold:

- `authRecovery.refreshToken` is set,
- `isNoAuthPath({ resource: paths[0], paths })` is `false`,
- `paths.join('/')` does not contain `authRecovery.refreshTokenPath`, when one is configured.

Then:

1. `ensureRefreshed` runs `refreshToken()` inside `Promise.resolve().then(...)`. The promise is stored on the instance, so every 401 that arrives while a refresh is in flight awaits the same one. It is cleared in `finally`.
2. If `refreshToken` resolves, the service calls `getRequestAuthorizationHeader()` again, replaces `authorization` and `x-auth-provider` on the original headers, and sends exactly once more. A second 401 is thrown like any other non-2xx.
3. If `refreshToken` throws or rejects, `onAuthFailure` is awaited (its own errors are logged and swallowed), the refresh resolves to `false`, and the original 401 body is thrown.

`refreshToken` must leave the new token where step 2 will find it - `setAuthToken` if you use in-memory tokens, otherwise `localStorage` under `LocalStorageKeys.KEY_AUTH_TOKEN`. An in-memory token always shadows the stored one.

```ts
import { DefaultNetworkRequestService, LocalStorageKeys } from '@venizia/ardor';

declare function fetchNewAccessToken(): Promise<string>; // your call to auth/refresh

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  authRecovery: {
    refreshTokenPath: 'auth/refresh',
    refreshToken: async () => {
      const next = await fetchNewAccessToken();
      network.setAuthToken({ value: next });
    },
    onAuthFailure: () => {
      localStorage.removeItem(LocalStorageKeys.KEY_AUTH_TOKEN);
    },
  },
});
```

## Fetchers

`DefaultNetworkRequestService` always constructs a `NodeFetchNetworkRequest`; `AxiosNetworkRequest` exists for helpers you build yourself. Both extend `BaseNetworkRequest<T>` and expose `getNetworkService()` (the fetcher) and `getWorker()` (the underlying `fetch` or axios worker).

**`NodeFetcher`** - `send(opts: INodeFetchRequestOptions)`:

- `params` is appended as `?` + `stringify(params)`.
- `body` is passed through when it is a `FormData` or `URLSearchParams`, otherwise `JSON.stringify(body)`.
- `headers` from the call replace the default headers entirely; the default `content-type: application/json; charset=utf-8` only applies when no headers are passed.
- `timeout` creates an `AbortController` and aborts after that many milliseconds; the timer is cleared in `finally`.
- It returns the raw `Response` - non-2xx statuses do not throw here.

**`AxiosNetworkRequest`** wraps `AxiosFetcher` with `baseURL`, a `60 * 1000` ms default timeout, `withCredentials: false`, a default `content-type: application/json; charset=utf-8`, and `validateStatus: status < 500`. Its `IAxiosNetworkOptions` extra keys are forwarded to axios.

## BaseNetworkRequest.getRequestUrl

```ts no-check
declare class BaseNetworkRequest {
  getRequestUrl(opts: { baseUrl?: string; paths: string[] }): string;
  getRequestPath(opts: { paths: string[] }): string;
}
```

`baseUrl` falls back to the helper's own `baseUrl`; if the result is empty it throws an error with `statusCode: 500`. A trailing `/` is removed from the base. Each path segment gets a leading `/` if it lacks one, and the segments are joined with no separator.

```ts
import { NodeFetchNetworkRequest } from '@venizia/ardor';

const request = new NodeFetchNetworkRequest({
  name: 'api',
  networkOptions: { baseUrl: 'https://api.example.com/' },
});

request.getRequestUrl({ paths: ['users', '/1'] });
// 'https://api.example.com/users/1'
```

## Common pitfalls

- **`Timezone-Offset` is in hours, not minutes.** `App.TIMEZONE_OFFSET` is `-(getTimezoneOffset() / 60)`, so UTC+7 sends `7`.
- **`doRequest` does not build headers.** Pass the result of `getRequestProps`, or at least `getRequestHeader` plus a `content-type`; otherwise a JSON body goes out without one.
- **A response without `content-type` becomes a `Blob`**, even if the body is JSON. The textual check requires a non-empty matching header.
- **`getRequestAuthorizationHeader` reads `localStorage` first, every time.** In a runtime without `localStorage` it throws before the in-memory token is considered.
- **`x-auth-provider` is empty for `setAuthToken` tokens.** Only the stored JSON object carries `provider`.
- **Refreshing must update the token where it is read.** If `setAuthToken` was used, write the refreshed value with `setAuthToken` again - a new `localStorage` entry is shadowed by the in-memory one.
- **`refreshTokenPath` is a substring check** on `paths.join('/')`, and `refreshToken` is never retried more than once per burst.
- **`count` is `NaN` for non-list `DATA_ONLY` responses** that do not set `x-response-count`.
- **Non-JSON error bodies** cause a parse error from `response.json()` instead of the server's message.
- **`FORM_URL_ENCODED` drops falsy values** - `0`, `''` and `false` are not sent.

## Related

- [Data provider](../references/data-provider) - the react-admin facing provider built on this service
- [Auth provider](../references/auth-provider) - who stores `LocalStorageKeys.KEY_AUTH_TOKEN` and calls the refresh endpoint
- [Binding keys](../references/binding-keys) - how the service is resolved from the container
- [Types](../references/types) - `TConstValue`, `TRequestType`, `TRequestMethod`
- [Migrating from ra-core-infra](../guides/migration/from-ra-core-infra) - what changed from the old `DefaultNetworkRequestService`
