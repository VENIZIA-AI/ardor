---
type: Concept
title: Data provider pipeline
description: How a react-admin data call travels through DefaultRestDataProvider into an IGNIS-shaped HTTP request and back into a react-admin result.
resource: packages/admin/src/providers/rest-data.ts
tags: [architecture, data-provider, react-admin, ignis, rest]
---

# Data provider pipeline

ARDOR has no controllers, repositories or datasources. Instead, all data access from the admin UI goes through a single pipeline: react-admin calls a method on a data provider, and that provider translates the call into an HTTP request, then translates the response back. `DefaultRestDataProvider` (and its subclass `CountRestDataProvider`) is the concrete implementation ARDOR ships. It is an IGNIS provider constructed by the application container - see [Dependency injection in the browser](/architecture/di-in-the-browser.md) for how it is bound.

## The pipeline, step by step

1. **react-admin call.** react-admin invokes a method like `getList`, `getOne`, `getMany`, `create`, `update`, `delete`, always positionally: `dataProvider.getList(resource, params)`.
2. **DefaultRestDataProvider method.** Internally the class implements each call as an options object (`getList({ resource, params })`), not positional arguments. This is the class's own internal convention, distinct from what react-admin sees.
3. **Filter mapping to the IGNIS vocabulary.** For `getList` and `getManyReference`, react-admin's `pagination`, `sort`, `filter`, and `meta` are rewritten into the IGNIS filter shape: `{ where, order, limit, skip, offset, include, fields }`, serialised as JSON under a single `filter` query key. Rules of note:
   - If `filter.where` already exists, the whole filter is used as-is - the caller is writing raw IGNIS filter.
   - Otherwise every key of `filter` except `include`, `params`, `noLimit`, `fields` becomes `where`; those four are lifted to the top level.
   - `sort.field`/`sort.order` become `order: ["<field> <ASC|DESC>"]`.
   - `pagination` becomes `limit = perPage`, `skip = offset = (page - 1) * perPage`, unless `noLimit` is set, in which case limit/skip/offset are all cleared.
   - Every other top-level `params` key (beyond `pagination`, `sort`, `filter`, `meta`, and `target`/`id` for `getManyReference`) is then copied onto the top level of the filter object, after sort and pagination, so a same-named key wins. Only `undefined` and `null` are skipped.
   - `filter.params` is pulled out into top-level query keys (not part of the filter object), and every key of `meta` also becomes a query key.
   - `getManyReference` additionally sets `where[target] = id`.

   The other calls do no such mapping. `getOne` and `getMany` take a ready IGNIS filter from `params.meta.filter` (its `params` become query keys; other `meta` keys are ignored), and `getMany` adds `where.id = { inq: ids }`. `updateMany` PATCHes the collection and `deleteMany` sends one DELETE to it, both with the selector `where.id = { inq: ids }` in the BODY and nothing in the query - an id list on the request line drew `431` at 400 UUIDs from an IGNIS server. The route takes `where` from the query or the body, never both (`400`), and answers `400` without writing where it reads only the query. `updateMany` refuses `data` carrying its own `where` field, since the route reads that key as the selector. Both results are `{ data: ids }` taken from the affected rows the route answers, not from `params.ids`; a body that is not a row array leaves `data` out. `getMany` is still a GET, so its `inq` stays in the URL.
4. **getRequestProps (headers/body).** The provider asks its internal `DefaultNetworkRequestService` for request props, passing `restDataProviderOptions` and `applicationInfo`. This is where `requestTracingId`, `requestTracingChannel`, auth headers, and any other cross-cutting request shaping happen. See [Header protocol](/architecture/header-protocol.md) for what ends up in the headers.
5. **doRequest.** The network service performs the actual fetch, given `paths`, `query` (including the serialised filter), `method`, `headers`, `body`, and `requestCountData` (always `RequestCountData.DATA_ONLY` for these calls).
6. **parseResponse / convertResponse.** The raw HTTP response is parsed and converted into the shape react-admin expects for that specific call (`{ data }`, `{ data, total }`, etc).
7. **react-admin result.** The converted result is returned up through `value()` back to react-admin, which never sees the IGNIS filter vocabulary or the network layer directly.

## The positional `value()`

`DefaultRestDataProvider` is itself an IGNIS provider: the container constructs it via `@inject`, and `value(container)` is the method that returns the object react-admin actually uses. `value()` is what converts the class's internal options-object methods into the positional shape react-admin requires (`getList(resource, params)` rather than `getList({ resource, params })`). `send` and `getNetworkService` are exempted from this repositioning and keep their own object-shaped signatures on the returned value. This split matters: if you call the class's methods directly (as in tests) you use the options-object form; if you call through the data provider react-admin holds, you use the positional form.

## CountRestDataProvider

`CountRestDataProvider` subclasses `DefaultRestDataProvider` and, for list-producing calls (`getList`, `getManyReference`), issues a second request to `/{resource}/count` alongside the data request, carrying the same `where` and query keys, so react-admin gets both `data` and `total`. That count request always uses `RequestTypes.SEND` rather than the list-specific request type.

## send()

`send()` is the escape hatch for endpoints that don't fit the five CRUD shapes. It throws without `params.method`, and `params.query` is passed straight through, not filter-mapped. `params.headers` are merged over the computed headers (per-call wins, values coerced to strings), `params.requestType` overrides the default `RequestTypes.SEND` (which decides how `convertResponse` shapes the result), and `params.requestCountData` is forwarded. `body` and `bodyType` go to `getRequestProps`; `id`, `file` and any other key are ignored, and the path is always `[resource]` alone. The request then runs through the same `doRequest` -> response-conversion steps as every other call. `send()` is the only call that honours `bodyType` - `create`, `update` and `updateMany` pass none, so they always take the JSON default. It is the one method, along with `getNetworkService`, that `value()` leaves untouched in positional form.

## What gets encoded, and what gets dropped

When ARDOR copies params onto the filter, builds the query string, or builds a form body, it drops only `undefined` and `null` - never other falsy values, so `0`, `false` and `''` are sent.

- **Query string.** Built by `stringify`: strings and numbers are sent as-is; objects, arrays and booleans are JSON-encoded, which is how `filter` travels.
- **`x-www-form-urlencoded` and `form-data` bodies.** A `Date` is sent as ISO-8601, an object or array as JSON, any other primitive via `String()`. Only `form-data` carries files: a `Blob`/`File` is appended with its `name` as filename, and a top-level array or `FileList` value becomes repeated entries under the same key. In `x-www-form-urlencoded` a `Blob` is encoded like any other object and arrives as `{}`.

For the `content-type` each body type sets and how a JSON body is serialised, see [Header protocol](/architecture/header-protocol.md).
