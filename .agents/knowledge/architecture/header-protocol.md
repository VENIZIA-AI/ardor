---
type: Concept
title: Request header protocol
description: Documents the fixed set of headers ARDOR's network request service attaches to every outgoing HTTP call and how each one is derived.
resource: packages/kernel/src/common/constants.ts
tags: [headers, network-request, kernel, i18n, auth, tracing]
---

ARDOR's `DefaultNetworkRequestService` (in the kernel package) builds every outbound request with a consistent set of headers. These are defined centrally as string constants in `HeaderConsts` (`packages/kernel/src/common/constants.ts`) so the header names themselves are never hand-typed at call sites. This is the same const-class pattern used elsewhere in the kernel - see [Const classes](/conventions/const-classes.md).

## Timezone and Timezone-Offset

Two headers report the client's time context on every request:

- `Timezone` - the IANA zone name, computed once via `Intl.DateTimeFormat().resolvedOptions().timeZone` and stored as `App.TIMEZONE`.
- `Timezone-Offset` - the numeric UTC offset in hours, computed as `-(new Date().getTimezoneOffset() / 60)` and stored as `App.TIMEZONE_OFFSET`.

Both are computed once at module load (`App` class fields), not per request, so they reflect the browser's timezone at boot time.

## Authorization and x-auth-provider

When a call requires auth, the service reads the stored token (in-memory `authToken` field, falling back to `localStorage` under `LocalStorageKeys.KEY_AUTH_TOKEN`) and sends:

- `authorization: <type> <value>` where type defaults to `Bearer` if the stored token has no explicit type (see `Authentication.TYPE_BASIC` / `TYPE_BEARER` constants).
- `x-auth-provider` - the provider name recorded alongside the token, letting the backend know which auth strategy issued it.

If no valid token is found, the service throws a 401 error before the request is sent rather than sending an unauthenticated call. Paths that are exempt from this requirement are governed by the no-auth path logic - see [No-auth paths](/architecture/no-auth-paths.md) and [Auth recovery](/architecture/auth-recovery.md) for what happens when a token has expired mid-flight.

## x-request-channel

A fixed marker identifying the client platform. `RequestChannel.WEB` (`100_WEB`) is the only channel currently defined, sent on every request so the backend can distinguish web traffic from other channels.

## x-request-count and x-response-count

These flags control react-admin's list semantics:

- `x-request-count` tells the backend whether to compute a total count alongside the data. Values come from `RequestCountData`: `DATA_ONLY` (`'0'`) returns just the list, `DATA_WITH_COUNT` (`'1'`) asks for both data and count.
- `x-response-count` mirrors this on the way back, or is inspected together with the `content-range` header (see below) to resolve `getList`/`getManyReference` totals for react-admin's data provider - see [Data provider pipeline](/architecture/data-provider-pipeline.md).

## x-request-id

Every request is tagged with a tracing id under `x-request-id`. The service either accepts a caller-supplied `requestTracingId` function or falls back to a name-based UUID (`name_uuid`) derived from request details, so logs and traces can be correlated end to end between client and backend without the client owning a stateful counter.

## content-type by bodyType

The `content-type` header is chosen from the request's declared `bodyType`, using `RequestBodyTypes`: `none`, `form-data`, `x-www-form-urlencoded`, `json`, or `binary`. The service picks the matching MIME type and skips setting `content-type` at all for `NONE` and for `form-data` (letting `fetch` set its own multipart boundary). `HeaderConsts.TEXTUAL_CONTENT_TYPE_RE` is used downstream to decide whether a response body should be parsed as text (JSON, XML, form-encoded, GraphQL, or any `text/*`) versus treated as binary.

## x-locale

The `x-locale` header carries the active UI locale, supplied through the `useRequestHeaderLocale` hook so requests always reflect the locale currently selected in the app rather than a stale default. This ties into the framework's i18n layer - see [i18n](/architecture/i18n.md). `App.DEFAULT_LOCALE` (`en.UTF-8`) is the fallback when no locale has been resolved yet.

## setHeaders / removeHeaders

The network request service keeps its header set mutable at runtime: `setHeaders` merges new key-value pairs into the internal `headers` record (using `lodash/merge`), and `removeHeaders` strips specific keys out. This lets callers - typically auth or locale hooks - update headers like `authorization` or `x-locale` after the service has already been constructed, without recreating the whole client.

## content-range and totals

Responses use `content-range` in the `unit start-end/total` format (for example `items 0-9/42`). The `total` segment (or `*` if unknown) is what the data provider pipeline reads to populate react-admin's list `total`/`pageInfo`, working together with `x-response-count` when both are present. `content-disposition` is parsed similarly to recover file names for binary/attachment responses, matched against `HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE`.
