---
title: The network service is split into small parts, and its types are closed
description: DefaultNetworkRequestService stays the class you extend, its request types are closed, and the fetcher and socket client now come from IGNIS.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-25

## The network service is split into small parts, and its types are closed

<Badge type="warning" text="Breaking Change" />

**In one line.** `DefaultNetworkRequestService` keeps its constructor and its protected hooks, but the code behind it is in separate classes, the request types no longer accept any key, and the fetcher and the socket client now come from IGNIS.

## What changed

- **Split into classes.** `AuthTokenStore` (the one reader and writer of the stored token), `RequestBodyEncoder`, `ResponseReader`, `AuthRecovery` and, in admin, `ListFilterBuilder` (react-admin list params to the IGNIS filter, the query and the list extras). The service and `DefaultRestDataProvider` delegate to them. A subclass that overrides `refreshToken`, `onAuthFailure` or `isNoAuthPath` keeps working; `refresh()` and `convertResponse` stay on the service. `IAuthTokenRecord`, `IDataSourceRequestContext`, `IDataSourceAuth` and the new `INetworkResponse` are exported from the package root.
- **New hooks to override.** `encodeBody({ bodyType, body })` on the service (returns `{ body, contentType? }`) encodes a body another way. `request({ resource, type, method, paths?, body?, bodyType?, query?, extra?, headers?, requestCountData? })` on `DefaultRestDataProvider` (typed `IRestRequestOptions`) is called by all ten methods; override it to move every method, `send()` included, to another transport. Headers named in `headers` win over the computed ones.
- **`requestList` replaces `getListHelper`.** The list GET, with the extras a route answered as `meta.extra`, is the protected `requestList({ resource, type, queryKey, filter, extra? })`. `CountRestDataProvider` overrides it, so its `withoutExtraHeader` workaround is gone.
- **The request types name every field.** `ISendParams` and `IApplicationInfo` no longer end in `[key]: any`, so a typo is a compile error instead of a field that is silently dropped. `ISendParams.body` is `unknown` and `query` is `Record<string, unknown>`; `extra` is named. `ISendResponse` is the `INetworkResponse` it duplicated.
- **The provider types come from ra-core.** `IReactAdminDataProvider` is the nine data methods of ra-core's `DataProvider`, and `IReactAdminAuthProvider` the auth methods of its `AuthProvider` (with `getPermissions` required), so a ra-core upgrade changes them.
- **`refreshToken` answers a boolean.** `IAuthProvider.refreshToken`, `DefaultAuthProvider.refreshToken` and `useRefreshToken` are `Promise<boolean>`: `true` when the session was refreshed, `false` when there is no refresh to make (`useRefreshToken` also answers `false` with no auth provider, where it answered `undefined`).
- **`AnyType` leaves the signatures.** `send()`, `request()`, `doRequest()`, `ISendResponse` and `INetworkResponse` default to `unknown` data (name the type: `send<TSignInResponse>(...)`); the record generics of the data provider methods default to `RaRecord`; the auth hooks take `ILoginParams` or `unknown`; the list filter is a named `IListFilter`; `i18nSources` is `Record<string, object>`; the `Logger` takes `unknown` arguments; `useService`, `useProvider`, `useComponent`, `useConfiguration` and `useRepository` default to `unknown`.
- **`useTranslate()` is typed in every case.** It returns `TUseTranslateFn`, and `translate()` returns `string`. Before, a plain `string` key and a translated text assigned to a key-typed prop both compiled.
- **The transport is IGNIS's.** `DefaultNetworkRequestService` sends through `NodeFetchNetworkRequest` from `@venizia/ignis-helpers/core`, with `queryString: { nullish: 'skip', nested: 'json' }` (a filter is one JSON parameter and a null is left out). Request behaviour is unchanged: the same query, bodies, headers, timeout with the caller's signal and multipart boundary.
- **The socket client is IGNIS's too.** Use `SocketIOClientHelper` from `@venizia/ignis-helpers/socket-io/client` and hand it `module: { io }` from your own `socket.io-client` import. `socket.io-client` is no longer a peer of ARDOR.
- **The kernel needs a newer `@venizia/ignis-helpers`.** The peer range moves to the release that carries the browser-ready fetcher, query-string options and socket client.
- **The kernel loses `lodash`,** its only runtime dependency, with the unused parse utilities listed below.

## Who is affected

- **A subclass of `DefaultNetworkRequestService`.** No action for the split itself: nothing it overrides changed, except the protected helpers listed under Breaking changes.
- **A log reader.** A corrupt stored token is logged once, as a warning with scope `AuthTokenStore`. `getAuth()` used to log an error under the scope `DefaultAuthService`, and also for an empty string; an empty string is now nothing stored.
- **Code that imports from the file path.** `IAuthTokenRecord` and the two data source types are no longer declared in `base/services/network-request`; import them from the package root.
- **Code that uses the removed exports,** the `./socket-io` sub-paths or untyped `send()` calls. See below.

## Breaking changes

> [!WARNING]
> Most of this affects a subclass of `DefaultNetworkRequestService` or `DefaultRestDataProvider`, code that imports the removed exports, and type-checking. Nothing changes at run time except the `useRefreshToken` result with no auth provider and the `/count` request id.

**Protected members removed from `DefaultNetworkRequestService`.** `isFileList`, `encodeFormValue` and `appendFormDataValue` are gone; to change how a body is encoded, override `encodeBody`. `parseFilenameFromContentDisposition` is gone; `ResponseReader` reads the file name of a response with the same rules (`filename*` before a quoted, before a bare `filename`). The private members `canRecover` and `refreshing` are gone, which matters only to code that reached them through a cast.

**`getListHelper` is gone** from `DefaultRestDataProvider` and `CountRestDataProvider`: it was public, took a `requestProps` argument, and is now the protected `requestList` with `extra` in its place.

```ts no-check
// Before
override getListHelper(opts: { resource; type; queryKey; filter; requestProps }) { ... }

// After
protected override requestList(opts: { resource; type; queryKey; filter; extra? }) { ... }
```

A subclass that overrode the ten methods one by one to change the transport can override `request()` instead. The `/count` request of `CountRestDataProvider` now builds its own headers, so it has its own `x-request-id`; it shared the list's.

**Removed from `@venizia/ardor-kernel` and `@venizia/ardor`: the parse utilities.** `NumberParseMethods`, `TNumberParseMethod`, `INTL_0_DIGITS_FORMATTER`, `INTL_2_DIGITS_FORMATTER`, `generateUniqueId`, `toCamelCase`, `keysToCamelCase`, `isInteger`, `isFloat`, `toInteger`, `toFloat`, `toBoolean`, `toStringDecimal`, `getNumberValue` and `parseQueryString`. Replace `parseQueryString({ search })` with `Object.fromEntries(new URLSearchParams(search))`; for the rest, use the IGNIS helpers (`@venizia/ignis-helpers`) or your own.

**Removed from the same packages: the fetcher and the socket client.** `AbstractNetworkFetchableHelper`, `BaseNetworkRequest`, `IFetchable`, `IFetcherRequestOptions`, `INodeFetchNetworkOptions`, `INodeFetchRequestOptions`, `IRequestOptions`, `ISocketIOClientOptions`, `NodeFetcher`, `NodeFetchNetworkRequest`, `SocketIOClientHelper`, `TFetcherResponse`, `TFetcherVariant`, `TFetcherWorker`, `TSocketIOEventHandler` and `toQueryString`; and the sub-paths `@venizia/ardor-kernel/socket-io` and `@venizia/ardor/socket-io`. Import the fetcher, `BaseNetworkRequest`, `IFetchable`, `toQueryString` and `NodeFetchNetworkRequest` from `@venizia/ignis-helpers/core`, and the socket client from `@venizia/ignis-helpers/socket-io/client` (its handlers receive the payload, not the socket; `emit` takes `data`, not `message`; see [Socket.IO client](../extensions/socket-client)). A service subclass that assigns `networkRequest` assigns an IGNIS one.

**Closed request types.** `ISendParams` loses the index signature and the unused `id` and `file`; `IApplicationInfo` loses the index signature; the unused `IRequestProps` is removed. Code that passed an extra key to either now fails to compile: delete the key, or carry the value another way (a header in `headers`, a path in `resource`).

**Type-level changes.** Name the type on `send()` and resolve `true` from a `refreshToken` override:

```diff
-.send({ resource, params })
-.then((rs: { data: TSignInResponse }) => { /* ... */ resolve(rs); })
+.send<TSignInResponse>({ resource, params })
+.then(rs => { /* ... */ resolve(true); }) // inside new Promise<boolean>(...)
```

- A subclass of `DefaultAuthProvider` that overrides `refreshToken` must return `Promise<boolean>`.
- A call to `send()` or `doRequest()` without a type argument gets `unknown` data: pass the type.
- A value that is a translated text must not be typed as `TUseTranslateKeys`, and a key built at run time must be typed as one.
