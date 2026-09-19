---
title: IGNIS stereotypes and repositories, bulk writes in the body, safer headers
description: Classes register by stereotype, HTTP repositories come from IGNIS, bulk writes send their selector in the body, and requests work on plain-http origins.
---

# Changelog - 2026-09-19

## IGNIS stereotypes and repositories, bulk writes in the body, safer headers

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="New Feature" /> <Badge type="info" text="Bug Fix" />

**In one line.** ARDOR now builds on `@venizia/ignis-kernel`: decorated classes register themselves, HTTP repositories come from IGNIS, `updateMany`/`deleteMany` send one request with the selector in the body, and an app served over plain http no longer fails every request.

This entry covers everything since `0.1.1-2`.

## What changed

### New

- **Classes register by stereotype.** `@service()`, `@component()`, `@configuration()`, `@provide()` and the rest are exported from `@venizia/ardor`. A decorated class is bound as a singleton when the application starts, so it no longer needs to be listed in `bindingList()`.
- **Resolve by class, not by string.** `useService`, `useProvider`, `useComponent` and `useConfiguration` take `{ target: SomeClass }` and return that class's type. Each one checks the namespace, so `useService({ target: SomeComponent })` throws and names both keys.
- **HTTP repositories.** `@venizia/ardor/repository` re-exports `HttpDataSource` and `HttpRepository` from `@venizia/ignis-connectors/http`. They speak the same filter vocabulary as the data provider and read totals from `Content-Range`. When a total is asked for and the server reports none, they throw instead of guessing one.
- **One stored token for both transports.** `readAuthTokenFromStorage` is exported, and `DefaultNetworkRequestService` takes an `authTokenResolver` option. Pass the same resolver to an `HttpDataSource` and both transports send the same token.

### Fixed

- **Plain-http origins work.** `x-request-id` came from `crypto.randomUUID`, which browsers only expose on https and localhost. Every request carries that header, so an app opened at `http://<lan-ip>` failed on every call. It now uses `uuidV4` from `@venizia/ignis-helpers/uuid`.
- **`updateMany` works against IGNIS.** It sent `filter.where` in the query, which a generated IGNIS bulk route does not read, so every call answered `400`.
- **Header overrides replace instead of joining.** Header names are matched case-insensitively. `X-Request-Count` beside `x-request-count` used to reach the server as `"1, 0"`. `removeHeaders` also removes a header whatever case it was set in.
- **No `x-auth-provider: undefined`.** A token that names no provider now sends no `x-auth-provider` header at all.
- **`localStorage` is read only when needed.** It used to be read on every request, even when a token had been set with `setAuthToken`, so the service crashed anywhere without a DOM.
- **Form values keep what the caller sent.** `0`, `false` and `''` are no longer dropped. A `Date` is sent as ISO-8601 and an object as JSON, not `"[object Object]"`. A `File` in a URL-encoded body throws and names the field, instead of arriving as `{}`. List filters with a falsy value are kept too.

## Who is affected

- **Every application.** Install the new peers: `@venizia/ignis-kernel` and `@venizia/ignis-helpers`, plus the raised floors on `@venizia/ignis-inversion` and `@venizia/ignis-filter`.
- **Applications whose decorated classes were also bound by hand.** The stereotype binding is applied first and the explicit one after it, so under the same key the explicit binding wins. Under a different key both exist.
- **Applications that call `updateMany` or `deleteMany`.** Their backend must accept `where` in the request body. See the breaking changes below.
- **Code that compared header names to the literal `'Timezone'`.** `HeaderConsts.TIMEZONE` is now `'timezone'`. What goes on the wire is unchanged.
- **Applications that never import `@venizia/ardor/repository`.** They do not need `@venizia/ignis-connectors`; it is an optional peer.

## Breaking changes

> [!WARNING]
> `updateMany` and `deleteMany` now need a backend whose bulk routes read `where` from the body. IGNIS generated routes do from `@venizia/ignis` `0.2.0-46`. A route that reads only the query answers `400` and writes nothing. That includes a hand-written override of the bulk handler.

**Before:**

```http
PATCH  /products?filter={"where":{"id":{"inq":[...]}}}   body: { "status": "ARCHIVED" }
DELETE /products/p-1
DELETE /products/p-2
...one request per id
```

**After:**

```http
PATCH  /products   body: { "status": "ARCHIVED", "where": { "id": { "inq": [...] } } }
DELETE /products   body: { "where": { "id": { "inq": [...] } } }
```

- An id list in the URL is capped by the request line. An IGNIS server answered `431` at 400 UUIDs, and a proxy with 8k header buffers refuses sooner.
- The old `deleteMany` fired one `DELETE` per id. If one failed, the rest had already been deleted and the screen reported a single error.
- Both calls now return `{ data: ids }`, taken from the rows the server reports as written. They used to return the raw rows. An id that no longer exists is not reported.
- `updateMany` refuses `data` that has its own `where` field, because the route reads that key as the row selector. Update those records one by one with `update()`.

**Peers.** Every `ardor-kernel` consumer now installs these:

```bash
bun add @venizia/ignis-kernel @venizia/ignis-helpers
```

## Details

```ts
import { service, useService } from '@venizia/ardor';

@service()
export class AuditService {
  record(opts: { action: string }): string {
    return `audit:${opts.action}`;
  }
}

// Typed as AuditService - no generic, no string key.
export const useAudit = () => useService({ target: AuditService });
```

```ts
import { readAuthTokenFromStorage } from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

const dataSource = new HttpDataSource({
  baseUrl: 'https://api.example.com',
  authTokenResolver: readAuthTokenFromStorage,
});

const tickets = new HttpRepository<{ id: string; title: string; status: string }>({
  dataSource,
  resource: 'tickets',
});

// `count` reads the total from Content-Range, and throws if the server reported none.
export const countOpen = () => tickets.count({ where: { status: 'OPEN' } });
```

- ARDOR's contract suite runs these behaviours against the published connector: a `records */N` total, a list body opened from the `{ count, data }` envelope, a refused `x-request-count` setting, and two spellings of one header name collapsing to one value.
- `uuidV4` counts inside the kernel's 7.7 kB budget, and the kernel still shrank from 6.42 to 6.33 kB. The `ardor-react` budget moved from 2.0 to 2.5 kB; the package itself did not grow.
- Nothing lints against another secure-context-only API. Any new call to one has to be caught in review.

| File | Package |
|------|---------|
| `src/base/applications/abstract.ts` (`registerArtifacts`) | kernel |
| `src/base/metadata/index.ts` (stereotype re-exports) | kernel |
| `src/base/repositories/index.ts` (`./repository`) | kernel, ardor |
| `src/base/services/network-request.ts` | kernel |
| `src/common/constants.ts` (`HeaderConsts`) | kernel |
| `src/hooks/use-artifact.ts`, `src/hooks/use-injectable.ts` | react |
| `src/providers/rest-data.ts` | admin |
| `package.json` peers and exports | kernel, react, admin, ardor |
