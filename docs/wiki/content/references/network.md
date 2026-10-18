---
title: Network layer
description: DefaultNetworkRequestService - request headers, the token hook, no-auth paths, body types, response parsing, error shape, count modes, 401 recovery hooks, and the fetchers underneath.
---

# Network layer

`DefaultNetworkRequestService` is the HTTP layer of the ARDOR kernel. It builds headers, formats the body, sends the request through a `NodeFetchNetworkRequest`, parses the response, and recovers from a 401 once. Everything on this page is what the class does today: options are data, behaviour is in protected hooks, and every method takes one object, never positional arguments.

## Prerequisites

A runtime with global `fetch`, `Headers`, `FormData`, `URLSearchParams`, `localStorage` and `crypto.getRandomValues` - a browser, or Node 18+ with a `localStorage` shim if you call the authenticated path. `crypto.randomUUID` is used when present but never required: it is secure-context-only, so a plain-http origin such as `http://<lan-ip>` does not have it, and the tracing id comes from `uuidV4()` in `@venizia/ignis-helpers/uuid` for exactly that reason.

## Quick Reference

| Export | Kind | Role |
|---|---|---|
| `DefaultNetworkRequestService` | class | The request service: headers, body, send, parse, recover. Options are data, behaviour is in protected hooks |
| `INoAuthOptions` | interface | `noAuthPaths`, `noAuthPathRegex` constructor options (data) |
| `TNoAuthPathRegex` | type | One `RegExp \| string` or an array of them |
| `IAuthRecoveryOptions` | interface | `refreshTokenPath` (data) |
| `IAuthTokenRecord` | interface | The token a request carries: `type`, `value`, `provider` |
| `IDataSourceAuth` | interface | `authTokenResolver`, `headersResolver`, `onUnauthorized` and `errorRootKey` for an `HttpDataSource`, from `getDataSourceAuth()` |
| `IGetRequestPropsParams` / `IGetRequestPropsResult` | interface | Input and output of `getRequestProps` |
| `NetworkHeaders` | class | `toRecord({ headers })` and `merge({ sources })`: header records with lowercased keys |
| `HeaderConstants` | class | Header names and the content-type / attachment regexes |
| `RequestBodyTypes` | class | `JSON`, `FORM_DATA`, `FORM_URL_ENCODED`, `NONE`, `BINARY` |
| `RequestCountData` | class | `DATA_ONLY` (`'0'`), `DATA_WITH_COUNT` (`'1'`) |
| `RequestChannel` | class | `WEB` (`'100_WEB'`), the default `x-request-channel` |
| `RequestMethods` / `RequestTypes` | class | HTTP methods and react-admin request types |
| `LocalStorageKeys` | class | `KEY_AUTH_TOKEN`, where the stored token is read from |
| `App` | class | `TIMEZONE` and `TIMEZONE_OFFSET` sent on every request |
| `BaseNetworkRequest` | class | Base helper: `getRequestUrl`, `getNetworkService`, `getWorker` |
| `NodeFetchNetworkRequest` / `NodeFetcher` | class | The `fetch` based transport, and the only one |

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

`headers` may be a plain record, a `Headers` instance or a tuple list; the service keeps a plain record with lowercased keys. The constructor creates one `NodeFetchNetworkRequest` named `name` for the given `baseUrl`.

Every option is data. There is no callback in the options and no flag that switches behaviour: what the service does is decided by the protected hooks below, which a subclass overrides.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  headers: { 'x-app-version': '1.0.0' },
  noAuthPaths: ['auth/login'],
});
```

## Hooks

Behaviour you can change is a protected method. Each takes one `opts` object, and the default is what the section for it describes.

| Hook | Default | Override it to |
|---|---|---|
| `resolveAuthToken(): IAuthTokenRecord \| undefined` | Reads storage through `DefaultNetworkRequestService.readAuthTokenFromStorage()` | Supply the token from somewhere else, such as memory |
| `isNoAuthPath({ resource, paths }): boolean` | `resource` in `noAuthPaths`, or `noAuthPathRegex` matches | Use a rule of your own |
| `refreshToken(): Promise<boolean>` | Resolves `false`: there is nothing to refresh | Refresh the session after a 401 |
| `onAuthFailure(): Promise<void>` | Does nothing | Send the user back to sign-in |
| `buildRequestTracingId({ applicationInfo }): string` | `<application name>_<uuid>` | Build the `x-request-id` differently |

The data provider builds the service in its protected `createNetworkService()`, called once on first use. To use a subclass, override that method in a `DefaultRestDataProvider` subclass and return it:

```ts
import {
  DefaultNetworkRequestService,
  DefaultRestDataProvider,
  type IApplicationInfo,
} from '@venizia/ardor';

class AppNetworkService extends DefaultNetworkRequestService {
  protected override buildRequestTracingId(opts: { applicationInfo: IApplicationInfo }): string {
    return `${opts.applicationInfo.name}-${Date.now()}`;
  }
}

export class AppRestDataProvider extends DefaultRestDataProvider {
  protected override createNetworkService() {
    return new AppNetworkService({
      name: 'app-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      noAuthPathRegex: this.restDataProviderOptions.noAuthPathRegex,
      headers: this.restDataProviderOptions.headers,
      authRecovery: this.restDataProviderOptions.authRecovery,
    });
  }
}
// bind AppRestDataProvider under CoreBindings.DEFAULT_REST_DATA_PROVIDER:
//   this.application.instantiate(AppRestDataProvider).value(this.application)
```

The sections below show a subclass for a token and for a refresh.

## Request headers

`getRequestHeader({ resource })` builds the base set. `getRequestProps` adds the tracing headers and the content type on top of it.

| Header | Value | Set by |
|---|---|---|
| `timezone` | `App.TIMEZONE` - `Intl.DateTimeFormat().resolvedOptions().timeZone` | `getRequestHeader` |
| `timezone-offset` | `App.TIMEZONE_OFFSET` as a string - hours east of UTC, so `7` or `-5` | `getRequestHeader` |
| custom headers | constructor `headers` merged with `setHeaders` | `getRequestHeader` |
| `authorization` | `<type> <value>` from the token source below | `getRequestHeader`, skipped on no-auth paths |
| `x-auth-provider` | `provider` from the token, omitted when the token names none | `getRequestHeader`, skipped on no-auth paths |
| `x-request-channel` | `restDataProviderOptions.requestTracingChannel`, else `RequestChannel.WEB` (`'100_WEB'`) | `getRequestProps` |
| `x-request-count` | `requestCountData`, default `RequestCountData.DATA_ONLY` (`'0'`) | `getRequestProps` |
| `x-request-id` | `buildRequestTracingId({ applicationInfo })`: `${applicationInfo.name}_<v4 uuid>` from `uuidV4()` (`@venizia/ignis-helpers/uuid`) unless a subclass overrides it | `getRequestProps` |
| `content-type` | depends on the body type, see below | `getRequestProps` |

Header names are merged case-insensitively and a later source replaces an earlier one: custom headers override the timezone headers, and the per-request `x-request-channel`, `x-request-count` and `x-request-id` override a custom header of the same name. The record is keyed by lowercase name. A plain object spread would keep `X-Request-Count` beside `x-request-count`, and `fetch` would send the two joined as `"1, 0"`. `NetworkHeaders.merge({ sources })` is that merge (later wins, any case), and `NetworkHeaders.toRecord({ headers })` turns a `HeadersInit` into a record with lowercased keys and number values as text.

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
  static readAuthTokenFromStorage(): IAuthTokenRecord | undefined;
  getRequestAuthorizationHeader(): { provider: string | undefined; token: string };
  protected resolveAuthToken(): IAuthTokenRecord | undefined; // the hook: the token, without building a header
}
```

The token comes from one place, the protected `resolveAuthToken()` hook. Its default calls the static `readAuthTokenFromStorage()`, which parses `localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)` as JSON and returns `undefined` where there is no `localStorage` or the value does not parse. The token may carry `type`, `value` and `provider`.

If the token has no `value`, `getRequestAuthorizationHeader` throws an error with `statusCode: 401` and the request is never sent. `type` defaults to `Bearer`, so the header reads `Bearer <value>`. A service whose `resolveAuthToken` is overridden never touches `localStorage`, which is what lets it run where no DOM exists.

To supply a token from somewhere else, override `resolveAuthToken` in a subclass and return that subclass from `DefaultRestDataProvider.createNetworkService()` (see [Hooks](#hooks)):

```ts
import { DefaultNetworkRequestService, type IAuthTokenRecord } from '@venizia/ardor';

class MemoryTokenNetworkService extends DefaultNetworkRequestService {
  protected token?: string;

  setToken(opts: { value: string }) {
    this.token = opts.value;
  }

  protected override resolveAuthToken(): IAuthTokenRecord | undefined {
    return this.token ? { value: this.token, provider: 'app' } : undefined;
  }
}

const network = new MemoryTokenNetworkService({
  name: 'api',
  baseUrl: 'https://api.example.com',
});

network.setToken({ value: 'eyJhbGciOi...' });
network.getRequestAuthorizationHeader().token; // 'Bearer eyJhbGciOi...'
```

A token with no `provider` sends no `x-auth-provider` header at all.

## No-auth paths

`noAuthPaths` and `noAuthPathRegex` are data. The rule that reads them is the protected `isNoAuthPath` hook:

```ts no-check
declare class DefaultNetworkRequestService {
  protected isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean;
}
```

`isNoAuthPath` returns `true` when either holds, checked in order:

1. `resource` is an exact entry of `noAuthPaths`.
2. One of the `noAuthPathRegex` patterns matches `resource` or `paths.join('/')`. Strings are compiled with `new RegExp`; an invalid pattern is logged and dropped. `lastIndex` is reset before each test, so global regexes are safe.

`getRequestHeader` calls it with `{ resource }` only. The 401 recovery path and `getDataSourceAuth` call it with `{ resource: paths[0], paths }`.

To send no token at all, for an API with no sign-in, set `noAuthPathRegex: /./`. For a rule of your own, override `isNoAuthPath` in the subclass.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  noAuthPaths: ['auth/login'],
  noAuthPathRegex: [/^public\//, 'health$'],
});

network.getRequestHeader({ resource: 'auth/login' }); // no authorization: exact entry
network.getRequestHeader({ resource: 'public/banners' }); // no authorization: regex match
```

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

class PublicReadsNetworkService extends DefaultNetworkRequestService {
  protected override isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean {
    return opts.resource?.startsWith('catalog/') === true || super.isNoAuthPath(opts);
  }
}
```

## setHeaders and removeHeaders

```ts no-check
declare class DefaultNetworkRequestService {
  setHeaders(opts: { headers: HeadersInit }): void; // merged into the current record, a name replaced in any case
  removeHeaders(opts: { keys: string[] }): void;    // delete by name, in any case
}
```

The record is keyed by lowercase name, so `removeHeaders` finds a key whatever case you set it with.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const network = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  noAuthPaths: ['auth/login'],
});

network.setHeaders({ headers: { 'x-locale': 'vi', 'x-tenant': 'acme' } });
network.removeHeaders({ keys: ['x-tenant'] });
network.getRequestHeader({ resource: 'auth/login' });
// { timezone: ..., 'timezone-offset': ..., 'x-locale': 'vi' }
```

## Body types

`getRequestProps` switches on `bodyType`:

| `bodyType` | `content-type` header | Body sent |
|---|---|---|
| `RequestBodyTypes.JSON`, `NONE`, `BINARY`, or omitted | `application/json` | `body` unchanged; `NodeFetcher` runs `JSON.stringify` on it |
| `RequestBodyTypes.FORM_URL_ENCODED` (`'x-www-form-urlencoded'`) | `application/x-www-form-urlencoded` | `URLSearchParams`; `undefined` and `null` are skipped, `0`, `false` and `''` are sent; a `Date` is sent as ISO-8601, an object as JSON, anything else through `String()`; a file throws |
| `RequestBodyTypes.FORM_DATA` (`'form-data'`) | not set - the runtime adds the boundary | `FormData`; a `File`, `Blob`, array of them or `FileList` is appended with its `name`; other values are encoded as above; `undefined` and `null` are skipped |

`doRequest` drops the body when `method` is `RequestMethods.GET`.

```ts
import { DefaultNetworkRequestService, RequestBodyTypes } from '@venizia/ardor';
import type { IApplicationInfo, IRestDataProviderOptions } from '@venizia/ardor';

declare const file: File;
declare const fileList: FileList;
declare const restDataProviderOptions: IRestDataProviderOptions; // the request channel
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
| `content-disposition` starts with `attachment`, or `content-type` is missing or does not match `HeaderConstants.TEXTUAL_CONTENT_TYPE_RE` | `{ data: Blob, filename?, contentDisposition? }` |
| otherwise | `response.json()` passed to `convertResponse` |

`TEXTUAL_CONTENT_TYPE_RE` accepts `application/json`, `*+json`, `application/xml`, `*+xml`, `application/x-www-form-urlencoded`, `application/javascript`, `application/graphql` and anything under `text/`. The check is case-insensitive.

`filename` is read from `content-disposition` in this order: `filename*=<charset>'<lang>'<value>` (URI-decoded, falling back to the raw value), `filename="quoted"`, then bare `filename=value`. It is only present on the result when a name was found.

## Error shape on non-2xx

When the final status is outside `200..299`, `doRequest` throws an `ApplicationError` (from `@venizia/ignis-inversion`, an `Error`). It reads the body with IGNIS `HttpResponseReader.readError`, under the `error` root key, and maps it the way IGNIS `HttpDataSource` does. So the data providers and a repository throw the same shape, and `useNotifyError` gets the `ApplicationError` it is typed for.

| Field | Value |
|---|---|
| `statusCode` | The HTTP status of the response. A `statusCode` in the body is ignored. |
| `message`, `normalized.text` | The server's `normalized.text`, else its `message`, else `HTTP <status>`. An empty string counts as absent. |
| `normalized.code` | The server's code, lower-cased; `core.system_error` when the server sent none. |
| `normalized.args` | The server's `args`, else `{}`. |
| `extra` | The server's `extra` plus `requestId`; `undefined` when both are empty. |
| `cause` | The server's `details.cause`, such as the per-field issues of a `422`. |

`message` is the server's text, not a log line as on `HttpDataSource`, because react-admin shows `error.message` to the user.

Every other key of the body is dropped: `type`, `path`, `url`, the rest of `details`, and any ad hoc field such as `field`. The body's top-level `requestId` moves into `extra.requestId`. When the server also sent its own `extra.requestId` (a server that relays a call it made upstream), that older id moves to `extra.upstreamRequestIds`, nearest first.

```ts
import { DefaultNetworkRequestService, RequestMethods, RequestTypes } from '@venizia/ardor';

declare const network: DefaultNetworkRequestService;

// The server answered 409 with:
// { error: { message: 'Order already paid', normalized: { code: 'server.order.paid', args: { id: 7 } }, requestId: 'req-1' } }
try {
  await network.doRequest({
    type: RequestTypes.UPDATE,
    method: RequestMethods.PATCH,
    paths: ['orders', '7'],
    headers: network.getRequestHeader({ resource: 'orders' }),
  });
} catch (error) {
  if (error instanceof Error) {
    // error.statusCode                -> 409
    // error.message                   -> 'Order already paid'
    // error.normalized.code           -> 'server.order.paid'
    // error.normalized.args           -> { id: 7 }
    // error.extra                     -> { requestId: 'req-1' }
  }
}
```

A body with no `error` key is read as it stands, so `{ message: 'Validation failed' }` gives that message. A body that is not JSON, is empty, is an array, or holds a string under `error` (a proxy's `{ error: 'Bad Gateway' }`) has no known fields: the error is `HTTP <status>` with the default code. It no longer leaks a `SyntaxError` or a bare string. The `Response` object is not attached.

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
| `GET_LIST`, `GET_MANY_REFERENCE` | body wrapped in an array if it is not one; `total` from `content-range`, else the array length | body must be `{ data, count }` or an error is thrown; `data` wrapped in an array if needed; `count` = body `count` else array length; `total` from `content-range` as on the left |
| every other type | `data` = body; `count` = the integer in `x-response-count`, `undefined` when the header is absent or not a number | body returned as-is, no validation |

`content-range` is read with IGNIS `HttpResponseReader.parseContentRange`: `<unit> <start>-<end>/<total>` and the empty page `<unit> */<total>` both give `<total>`. An absent header gives the page's row count, and so does a malformed one: an unknown total (`records 0-24/*`), a bare number such as `137`, or an empty string. `response.headers` must expose `.get()`, which the `fetch` `Headers` object does.

## Auth recovery

```ts no-check
declare class DefaultNetworkRequestService {
  refresh(): Promise<boolean>;                  // one shared refresh per 401 burst
  protected refreshToken(): Promise<boolean>;   // the hook: the refresh itself
  protected onAuthFailure(): Promise<void>;     // the hook: runs once when refreshToken threw
  getDataSourceAuth(): IDataSourceAuth;         // share all of it with an HttpDataSource
}
```

`authRecovery` holds one piece of data, `refreshTokenPath`. The refresh is behaviour: the two protected hooks above, which a subclass overrides. The defaults do nothing: `refreshToken` resolves `false` (there is nothing to refresh) and `onAuthFailure` resolves with no effect. Resolve `true` after refreshing, `false` when there is nothing to refresh, and throw when the refresh failed.

When the first send returns `401`, `doRequest` recovers only if both of these hold:

- `isNoAuthPath({ resource: paths[0], paths })` is `false`,
- `paths.join('/')` does not contain `authRecovery.refreshTokenPath`, when one is configured.

Then:

1. The public `refresh()` runs the `refreshToken` hook. The promise is stored on the instance, so every 401 that arrives while a refresh is in flight awaits the same one. It is cleared when it settles. `authProvider.refreshToken()` calls `refresh()` too, so a refresh is made in one place.
2. If it resolves `true`, the service calls `getRequestAuthorizationHeader()` again, replaces `authorization` and `x-auth-provider` on the original headers, and sends exactly once more. A second 401 is thrown like any other non-2xx, as an `ApplicationError`.
3. If it resolves `false` (the default hook), nothing is retried and the original 401 is thrown.
4. If `refreshToken` throws or rejects, `onAuthFailure` is awaited (its own errors are logged and swallowed), `refresh()` resolves to `false`, and the original 401 is thrown as the `ApplicationError` described under Error shape on non-2xx.

`refreshToken` must leave the new token where `resolveAuthToken` will find it: `localStorage` under `LocalStorageKeys.KEY_AUTH_TOKEN` by default, or the field your own `resolveAuthToken` reads.

**One refresh for both transports.** `getDataSourceAuth()` returns `{ authTokenResolver, headersResolver, onUnauthorized, errorRootKey }` for an `HttpDataSource`:
- `authTokenResolver` reads `resolveAuthToken()`, and returns `undefined` on a no-auth path, so the repository sends this service's token.
- `onUnauthorized` joins the same in-flight refresh as step 1, so a burst of `401`s across the data provider and any repository calls `refreshToken` once.
- A failed refresh runs `onAuthFailure` once.
- With the default `refreshToken`, `onUnauthorized` answers `false` and the repository's `401` stands.

The data provider binding must be a singleton for this to hold; see [auth recovery](../best-practices/auth-recovery#where-tokens-live).

To refresh, override the hooks in a subclass and return it from `createNetworkService()` (see [Hooks](#hooks)):

```ts
import {
  DefaultNetworkRequestService,
  DefaultRestDataProvider,
  LocalStorageKeys,
  RequestMethods,
  RequestTypes,
} from '@venizia/ardor';

class AppNetworkService extends DefaultNetworkRequestService {
  protected override async refreshToken(): Promise<boolean> {
    const { data } = await this.doRequest<{ token: string }>({
      type: RequestTypes.SEND,
      method: RequestMethods.POST,
      paths: ['auth/refresh'],
      headers: this.getRequestHeader({ resource: 'auth/refresh' }),
    });

    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: data.token, type: 'Bearer' }),
    );
    return true;
  }

  protected override async onAuthFailure(): Promise<void> {
    localStorage.removeItem(LocalStorageKeys.KEY_AUTH_TOKEN);
  }
}

export class AppRestDataProvider extends DefaultRestDataProvider {
  protected override createNetworkService() {
    return new AppNetworkService({
      name: 'app-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      authRecovery: this.restDataProviderOptions.authRecovery, // { refreshTokenPath: 'auth/refresh' }
    });
  }
}
// then bind AppRestDataProvider under CoreBindings.DEFAULT_REST_DATA_PROVIDER:
//   this.application.instantiate(AppRestDataProvider).value(this.application)
```

## Fetchers

`DefaultNetworkRequestService` constructs a `NodeFetchNetworkRequest`, which is the only transport ARDOR ships: the platform `fetch`, no HTTP client dependency. It extends `BaseNetworkRequest<T>` and exposes `getNetworkService()` (the fetcher) and `getWorker()` (the underlying `fetch`). `BaseNetworkRequest` stays generic over `TFetcherVariant` so a consumer can add a transport of its own without forking the base.

**`NodeFetcher`** - `send(opts: INodeFetchRequestOptions)`:

- `params` is appended as `?` + `stringify(params)`.
- `body` is passed through when it is a `FormData` or `URLSearchParams`, otherwise `JSON.stringify(body)`.
- `headers` from the call replace the default headers entirely; the default `content-type: application/json; charset=utf-8` only applies when no headers are passed.
- `timeout` creates an `AbortController` and aborts after that many milliseconds; the timer is cleared in `finally`.
- It returns the raw `Response` - non-2xx statuses do not throw here.

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

- **`timezone-offset` is in hours, not minutes.** `App.TIMEZONE_OFFSET` is `-(getTimezoneOffset() / 60)`, so UTC+7 sends `7`.
- **`doRequest` does not build headers.** Pass the result of `getRequestProps`, or at least `getRequestHeader` plus a `content-type`; otherwise a JSON body goes out without one.
- **A response without `content-type` becomes a `Blob`**, even if the body is JSON. The textual check requires a non-empty matching header.
- **`getRequestAuthorizationHeader` throws a 401 when there is no token.** The token comes from `resolveAuthToken`; the default reads `localStorage`, and a token with no `value` is no token. Put the paths that need none in `noAuthPaths`.
- **`x-auth-provider` is empty when the token names no `provider`.** Only a token with a `provider` field sends it.
- **Refreshing must update the token where it is read.** If you overrode `resolveAuthToken` to read memory, `refreshToken` must write that same field; a new `localStorage` entry is ignored.
- **The hooks are protected.** You override them in a subclass; you cannot call `isNoAuthPath`, `refreshToken` or `resolveAuthToken` from outside. Call `refresh()` to refresh, and `getRequestHeader` to see what a path sends.
- **The default `refreshToken` refreshes nothing.** A 401 stands until you override the hook and return the subclass from `createNetworkService()`.
- **`refreshTokenPath` is a substring check** on `paths.join('/')`, and `refreshToken` is never retried more than once per burst.
- **`count` is `undefined` for non-list `DATA_ONLY` responses** that do not set `x-response-count`.
- **A non-JSON error body has no server message.** The error is `HTTP <status>` with `core.system_error`; read `statusCode`, not the text. A 2xx body that is not JSON still rejects with a parse error.
- **Read the request id from `error.extra.requestId`.** The top-level `requestId` of the body is not a property of the error, and nor is any other body key (`type`, `path`, `url`, `field`).
- **`FORM_URL_ENCODED` and `FORM_DATA` skip only `undefined` and `null`** - `0`, `''` and `false` are sent.

## Related

- [Data provider](../references/data-provider) - the react-admin facing provider built on this service
- [Auth provider](../references/auth-provider) - who stores `LocalStorageKeys.KEY_AUTH_TOKEN` and calls the refresh endpoint
- [Binding keys](../references/binding-keys) - how the service is resolved from the container
- [Types](../references/types) - `TConstValue`, `TRequestType`, `TRequestMethod`
- [Migrating from ra-core-infra](../guides/migration/from-ra-core-infra) - what changed from the old `DefaultNetworkRequestService`
