---
title: The network service is split into small parts, and its types are closed
description: DefaultNetworkRequestService stays the class you extend, but the token store, the body encoder, the response reader and the auth recovery live in their own files, and the request types lose their open index signatures.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-26

## The network service is split into small parts, and its types are closed

<Badge type="warning" text="Breaking Change" />

**In one line.** `DefaultNetworkRequestService` keeps its constructor and its protected hooks, but the code behind it is in separate files, and the request types no longer accept any key.

## What changed

- **One auth token store.** `AuthTokenStore.read()` and `AuthTokenStore.write()` are the one place that reads and writes the token under `LocalStorageKeys.KEY_AUTH_TOKEN`, with the `localStorage` guard and the rule that only the error name of a corrupt value is logged. `DefaultAuthService.getAuth()` and `saveAuth()` use it, and so does `DefaultNetworkRequestService.readAuthTokenFromStorage()`, which stays as a one-line delegate.
- **The token types are in `common/types.ts`.** `IAuthTokenRecord`, `IDataSourceRequestContext` and `IDataSourceAuth` moved there from the network service file. The package root exports them as before.
- **The body encoder is its own class.** `RequestBodyEncoder.encode({ bodyType, body })` returns the body and the content type to send (none for multipart, so `fetch` adds the boundary). `getRequestProps` keeps its signature and result and asks the new protected hook `encodeBody`, which delegates to it: override that to encode another way.
- **The response reader is its own class.** `ResponseReader.read`, `convert` and `toError` read a response by the request type, take the total from `Content-Range` and build the `ApplicationError` of a failed one; `ResponseReader.ERROR_ROOT_KEY` is the key the data source auth shares. `doRequest` keeps its signature, now typed `Promise<INetworkResponse<TResult>>` (a new type in `common/types.ts`, the same fields), and `convertResponse` stays on the service as a delegate.
- **The auth recovery is its own class.** `AuthRecovery` holds the refresh shared by every 401 in flight and the rule for which paths recover. The service builds one with callbacks that call its protected hooks when they run, so a subclass that overrides `refreshToken`, `onAuthFailure` or `isNoAuthPath` keeps working. `refresh()` stays public on the service as a delegate and `authRecovery` stays a protected field.
- **The list filter builder is its own helper.** `ListFilterBuilder.build({ params })` turns react-admin's list params into the IGNIS filter, the query and the list extras, and `ListFilterBuilder.extractQueryParams` replaces the `filter.params` loop that `getOne` and `getMany` repeated. `DefaultRestDataProvider.buildListFilter` stays a protected hook and delegates to it. Admin gains `ListFilterBuilder` in its public surface.
- **One `request()` for the data provider.** The ten `DefaultRestDataProvider` methods each repeated a `getRequestProps` call and a `doRequest` call; they now call the protected `request({ resource, type, method, paths?, body?, bodyType?, query?, extra?, headers?, requestCountData? })` (typed `IRestRequestOptions`, new). Headers named in `headers` win over the computed ones. Override `request()` to move every method, `send()` included, to another transport.
- **`requestList` replaces `getListHelper`.** The list GET, with the extras a route answered as `meta.extra`, is the protected `requestList({ resource, type, queryKey, filter, extra? })`. `CountRestDataProvider` overrides it and asks `request()` for `/count` without extras, so its `withoutExtraHeader` workaround is gone.
- **The unused parse utilities are gone.** Nothing in ARDOR or in the BANA frontend used them, and IGNIS already has the helpers a project needs. The kernel loses its only runtime dependency, `lodash`.
- **The request types name every field.** `ISendParams` and `IApplicationInfo` no longer end in `[key]: any`, so a typo is a compile error instead of a field that is silently dropped. `ISendParams.body` is `unknown` and `query` is `Record<string, unknown>`; `extra` (the list extras `send()` already passed on) is named. `ISendResponse` is the `INetworkResponse` it duplicated.
- **The provider types come from ra-core.** `IReactAdminDataProvider` is the nine data methods of ra-core's `DataProvider`, and `IReactAdminAuthProvider` the auth methods of its `AuthProvider` (with `getPermissions` required), taken with `Pick`: a ra-core upgrade changes them, and they cannot drift from it.
- **`refreshToken` answers a boolean.** `IAuthProvider.refreshToken`, `DefaultAuthProvider.refreshToken` and `useRefreshToken` are `Promise<boolean>`: `true` when the session was refreshed, `false` when there is no refresh to make (`useRefreshToken` also answers `false` with no auth provider, where it answered `undefined`).
- **`AnyType` leaves the signatures.** `send()`, `request()`, `doRequest()`, `ISendResponse` and `INetworkResponse` default to `unknown` data (name the type: `send<TSignInResponse>(...)`); the record generics of the data provider methods default to `RaRecord`; the auth hooks take `ILoginParams` or `unknown`; the list filter is a named `IListFilter`; `i18nSources` is `Record<string, object>`; the `Logger` takes `unknown` arguments; `useService`, `useProvider`, `useComponent`, `useConfiguration` and `useRepository` default to `unknown`.
- **`useTranslate()` is typed in every case.** It used to return a union with an `(key: any) => any` fallback, so a plain `string` key and a translated text assigned to a key-typed prop both compiled; it returns `TUseTranslateFn`, and `translate()` returns `string`.

## Who is affected

- **A subclass of `DefaultNetworkRequestService`.** No action needed for this part: nothing it overrides changed.
- **A log reader.** A corrupt stored token is logged once, as a warning with scope `AuthTokenStore`, whichever reader meets it. `getAuth()` used to log an error under the scope `DefaultAuthService`, and also for an empty string; an empty string is now nothing stored.
- **Code that imports from the file path.** `IAuthTokenRecord` and the two data source types are no longer declared in `base/services/network-request`; import them from the package root.

## Breaking changes

> [!WARNING]
> This affects only a subclass of `DefaultNetworkRequestService` that overrides or calls the protected body helpers.

The protected methods `isFileList`, `encodeFormValue` and `appendFormDataValue` are gone from `DefaultNetworkRequestService`; their logic is private to `RequestBodyEncoder`. To change how a body is encoded, override `encodeBody({ bodyType, body })`, which returns `{ body, contentType? }`.

The protected method `parseFilenameFromContentDisposition` is gone from `DefaultNetworkRequestService`; the file name of a response is read by `ResponseReader`, which keeps the same rules (`filename*` before a quoted, before a bare `filename`).

The private members `canRecover` and `refreshing` are gone from `DefaultNetworkRequestService`, which matters only to code that reached them through a cast.

`getListHelper` is gone from `DefaultRestDataProvider` and `CountRestDataProvider`: it was public, took a `requestProps` argument, and is now the protected `requestList` with `extra` in its place.

```ts no-check
// Before
override getListHelper(opts: { resource; type; queryKey; filter; requestProps }) { ... }

// After
protected override requestList(opts: { resource; type; queryKey; filter; extra? }) { ... }
```

A subclass that overrode the ten methods one by one to change the transport can override `request()` instead.

The `/count` request of `CountRestDataProvider` now builds its own headers, so it has its own `x-request-id`; it shared the list's.

These exports are removed from `@venizia/ardor-kernel` and `@venizia/ardor`: `NumberParseMethods`, `TNumberParseMethod`, `INTL_0_DIGITS_FORMATTER`, `INTL_2_DIGITS_FORMATTER`, `generateUniqueId`, `toCamelCase`, `keysToCamelCase`, `isInteger`, `isFloat`, `toInteger`, `toFloat`, `toBoolean`, `toStringDecimal`, `getNumberValue` and `parseQueryString`. Replace `parseQueryString({ search })` with `Object.fromEntries(new URLSearchParams(search))`; for the rest, use the IGNIS helpers (`@venizia/ignis-helpers`) or your own.

`ISendParams` loses the index signature and the unused `id` and `file`; `IApplicationInfo` loses the index signature; the unused `IRequestProps` is removed. Code that passed an extra key to either now fails to compile: delete the key, or carry the value another way (a header in `headers`, a path in `resource`).

Type-level only; nothing changes at run time except the `useRefreshToken` result with no auth provider. Name the type on `send()` and resolve `true` from a `refreshToken` override:

```diff
-.send({ resource, params })
-.then((rs: { data: TSignInResponse }) => { /* ... */ resolve(rs); })
+.send<TSignInResponse>({ resource, params })
+.then(rs => { /* ... */ resolve(true); }) // inside new Promise<boolean>(...)
```

- A subclass of `DefaultAuthProvider` that overrides `refreshToken` must return `Promise<boolean>`.
- A call to `send()` or `doRequest()` without a type argument gets `unknown` data: pass the type.
- A value that is a translated text must not be typed as `TUseTranslateKeys`, and a key built at run time must be typed as one.

The rest of the breaking parts of this series are listed here as they land.
