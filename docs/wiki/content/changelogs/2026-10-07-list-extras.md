---
title: List extras on the data provider and the repository
description: ARDOR adopts IGNIS list extras - getList asks with meta.extra and answers meta.extra, and reads a route's default extras unasked.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin']
---

# Changelog - 2026-10-07

## List extras on the data provider and the repository

<Badge type="tip" text="New Feature" />

**In one line.** An IGNIS route can compute extras beside the rows, such as facet counts. ARDOR's data provider now asks for them with `meta.extra` and returns them in `meta.extra`, and it no longer mistakes a route's default `{ data, extra }` body for one row.

## What changed

- **Asking.** `getList` and `getManyReference` take `meta.extra` (a `TExtraRequest`) and send it in the `x-request-extra` header. It is no longer sent as a query parameter; every other `meta` key still is. `getRequestProps({ extra })` builds the header for any call.
- **Answering.** When the response carries `x-response-extra`, the data provider unwraps `{ data, extra }`. Rows and total read as before, and `getList` and `getManyReference` return `meta: { extra }`. `doRequest` and `send` return `extra` beside `data`. A body without that header is never read as extras.
- **The count stays.** A request that asks for the count in the body (`RequestCountData.DATA_WITH_COUNT`) keeps its `count` beside the rows.
- **The repository.** `@venizia/ardor/repository` re-exports `HttpExtraRequest`, `TExtraRequest` and `TExtraResult`. `HttpRepository.find({ options: { extra } })` returns `extra`.
- **IGNIS versions.** Needs `@venizia/ignis-kernel` `>=0.2.1-5 <0.3.0` and `@venizia/ignis-helpers` `>=0.2.1-2 <0.3.0`. The data provider reads extras through `@venizia/ignis-kernel/repository`, so it does not need the optional `@venizia/ignis-connectors` peer; if you use connectors, it must be `>=0.2.1-7 <0.3.0`.

## Who is affected

- **Applications whose server adds a default extra to a route.** Upgrade ARDOR first: an older data provider reads `{ data, extra }` as a single row.
- **Code that passed `meta.extra` as a query parameter.** It is now the extras request. Rename the key.
- **A cross-origin server.** It must allow `x-request-extra` and expose `x-response-extra`, or the browser drops them.

See [the data provider](../references/data-provider) and [repositories](../references/repository).
