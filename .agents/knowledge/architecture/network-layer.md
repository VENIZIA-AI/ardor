---
type: Concept
title: Network layer
description: The fetch transport beneath DefaultNetworkRequestService - the IGNIS NodeFetchNetworkRequest it sends through, query and body encoding, headers, response decoding and the traps in each - and where the socket client lives now.
resource: packages/kernel/src/helpers/networks
tags: [architecture, network, transport, fetch, kernel, ignis]
---

# Network layer

Every HTTP call ARDOR makes goes down one stack: `DefaultRestDataProvider` asks `DefaultNetworkRequestService` for request props (`getRequestProps`), then calls `doRequest`, which joins the URL through a `NodeFetchNetworkRequest` and hands the request to its fetcher, which calls the platform `fetch`. The transport is the IGNIS one (`@venizia/ignis-helpers/core`); ARDOR keeps no fork of it. There is no second transport. This concept covers the layer from `doRequest` down. What sits on top has its own home: the headers in [Header protocol](/architecture/header-protocol.md), the filter mapping in [Data provider pipeline](/architecture/data-provider-pipeline.md), the one 401 retry in [Auth recovery](/architecture/auth-recovery.md) and a non-2xx or failed request in [Error flow](/architecture/error-flow.md).

## The pieces

- **`NodeFetchNetworkRequest`** (IGNIS, `@venizia/ignis-helpers/core`) holds a base URL and a `NodeFetcher`. `getRequestUrl({ baseUrl, paths })` strips one trailing `/` from the base, prefixes each path segment with `/` when it lacks one and joins the segments with nothing between them, so `['users', '1']` becomes `/users/1`. An empty base throws. `getNetworkService()` returns the fetcher, whose `send` resolves the Fetch `Response`.
- **`DefaultNetworkRequestService`** builds one in its constructor, with `queryString: { nullish: 'skip', nested: 'json' }` (below), and keeps it in the protected `networkRequest`. `doRequest` checks `baseUrl` itself before joining, with a `getError` that carries no status (so 400).

## What doRequest sends

`doRequest` calls `send` with the joined `url`, `method`, `params` (its `query`), `headers` exactly as passed, and `body` - dropped for `GET`, sent for every other method - and passes its own `Logger` as the second argument. It passes no `timeout` and no `signal`.

**Query string.** The transport writes `params` into the url with IGNIS's `toQueryString`, configured by the service as `{ nullish: 'skip', nested: 'json' }`: `undefined` and `null` leave the pair out, a string or number is written as it is, and an object or an array is ONE JSON-encoded parameter (`filter={"where":{}}`, `ids=[1,2]`). That is the shape an IGNIS server reads; the IGNIS defaults would drop the filter object and repeat an array's key. A space is written `%20`. The `?` is used when the url has no query, and `&` when it already has one.

## Body encoding

A body is shaped twice. First `getRequestProps` (`packages/kernel/src/base/services/network-request.ts`) builds it by `bodyType`, through the protected hook `encodeBody` and the `RequestBodyEncoder` it delegates to (`packages/kernel/src/helpers/networks/request-body-encoder.ts`) - the `content-type` each type sets is in [Header protocol](/architecture/header-protocol.md):

- **`x-www-form-urlencoded`** builds a `URLSearchParams`. **`form-data`** builds a `FormData`. Both skip a key only when its value is `undefined` or `null`, so `0`, `false` and `''` are sent. A `Date` becomes ISO-8601, an object or array becomes JSON, any other primitive goes through `String()`.
- Only `form-data` carries files: a `Blob` or `File` is appended with its `name` as the filename, and a top-level array or `FileList` becomes repeated entries under one key, each item encoded by the same rules. In `x-www-form-urlencoded` a `Blob` is just an object and arrives as `{}`. The `form-data` branch sets no `content-type`, but it does not remove one either: a `content-type` among the service's stored headers still goes out and replaces the multipart boundary.
- **Every other case** (`json`, `none`, `binary`, or no `bodyType`) passes the body through untouched.

Then the fetcher passes a string, `Blob`, `ArrayBuffer`, typed array, `FormData`, `URLSearchParams` or `ReadableStream` straight to `fetch` and `JSON.stringify`s a plain object or an array, so a `binary` body is sent as its bytes and a string is not quoted a second time; no body stays no body. A `timeout` is combined with the caller's `signal` through `AbortSignal.any`, so either aborts the request. The request is logged at debug level only, to the logger `doRequest` passes; the body is never logged and the headers pass through `redactSecrets`. With no logger the fetcher logs nothing.

## Traps for a transport author

- **Timeouts never fire from the data provider.** The fetcher honours a `timeout` and clears the timer as soon as `fetch` resolves, so reading the body is not timed, but `doRequest` never passes one. A caller that sends through `getNetworkService().send` can.
- **A call's `headers` replace the defaults; a call with none keeps them.** The service's headers arrive because `getRequestHeader` merges its own copy into every call, so a `doRequest` called without `headers` sends the transport's defaults (`content-type: application/json; charset=utf-8`) and none of the service's. The `form-data` branch of the body encoder sets no `content-type`, and the fetcher does not add or strip one, so `fetch` writes the multipart boundary - unless a `content-type` header is passed in, which replaces it.
- **`doRequest` passes the upper-case `RequestMethods` values** (`GET`, `PATCH`, ...). The Fetch standard upper-cases most methods but not `patch`, so a lowercase one would reach the server as written from a browser.

## What comes back

After the retry and the non-2xx throw (an `ApplicationError`, see [Error flow](/architecture/error-flow.md)), `ResponseReader.read` (`packages/kernel/src/helpers/networks/response-reader.ts`) decodes a 2xx response:

- A 204 returns `{ data: {} }`.
- A `content-disposition` starting with `attachment` (`HeaderConstants.ATTACHMENT_CONTENT_DISPOSITION_RE`), or a `content-type` that is missing or not textual per `HeaderConstants.TEXTUAL_CONTENT_TYPE_RE`, returns `rs.blob()` as `data`, plus `filename` (read from `filename*=` first, then a quoted, then a bare `filename=`) and `contentDisposition` when present.
- Anything else goes through `rs.json()` and then `convertResponse`, which reads the totals described in [Header protocol](/architecture/header-protocol.md).

The textual pattern admits `text/*` and XML, but those bodies are still parsed with `rs.json()`, so a 2xx `text/plain` or XML response rejects with a `SyntaxError`. A 2xx response with no `content-type` comes back as a `Blob`.

## Replacing the transport

Three seams, widest first. A provider subclass overrides `request()` - one override moves every method and `send()`; [ipc-data-provider](/examples/ipc-data-provider.md) walks the older, per-method form. A `DefaultRestDataProvider` subclass can assign its own `DefaultNetworkRequestService` subclass to the protected `networkService` and override `doRequest`. Narrowest, a service subclass can assign the protected `networkRequest` an IGNIS `NodeFetchNetworkRequest` (or a `BaseNetworkRequest<'node-fetch'>` with its own fetcher). That fetcher must resolve a Fetch `Response`: `doRequest` reads `status`, `headers.get`, `json()` and `blob()` from it.

## The socket client

ARDOR has none. A browser application uses the IGNIS one, `SocketIOClientHelper` from `@venizia/ignis-helpers/socket-io/client`, which has nothing node in its graph and is handed `socket.io-client` by the application: `new SocketIOClientHelper({ identifier, host, options, module: { io } })` with `io` from the application's own `import`. See [Socket.IO client](/extensions/socket-client).
