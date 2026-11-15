---
title: Repositories
description: Using HttpRepository and HttpDataSource in ARDOR, bridging credentials with getDataSourceAuth, the Content-Range counting rule, and repository registration.
---

# Repositories

`HttpRepository` reads and writes one remote backend resource over an `HttpDataSource`, with IGNIS query filters. Declare the datasource and the repository with their stereotypes, and resolve the repository by its class:

<<< @/../../../examples/5-mins-qs/src/datasources/api.datasource.ts{ts}

<<< @/../../../examples/5-mins-qs/src/repositories/product.repository.ts{ts}

`@datasource()` and `@repository()` register the classes when `start()` runs, and `@repository` injects the datasource into constructor parameter 0. A component reads the repository with `Ardor.useRepository({ target: ProductRepository })`. To register by hand instead, call `this.dataSource(ApiDataSource)` and `this.repository(ProductRepository)` in `bindContext()` (see [Application](./application)).

> [!NOTE]
> `HttpRepository` and `HttpDataSource` come from `@venizia/ardor/repository`, which re-exports `@venizia/ignis-connectors/http`. That package is an optional peer: run `bun add @venizia/ignis-connectors` before you import the sub-path.

## Settings of an HttpRepository

| Option | Type | Default | Meaning |
|---|---|---|---|
| `dataSource` | `HttpDataSource` | - | The datasource the requests go through |
| `resource` | `string` | - | The first path segment, such as `products` |
| `countPath` | `string` | none | A count route: `count` reads the total from `GET /{resource}/{countPath}` and not from `Content-Range` |
| `findOnePath` | `string` | none | A find-one route: `findOne` asks `GET /{resource}/{findOnePath}`; without it, it asks the list route with `limit: 1` |
| `defaultLimit` | `number` | none | The page size `find` asks for when its filter names no limit. A positive integer, else the constructor throws |
| `searchPath` | `string` | `'search'` | The segment of the search route: `POST /{resource}/{searchPath}` |

Pass them to `super({ ... })` from the repository's constructor.

## Bridging credentials with getDataSourceAuth()

To share credentials, session headers, timezone settings, and 401 recovery with the REST data provider, spread `dataProvider.getDataSourceAuth()` (returning `authTokenResolver`, `headersResolver`, `onUnauthorized`, and `errorRootKey`) into the `HttpDataSource` settings (see [Data provider](data-provider)). The datasource asks the container for the data provider, which is the one react-admin uses:

```ts
import { CoreBindings, datasource, type IDataProvider, inject } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

@datasource()
export class SharedSessionDataSource extends HttpDataSource {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) dataProvider: IDataProvider,
  ) {
    super({ baseUrl: 'https://api.example.com', ...dataProvider.getDataSourceAuth() });
  }
}
```

## Reading data and the Content-Range rule

| Method | HTTP Request | Requires `Content-Range` |
|---|---|---|
| `find({ filter })` | `GET /{resource}?filter=...` | No |
| `find({ filter, options: { shouldQueryRange: true } })` | `GET /{resource}?filter=...` | Yes (returns `{ data, range }`) |
| `findOne({ filter })` | `GET /{resource}?filter=...` (`limit: 1`), or `GET /{resource}/{findOnePath}` | No |
| `findById({ id })` | `GET /{resource}/{id}` | No |
| `count({ where })` | `GET /{resource}?filter=...` (`limit: 1`) | Yes (unless `countPath` is configured) |
| `existsWith({ where })` | `GET /{resource}?filter=...` (`limit: 1`) | No |
| `search({ input })` | `POST /{resource}/{searchPath}` | No |

- `count({ where })` executes `GET /{resource}?filter={"where":...,"limit":1}` and reads the total count from the `Content-Range` response header.
- The `Content-Range` header format must be `<unit> <start>-<end>/<total>` (for example, `records 0-0/42`) or `records */<total>` for an empty page.
- The repository refuses to guess: if `Content-Range` is missing, `count` throws an error rather than falling back to the page size (which would report 1 for tables of any size).
- Cross-origin requests require the server to expose `Content-Range` in `Access-Control-Expose-Headers`.
- If `Content-Range` carries an unknown total (`records 0-0/*` or `*/*`), `count` throws an error.
- When an API exposes a dedicated count endpoint instead of `Content-Range`, pass `countPath` to `HttpRepository` (for example, `countPath: 'count'`). It then queries `GET /{resource}/{countPath}` with query `{ where }` and reads `{ count: number }` from the response body. If the response does not contain a finite number under `count`, it throws.
- `search({ input })` posts `input` (`{ mode: 'keyword', query }` and the other modes) and answers `{ found, isFoundExact, hits }`. `found` is the total, and `isFoundExact` is `false` when it is an estimate. An answer without `found` and `hits` throws.

```ts
import { datasource, repository, RepositoryTypes } from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface Article {
  id: string;
  status: string;
  views: number;
}

@datasource()
export class ArticleDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'https://api.example.com' });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: ArticleDataSource })
export class ArticleRepository extends HttpRepository<Article> {
  constructor(dataSource: ArticleDataSource) {
    super({ dataSource, resource: 'articles', defaultLimit: 25 });
  }

  loadPublished() {
    return this.find({
      filter: {
        where: { status: 'published' },
        order: ['views DESC'],
        limit: 10,
      },
    });
  }

  countPublished() {
    return this.count({ where: { status: 'published' } });
  }

  searchByKeyword(opts: { query: string }) {
    return this.search({ input: { mode: 'keyword', query: opts.query } });
  }
}
```

## Writing data

| Method | HTTP Request | Body payload |
|---|---|---|
| `create({ data })` | `POST /{resource}` | `data` |
| `updateById({ id, data })` | `PATCH /{resource}/{id}` | `data` |
| `updateBy({ where, data })` | `PATCH /{resource}` | `{ ...data, where }` |
| `deleteById({ id })` | `DELETE /{resource}/{id}` | None (id in path) |
| `deleteBy({ where })` | `DELETE /{resource}` | `{ where }` |

- Every write method returns `{ data, count }`, where `count` reflects the server `x-response-count` header.
- Bulk operations (`updateBy`, `deleteBy`) require a non-empty `where` selector. An empty `where` throws immediately before sending any HTTP request.
- There is no `createAll`: the REST backend contract does not define a bulk creation endpoint.

```ts
import { datasource, repository, RepositoryTypes } from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
}

@datasource()
export class TaskDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: 'https://api.example.com' });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: TaskDataSource })
export class TaskRepository extends HttpRepository<TaskRecord> {
  constructor(dataSource: TaskDataSource) {
    super({ dataSource, resource: 'tasks' });
  }

  async completeNewTask() {
    const { data: created } = await this.create({
      data: { title: 'New Task', completed: false },
    });

    await this.updateById({
      id: created.id,
      data: { completed: true },
    });

    await this.deleteBy({
      where: { completed: true },
    });
  }
}
```

## Reading the session token

`DefaultNetworkRequestService.readAuthTokenFromStorage` reads the session of an application with no `id`. An application with an `id` (`IApplicationInfo.id`, see [Two applications on one origin](./binding-keys#two-applications-on-one-origin)) keeps its session under other keys: pass `authTokenResolver: DefaultNetworkRequestService.createAuthTokenReader({ id: 'shop' })` (the same key `authService.getAuth()` reads), or build the datasource from the data provider's `getDataSourceAuth()`, as above.

## Related

- [Build an admin](../guides/tutorials/build-an-admin) - step by step tutorial creating resources and repositories
- [Data provider](data-provider) - data provider contract and options
- [Hooks](hooks) - `useRepository` reference
- [Services and repositories](../best-practices/services) - design patterns for repositories and services
