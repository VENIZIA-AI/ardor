---
type: Concept
title: Data provider pipeline
description: How a react-admin data call travels through DefaultRestDataProvider into an IGNIS-shaped HTTP request and back into a react-admin result.
resource: packages/admin/src/providers/rest-data.ts
tags: [architecture, data-provider, react-admin, ignis, rest]
---

# Data provider pipeline

ARDOR has no controllers, repositories or datasources. Instead, all data access from the admin UI goes through a single pipeline: react-admin calls a method on a data provider, and that provider translates the call into an HTTP request, then translates the response back. `DefaultRestDataProvider` (and its subclass `CountRestDataProvider`) is the concrete implementation ARDOR ships, built with IGNIS as the container that constructs it - see [Data provider pipeline](/architecture/data-provider-pipeline.md) itself for the shape, and [Dependency injection in the browser](/architecture/di-in-the-browser.md) for how the provider gets wired into an application.

## The pipeline, step by step

1. **react-admin call.** react-admin invokes a method like `getList`, `getOne`, `getMany`, `create`, `update`, `delete`, always positionally: `dataProvider.getList(resource, params)`.
2. **DefaultRestDataProvider method.** Internally the class implements each call as an options object (`getList({ resource, params })`), not positional arguments. This is the class's own internal convention, distinct from what react-admin sees.
3. **Filter mapping to the IGNIS vocabulary.** react-admin's `pagination`, `sort`, `filter`, and `meta` are rewritten into the IGNIS filter shape: `{ where, order, limit, skip, offset, include, fields }`, serialised as JSON under a single `filter` query key. Rules of note:
   - If `filter.where` already exists, the whole filter is used as-is - the caller is writing raw IGNIS filter.
   - Otherwise every key of `filter` except `include`, `params`, `noLimit`, `fields` becomes `where`; those four are lifted to the top level.
   - `sort.field`/`sort.order` become `order: ["<field> <ASC|DESC>"]`.
   - `pagination` becomes `limit = perPage`, `skip = offset = (page - 1) * perPage`, unless `noLimit` is set, in which case limit/skip/offset are all cleared.
   - `filter.params` is pulled out into top-level query keys (not part of the filter object), and every key of `meta` also becomes a query key.
   - `getManyReference` additionally sets `where[target] = id`.
4. **getRequestProps (headers/body).** The provider asks its internal `DefaultNetworkRequestService` for request props, passing `restDataProviderOptions` and `applicationInfo`. This is where `requestTracingId`, `requestTracingChannel`, auth headers, and any other cross-cutting request shaping happen. See [Header protocol](/architecture/header-protocol.md) for what ends up in the headers.
5. **doRequest.** The network service performs the actual fetch, given `paths`, `query` (including the serialised filter), `method`, `headers`, `body`, and `requestCountData` (always `RequestCountData.DATA_ONLY` for these calls).
6. **parseResponse / convertResponse.** The raw HTTP response is parsed and converted into the shape react-admin expects for that specific call (`{ data }`, `{ data, total }`, etc).
7. **react-admin result.** The converted result is returned up through `value()` back to react-admin, which never sees the IGNIS filter vocabulary or the network layer directly.

## The positional `value()`

`DefaultRestDataProvider` is itself an IGNIS provider: the container constructs it via `@inject`, and `value(container)` is the method that returns the object react-admin actually uses. `value()` is what converts the class's internal options-object methods into the positional shape react-admin requires (`getList(resource, params)` rather than `getList({ resource, params })`). `send` and `getNetworkService` are exempted from this repositioning and keep their own object-shaped signatures on the returned value. This split matters: if you call the class's methods directly (as in tests) you use the options-object form; if you call through the data provider react-admin holds, you use the positional form.

## CountRestDataProvider

`CountRestDataProvider` subclasses `DefaultRestDataProvider` and, for list-producing calls (`getList`, `getManyReference`), issues a second request to `/{resource}/count` alongside the data request, carrying the same `where` and query keys, so react-admin gets both `data` and `total`. That count request always uses `RequestTypes.SEND` rather than the list-specific request type.

## send()

`send()` is the escape hatch for endpoints that don't fit the five CRUD shapes: it takes `params.method`, `params.query` (passed straight through, not filter-mapped), and a body built from `params.body`/`bodyType`, then runs through the same `getRequestProps` -> `doRequest` -> response-conversion steps as every other call. It is the one method, along with `getNetworkService`, that `value()` leaves untouched in positional form.
