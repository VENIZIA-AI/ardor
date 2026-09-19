---
type: Concept
title: Request header protocol
description: Documents the headers ARDOR's network request service attaches to outgoing HTTP calls, how each one is derived, and how list totals are read back.
resource: packages/kernel/src/common/constants.ts
tags: [headers, network-request, kernel, i18n, auth, tracing]
---

ARDOR's `DefaultNetworkRequestService` (in the kernel package) builds every outbound request with a consistent set of headers. These are defined centrally as string constants in `HeaderConsts` (`packages/kernel/src/common/constants.ts`) so the header names themselves are never hand-typed at call sites. This is the same const-class pattern used elsewhere in the kernel - see [Const classes](/conventions/const-classes.md).

Every name is lowercase, and the service keys its header record by lowercase name, merging sources so a later one REPLACES an earlier one whatever case either used: custom headers over the timezone pair, the per-request `x-request-*` headers over any custom header of the same name. A plain object spread kept `X-Request-Count` beside `x-request-count`, and `fetch` sent the two joined as `"1, 0"`, which no server parses. `removeHeaders` lowercases the names it is given for the same reason.

## timezone and timezone-offset

Two headers report the client's time context on every request:

- `timezone` - the IANA zone name, computed once via `Intl.DateTimeFormat().resolvedOptions().timeZone` and stored as `App.TIMEZONE`.
- `timezone-offset` - the numeric UTC offset in hours, computed as `-(new Date().getTimezoneOffset() / 60)` and stored as `App.TIMEZONE_OFFSET`.

Both are computed once at module load (`App` class fields), not per request, so they reflect the browser's timezone at boot time.

## Authorization and x-auth-provider

When a call requires auth, the service takes the in-memory `authToken` set with `setAuthToken`, and only when there is none asks its `authTokenResolver` - by default `readAuthTokenFromStorage`, which reads `localStorage` under `LocalStorageKeys.KEY_AUTH_TOKEN` and answers `undefined` where there is no `localStorage` or the value does not parse. It sends:

- `authorization: <type> <value>` where type defaults to `Bearer` if the stored token has no explicit type (see `Authentication.TYPE_BASIC` / `TYPE_BEARER` constants).
- `x-auth-provider` - the provider name recorded alongside the token, letting the backend know which auth strategy issued it. It is omitted when the token names no provider, rather than sent as the string `undefined`.

If no valid token is found, the service throws a 401 error before the request is sent rather than sending an unauthenticated call. Paths that are exempt from this requirement are governed by the no-auth path logic - see [No-auth paths](/architecture/no-auth-paths.md) and [Auth recovery](/architecture/auth-recovery.md) for what happens when a token has expired mid-flight.

## x-request-channel

Identifies the client platform on every request so the backend can distinguish web traffic from other channels. It defaults to `RequestChannel.WEB` (`100_WEB`), the only channel currently defined, and is overridden by `IRestDataProviderOptions.requestTracingChannel` when that is a non-empty string.

## x-request-count and x-response-count

These two headers carry count semantics:

- `x-request-count` tells the backend whether to compute a total count alongside the data. Values come from `RequestCountData`: `DATA_ONLY` (`'0'`) returns just the list, `DATA_WITH_COUNT` (`'1'`) asks for both data and count.
- `x-response-count` is read back only for non-list request types: when the call did not ask for `DATA_WITH_COUNT`, its value is parsed into the result's `count`. List totals never use it - they come from `content-range` (see below) - see [Data provider pipeline](/architecture/data-provider-pipeline.md).

## x-request-id

Every request is tagged with a tracing id under `x-request-id`. When `requestTracingId` is a function, the id is `requestTracingId({ applicationInfo })`; otherwise (unset or a boolean) it is `<applicationInfo.name>_<uuid>` - a fresh random v4-shaped id per request, prefixed with the application name, not derived from the request. Either way logs and traces can be correlated end to end between client and backend without the client owning a stateful counter.

The id comes from `uuidV4()` in `@venizia/ignis-helpers/uuid`, which uses `crypto.randomUUID` where that exists and `crypto.getRandomValues` where it does not. `randomUUID` is secure-context-only, so on a plain-http origin such as `http://<lan-ip>` it is `undefined` - and because EVERY request carries this header, calling it directly used to throw before anything was sent: the whole app failed, not one call. The shared helper is the reason this is not solved twice; at 398 B gzip it also measured SMALLER than the local fallback it replaced.

## content-type by bodyType

The `content-type` header is chosen from the request's declared `bodyType`, using `RequestBodyTypes`: `none`, `form-data`, `x-www-form-urlencoded`, `json`, or `binary`. `x-www-form-urlencoded` sets `application/x-www-form-urlencoded`. `form-data` sets no `content-type`, so `fetch` writes the multipart boundary itself. Every other case - `json`, `none`, `binary`, or no `bodyType` - sends `content-type: application/json`. How each body is encoded (and why a `binary` body arrives as `{}`), and how the response `content-type` decides between JSON and a `Blob`, are in [Network layer](/architecture/network-layer.md).

## x-locale

The `x-locale` header carries the active UI locale. It is opt-in: nothing is sent until the application mounts `useRequestHeaderLocale`, which pushes react-admin's current locale through `setHeaders` - see [i18n](/architecture/i18n.md) for the mechanism. `App.DEFAULT_LOCALE` (`en.UTF-8`) is declared but read nowhere - it is not a fallback.

## setHeaders / removeHeaders

The network request service keeps its header set mutable at runtime: `setHeaders` merges new key-value pairs into the internal `headers` record (using `lodash/merge`), and `removeHeaders` strips specific keys out. This is how locale (and any static custom header) is updated after the service has already been constructed, without recreating the whole client. It cannot change `authorization` on an authenticated path: stored headers are spread first, then the computed `authorization` and `x-auth-provider` overwrite them. Update the token with `setAuthToken` or the stored session instead. Once `setAuthToken` has been called, that in-memory token always wins, so later changes to the stored session are ignored.

## content-range and totals

Responses use `content-range` in the `unit start-end/total` format (for example `items 0-9/42`). List totals (`getList`, `getManyReference`) come from this header alone: the number after the last `/`, or the number of returned rows when the header is missing. A `*` total parses to `NaN`, and no `pageInfo` is produced. `CountRestDataProvider` ignores both headers and takes `total` from the `count` field of the `/{resource}/count` response body. `content-disposition` marks a response as a file and carries its filename - see [Network layer](/architecture/network-layer.md) for how it is decoded.
