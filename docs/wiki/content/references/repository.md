---
title: Repositories
description: The @venizia/ardor/repository sub-path - HttpDataSource and HttpRepository from IGNIS, their settings, what they refuse to guess, and how to bind and resolve them.
---

# Repositories

`@venizia/ardor/repository` (also `@venizia/ardor-kernel/repository`) re-exports the HTTP repository from `@venizia/ignis-connectors/http`. A repository reads one backend resource through a datasource, in the same filter vocabulary an IGNIS server repository uses with its database.

It is a separate sub-path so the root import stays small. `@venizia/ignis-connectors` is an optional peer: install it only if you import this sub-path.

```bash
bun add @venizia/ignis-connectors
```

## Quick Reference

| Export | Kind | What it is |
| --- | --- | --- |
| `HttpDataSource` | class | The HTTP transport: base URL, headers, auth token |
| `HttpRepository<E>` | class | Read access to one resource: `find`, `findOne`, `findById`, `count`, `existsWith` |
| `IHttpDataSourceSettings` | interface | `HttpDataSource` constructor options |
| `IAuthToken`, `TAuthTokenResolver` | types | The token a request carries, and where it comes from |

## HttpDataSource

```ts no-check
interface IHttpDataSourceSettings {
  baseUrl: string; // absolute, or relative to the page: '/api'
  headers?: Headers | Array<[string, string]> | Record<string, string>;
  authToken?: IAuthToken; // wins over the resolver
  authTokenResolver?: () => IAuthToken | undefined;
  onUnauthorized?: () => Promise<boolean> | boolean; // true retries once
}
```

- `baseUrl` may be relative (`'/api'`). It resolves against `location.href` when a request is sent, in a page or a Web Worker, so a dev-server proxy needs nothing more. Where there is no `location` (Bun, a test runner) a relative `baseUrl` throws on the first request; pass an absolute URL there.
- `authTokenResolver: readAuthTokenFromStorage` (from `@venizia/ardor`) sends the token the auth provider stored, the same one the data provider sends.
- `x-request-count` is owned by the datasource: configuring it in `headers` throws. Rows come back as an array and the total in `Content-Range`.
- On a `401`, `onUnauthorized` runs once. Return `true` after refreshing the token to retry the request once.

## HttpRepository

```ts
import { readAuthTokenFromStorage } from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

interface ITicket {
  id: string;
  status: string;
}

export class TicketRepository extends HttpRepository<ITicket> {
  constructor(opts: { dataSource: HttpDataSource }) {
    super({ dataSource: opts.dataSource, resource: 'tickets' });
  }
}

const tickets = new TicketRepository({
  dataSource: new HttpDataSource({
    baseUrl: 'https://api.example.com',
    authTokenResolver: readAuthTokenFromStorage,
  }),
});

export const openTickets = () => tickets.find({ filter: { where: { status: 'OPEN' }, limit: 20 } });
export const openCount = () => tickets.count({ where: { status: 'OPEN' } });
```

| Call | Request | Needs `Content-Range` |
| --- | --- | --- |
| `find({ filter })` | `GET /{resource}?filter=...` | no |
| `find({ filter, options: { shouldQueryRange: true } })` | same, returns `{ data, range }` | yes |
| `findOne({ filter })` | `find` with `limit: 1` | no |
| `findById({ id })` | `GET /{resource}/{id}` | no |
| `count({ where })` | `find` with `limit: 1`, total from the header | yes, unless `countPath` is set |
| `existsWith({ where })` | `find` with `limit: 1` | no |

Pass `countPath` to the constructor when the API has a count route (`GET /{resource}/{countPath}`) instead of a `Content-Range` total.

## What it refuses to guess

These throw instead of answering something that looks right:

- **No `Content-Range` on a count or a range read.** Answering the page size would report 1 for a table of any size.
- **`Content-Range` with an unknown total (`records 0-24/*`).** The fix is the server's count query.
- **A count route that answers no number.** Answering 0 reads as an empty table.
- **A list body that is neither an array nor `{ count, data }`.** Counting it as one row would make `existsWith` true for an empty result.

An empty page is not an error: IGNIS sends `records */0`, and `count` answers `0`.

## Registering a repository

Two ways, as in IGNIS. Both bind a singleton and record the key on the class, so `useRepository({ target })` resolves either, and nothing depends on a class name a production build renames.

**Discovery.** Declare the datasource with `@datasource()` and the repository with `@repository`. `RepositoryTypes.REMOTE` says the repository has no model, and `@repository` injects the datasource into the first constructor parameter. The application binds both at `start()`, with nothing listed in `bindContext()`:

```ts
import {
  datasource,
  readAuthTokenFromStorage,
  repository,
  RepositoryTypes,
  useRepository,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

interface ITicket {
  id: string;
  status: string;
}

@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: '/api', authTokenResolver: readAuthTokenFromStorage });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })
export class TicketRepository extends HttpRepository<ITicket> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'tickets' });
  }
}

export const useTickets = () => useRepository({ target: TicketRepository });
```

A discovered class must be imported before `application.start()`. A class first imported by a lazy route chunk is never bound.

**By hand.** Leave the classes undecorated, inject the datasource by class, and register both in `bindContext()`:

```ts no-check
export class TicketRepository extends HttpRepository<ITicket> {
  constructor(@inject({ target: ApiDataSource }) dataSource: ApiDataSource) {
    super({ dataSource, resource: 'tickets' });
  }
}

// In the application's bindContext()
// ...
this.dataSource(ApiDataSource);
this.repository(TicketRepository);
```

The two ways mix. A `@repository` class may keep `@inject({ target })` on a datasource registered by hand, and a class registered by hand may take a discovered datasource.

See [Binding keys](../best-practices/binding-keys) for how the two ways compare.

## Related

- [Writing services and repositories](../best-practices/services)
- [Hooks](./hooks) - `useRepository`
- [Network layer](./network) - the data provider's own transport
