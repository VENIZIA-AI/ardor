---
type: Concept
title: Network layer
description: The fetch transport beneath DefaultNetworkRequestService - URL joining, query and body encoding, the fetcher contract, timeouts, response decoding and the traps in each - plus the socket client on the ./socket-io sub-path.
resource: packages/kernel/src/helpers/networks
tags: [architecture, network, transport, fetch, kernel, socket-io]
---

# Network layer

Every HTTP call ARDOR makes goes down one stack: `DefaultRestDataProvider` asks `DefaultNetworkRequestService` for request props (`getRequestProps`), then calls `doRequest`, which joins the URL through a `NodeFetchNetworkRequest` and hands the request to its `NodeFetcher`, which calls the platform `fetch`. There is no second transport. This concept covers the layer from `doRequest` down. What sits on top has its own home: the headers in [Header protocol](/architecture/header-protocol.md), the filter mapping in [Data provider pipeline](/architecture/data-provider-pipeline.md), the one 401 retry in [Auth recovery](/architecture/auth-recovery.md) and a non-2xx or failed request in [Error flow](/architecture/error-flow.md).

## The pieces

- **`BaseNetworkRequest`** (`packages/kernel/src/helpers/networks/base-request.ts`) holds a base URL and a fetcher. `getRequestUrl({ baseUrl, paths })` strips one trailing `/` from the base, prefixes each path segment with `/` when it lacks one and joins the segments with nothing between them, so `['users', '1']` becomes `/users/1` and an empty segment adds a trailing slash. An empty base throws `getError` with status 500. `getNetworkService()` returns the fetcher.
- **`NodeFetchNetworkRequest`** is the only concrete request: it builds a `NodeFetcher` from its `networkOptions`.
- **`IFetchable`** (`fetchers/abstract.ts`) is the fetcher contract: `send`, the verb shortcuts `get`, `post`, `put`, `patch` and `delete`, and `getWorker`. `AbstractNetworkFetchableHelper` implements the shortcuts by calling `send` with the method set, leaving `send` abstract. `TFetcherVariant` is `'node-fetch'` alone and its response type is the Fetch `Response`, so every fetcher resolves one.
- **`NodeFetcher`** (`fetchers/node-fetch.ts`) is the only fetcher.

`DefaultNetworkRequestService` builds one `NodeFetchNetworkRequest` in its constructor. `doRequest` checks `baseUrl` itself before joining, with a `getError` that carries no status (so 400), which means the 500 is only reachable by calling `getRequestUrl` directly.

## What doRequest sends

`doRequest` calls `send` with the joined `url`, `method`, `params` (its `query`), `headers` exactly as passed, and `body` - dropped for `GET`, sent for every other method. It passes no `timeout`, no `signal` and no logger.

**Query string.** Whenever `params` is set, `send` appends `?` and `stringify(params)` (`packages/kernel/src/utilities/url.ts`). `stringify` skips `undefined` and `null` only, keeps strings and numbers as they are, and JSON-encodes everything else: objects, arrays, booleans, and a `Date` as a quoted ISO string. The `?` is appended unconditionally, so a path that already carries a query string gets a second `?`, and the params land inside its last value.

## Body encoding

A body is shaped twice. First `getRequestProps` (`packages/kernel/src/base/services/network-request.ts`) builds it by `bodyType` - the `content-type` each type sets is in [Header protocol](/architecture/header-protocol.md):

- **`x-www-form-urlencoded`** builds a `URLSearchParams`. **`form-data`** builds a `FormData`. Both skip a key only when its value is `undefined` or `null`, so `0`, `false` and `''` are sent. A `Date` becomes ISO-8601, an object or array becomes JSON, any other primitive goes through `String()`.
- Only `form-data` carries files: a `Blob` or `File` is appended with its `name` as the filename, and a top-level array or `FileList` becomes repeated entries under one key, each item encoded by the same rules. In `x-www-form-urlencoded` a `Blob` is just an object and arrives as `{}`. The `form-data` branch sets no `content-type`, but it does not remove one either: a `content-type` among the service's stored headers still goes out and replaces the multipart boundary.
- **Every other case** (`json`, `none`, `binary`, or no `bodyType`) passes the body through untouched.

Then `NodeFetcher.send` passes a `FormData` or `URLSearchParams` straight to `fetch` and `JSON.stringify`s anything else. So `binary` has no binary path: a `Blob` or `File` is sent as `{}`, a typed array as an object of its indexes, and a string arrives quoted. Upload files with `form-data`.

## Traps for a transport author

- **Timeouts never fire from the data provider.** `send` honours `timeout` by aborting an `AbortController`, and clears the timer as soon as `fetch` resolves, so reading the body is not timed. `doRequest` never passes one, and a `timeout` in `networkOptions` lands in the fetcher's default `RequestInit` where `send` never reads it. When `timeout` is set, the caller's `signal` is replaced, not combined.
- **The constructor's headers never reach `fetch`.** `NodeFetchNetworkRequest` stores `networkOptions.headers`, plus a default `content-type: application/json; charset=utf-8`, in the fetcher's default config, but `send` always writes the call's own `headers` over it, even when they are `undefined`. The service's headers arrive only because `getRequestHeader` merges its own copy, so a `doRequest` called without `headers` sends none of them.
- **The verb shortcuts send lowercase methods.** The Fetch standard upper-cases `delete`, `get`, `head`, `options`, `post` and `put`, but not `patch`, so `fetcher.patch()` sends a lowercase `patch` from a browser. `doRequest` is safe: its `method` is a `TRequestMethod`, typed to the upper-case `RequestMethods` values.
- **`send` calls the global `fetch` at request time**, while `getWorker()` returns the `fetch` captured when the fetcher was built. Replacing `globalThis.fetch` later changes what `send` calls, not what `getWorker()` returns.

## What comes back

After the retry and the non-2xx throw, `parseResponse` decodes a 2xx response:

- A 204 returns `{ data: {} }`.
- A `content-disposition` starting with `attachment` (`HeaderConsts.ATTACHMENT_CONTENT_DISPOSITION_RE`), or a `content-type` that is missing or not textual per `HeaderConsts.TEXTUAL_CONTENT_TYPE_RE`, returns `rs.blob()` as `data`, plus `filename` (read from `filename*=` first, then a quoted, then a bare `filename=`) and `contentDisposition` when present.
- Anything else goes through `rs.json()` and then `convertResponse`, which reads the totals described in [Header protocol](/architecture/header-protocol.md).

The textual pattern admits `text/*` and XML, but those bodies are still parsed with `rs.json()`, so a 2xx `text/plain` or XML response rejects with a `SyntaxError`. A 2xx response with no `content-type` comes back as a `Blob`.

## Replacing the transport

Three seams, widest first. A provider subclass overrides `send()` and the CRUD methods - [ipc-data-provider](/examples/ipc-data-provider.md) walks it. A `DefaultRestDataProvider` subclass can assign its own `DefaultNetworkRequestService` subclass to the protected `networkService` and override `doRequest`. Narrowest, a service subclass can assign the protected `networkRequest` a `BaseNetworkRequest<'node-fetch'>` built with its own `AbstractNetworkFetchableHelper`. That fetcher must resolve a Fetch `Response`: `doRequest` reads `status`, `headers.get`, `json()` and `blob()` from it.

## SocketIOClientHelper

The socket client (`packages/kernel/src/helpers/socket-io-client.ts`) is outside the helpers barrel and ships only on the `./socket-io` sub-path, so the optional `socket.io-client` peer loads only for an application that imports that sub-path - see [Kernel package](/packages/kernel.md). It is built from `{ identifier, host, options }`, where `options` is socket.io's `SocketOptions` plus a required `path` and `extraHeaders`, and the constructor passes them straight to `io(host, options)`. socket.io connects on `io()` unless `autoConnect` is `false`, a key the options type does not admit, so the socket starts connecting when the helper is built. `connect()` and `disconnect()` forward to the client.

- `subscribe({ events, ignoreDuplicate })` calls each handler as `handler(client, ...args)`: the socket first, the payload after. An event with no handler is skipped, and `ignoreDuplicate` skips an event that already has any listener, not only this handler.
- `unsubscribe({ events })` calls `off(eventName)`, which removes every listener on that event, including ones registered outside the helper.
- `emit({ topic, message, doLog })` throws `getError` with status 400 when the client is not connected, so an emit before the handshake completes throws instead of buffering. It sends no acknowledgement callback.
- `getSocketClient()` returns the raw socket.io `Socket` for anything else.
