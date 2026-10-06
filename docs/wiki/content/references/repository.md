---
title: Repositories
description: The @venizia/ardor/repository sub-path - HttpDataSource and HttpRepository from IGNIS, their reads and writes, what they refuse to guess, and how to bind and resolve them.
---

# Repositories

`@venizia/ardor/repository` (also `@venizia/ardor-kernel/repository`) re-exports the HTTP repository from `@venizia/ignis-connectors/http`. A repository reads and writes one backend resource through a datasource, in the same filter vocabulary an IGNIS server repository uses with its database.

It is a separate sub-path so the root import stays small. `@venizia/ignis-connectors` is an optional peer: install it only if you import this sub-path.

```bash
bun add @venizia/ignis-connectors@next
```

## Quick Reference

| Export | Kind | What it is |
| --- | --- | --- |
| `HttpDataSource` | class | The HTTP transport: base URL, headers, auth token, and `request()` for any other route |
| `HttpRepository<E, P>` | class | One resource: reads (`find`, `findOne`, `findById`, `count`, `existsWith`) and writes (`create`, `updateById`, `updateBy`, `deleteById`, `deleteBy`). `P` is what a write sends, `Partial<E>` by default |
| `IHttpDataSourceSettings` | interface | `HttpDataSource` constructor options |
| `IHttpReadResult`, `IHttpWriteResult` | interfaces | What `read()` and `write()` answer |
| `IAuthToken`, `TAuthTokenResolver`, `THttpHeaders`, `THttpBody` | types | The token a request carries and where it comes from, headers, a request body |

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
- **Send what the data provider sends:** spread `dataProvider.getDataSourceAuth()` into the settings. It supplies `headersResolver`, `authTokenResolver`, `onUnauthorized` and `errorRootKey`, read on every send: the session headers set with `setHeaders()`, the timezone, the request channel and tracing id, the data provider's token (including one set with `setAuthToken`) except on a no-auth path, and the server's error code under `error`. A `401` on either transport triggers one `refreshToken` call. See [auth recovery](../best-practices/auth-recovery#where-tokens-live).
- `request({ paths, method, body, headers })` answers the raw `Response`, for a route the repository verbs do not cover, such as an export or a `PUT` to a hand-written route. A plain object or array goes out as JSON; a string, `Blob`, `FormData`, `URLSearchParams` or binary goes out as it is. A stream does not: the `401` retry resends the same body.

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

### Writes

```ts
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

const tickets = new HttpRepository<{ id: string; status: string }>({
  dataSource: new HttpDataSource({ baseUrl: 'https://api.example.com' }),
  resource: 'tickets',
});

export const closeStale = async () => {
  const { data: created } = await tickets.create({ data: { status: 'OPEN' } });
  await tickets.updateById({ id: created.id, data: { status: 'DONE' } });
  await tickets.updateBy({ where: { status: 'OPEN' }, data: { status: 'STALE' } });
  await tickets.deleteBy({ where: { id: { inq: ['1', '2'] } }, options: { shouldReturn: false } });
};
```

| Call | Request |
| --- | --- |
| `create({ data })` | `POST /{resource}` |
| `updateById({ id, data })` | `PATCH /{resource}/{id}` |
| `updateBy({ where, data })` (also `updateAll`) | `PATCH /{resource}`, `where` in the body beside `data` |
| `deleteById({ id })` | `DELETE /{resource}/{id}` |
| `deleteBy({ where })` (also `deleteAll`) | `DELETE /{resource}`, `where` in the body |

- Every write answers `{ count, data }`: `count` from the server's `x-response-count`, `data` the row or the rows it returned. `options: { shouldReturn: false }` answers `data: null`.
- The id is URL-encoded, for reads too: `'a/b'` is sent as `a%2Fb`, not as another route.
- There is no `createAll`: the IGNIS REST contract has no bulk-create route.
- A bulk write needs a server that reads `where` from the body, as the IGNIS generated routes do. This is the same contract as the data provider's `updateMany` and `deleteMany`.

## What it refuses to guess

These throw instead of answering something that looks right:

- **No `Content-Range` on a count or a range read.** Answering the page size would report 1 for a table of any size.
- **`Content-Range` with an unknown total (`records 0-24/*`).** The fix is the server's count query.
- **A count route that answers no number.** Answering 0 reads as an empty table.
- **A list body that is neither an array nor `{ count, data }`.** Counting it as one row would make `existsWith` true for an empty result.
- **An empty `where` on `updateBy` or `deleteBy`.** The IGNIS bulk routes answer it with a `400`, and `force` cannot cross HTTP, so it throws before any request is sent.

An empty page is not an error: IGNIS sends `records */0`, and `count` answers `0`.

A failed request throws an error with the server's status. Its message ends with the URL and then the server's message, such as `[http][read] 404 | <url> | Ticket not found`. Its `normalized.code` and `normalized.args` are the server's, so `useNotifyError` fills a translated message's placeholders. Match on the status or the code, not on the message text.

## Registering a repository

Two ways, as in IGNIS. Both bind a singleton and record the key on the class, so `useRepository({ target })` resolves either without reading a class name a production build renames.

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

> [!WARNING]
> Without an `@inject` on its first parameter, `@repository` asks for the datasource under `datasources.<ClassName>`, read from the class name when the class is decorated (IGNIS kernel `0.2.1-2`). That holds for an unpinned `@datasource()`: both sides read the same name, renamed or not. When the datasource pins its key with `binding: { namespace, key }`, a minified build renames the class and the repository asks for a key nothing is bound under: `Binding key: datasources.Zv is not bounded in context!`. Then inject it by class, which reads the key recorded on the class:
>
> ```ts
> constructor(@inject({ target: ApiDataSource }) dataSource: ApiDataSource) {
>   super({ dataSource, resource: 'tickets' });
> }
> ```

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
