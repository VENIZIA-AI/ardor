---
title: Repositories
description: Using HttpRepository and HttpDataSource in ARDOR, bridging credentials with getDataSourceAuth, the Content-Range counting rule, and repository registration.
---

# Repositories

Use `HttpRepository` (imported from `@venizia/ardor/repository`), backed by `HttpDataSource`. An HTTP repository reads and writes a remote backend resource through HTTP routes in the `@venizia/ignis-filter` query vocabulary.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface Customer {
  id: string;
  name: string;
  status: string;
}

export class CustomerRepository extends HttpRepository<Customer> {
  constructor(dataSource: HttpDataSource) {
    super({ dataSource, resource: 'customers' });
  }
}

const customerDataSource = new HttpDataSource({
  baseUrl: 'https://api.example.com',
  authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage,
});

export const customerRepository = new CustomerRepository(customerDataSource);
```

## Bridging credentials with getDataSourceAuth()

To make an `HttpDataSource` send the exact same credentials, dynamic session headers, timezone settings, and 401 recovery as the REST data provider, spread `dataProvider.getDataSourceAuth()` into `HttpDataSource` constructor settings.

```ts
import { type IDataProvider } from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface OrderItem {
  id: string;
  total: number;
}

export const createOrderRepository = (dataProvider: IDataProvider) => {
  const dataSource = new HttpDataSource({
    baseUrl: 'https://api.example.com',
    ...dataProvider.getDataSourceAuth(),
  });

  return new HttpRepository<OrderItem>({
    dataSource,
    resource: 'orders',
  });
};
```

`getDataSourceAuth()` returns:

- `authTokenResolver`: reads the active auth token from the network service, omitting it on paths that match `noAuthPaths` or `noAuthPathRegex`.
- `headersResolver`: supplies session headers (configured via `setHeaders`), client timezone headers, request channel, and tracing id.
- `onUnauthorized`: coordinates with the network service to refresh tokens upon a 401 response and retries the repository request once.
- `errorRootKey`: instructs `HttpDataSource` to unwrap server errors under the `error` envelope key.

## Reading data and the Content-Range rule

`HttpRepository` provides query methods:

| Method | HTTP Request | Requires `Content-Range` |
|---|---|---|
| `find({ filter })` | `GET /{resource}?filter=...` | No |
| `find({ filter, options: { shouldQueryRange: true } })` | `GET /{resource}?filter=...` | Yes (returns `{ data, range }`) |
| `findOne({ filter })` | `GET /{resource}?filter=...` (`limit: 1`) | No |
| `findById({ id })` | `GET /{resource}/{id}` | No |
| `count({ where })` | `GET /{resource}?filter=...` (`limit: 1`) | Yes (unless `countPath` is configured) |
| `existsWith({ where })` | `GET /{resource}?filter=...` (`limit: 1`) | No |

The `Content-Range` rule:

- `count({ where })` executes `GET /{resource}?filter={"where":...,"limit":1}` and reads the total count from the `Content-Range` response header.
- The `Content-Range` header format must be `<unit> <start>-<end>/<total>` (for example, `records 0-0/42`) or `records */<total>` for an empty page.
- The repository refuses to guess: if `Content-Range` is missing, `count` throws an error rather than falling back to the page size (which would report 1 for tables of any size).
- Cross-origin requests require the server to expose `Content-Range` in `Access-Control-Expose-Headers`.
- If `Content-Range` carries an unknown total (`records 0-0/*` or `*/*`), `count` throws an error.
- When an API exposes a dedicated count endpoint instead of `Content-Range`, pass `countPath` to `HttpRepository` (for example, `countPath: 'count'`). It then queries `GET /{resource}/{countPath}` with query `{ where }` and reads `{ count: number }` from the response body. If the response does not contain a finite number under `count`, it throws.

```ts
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface Article {
  id: string;
  status: string;
  views: number;
}

const articles = new HttpRepository<Article>({
  dataSource: new HttpDataSource({ baseUrl: 'https://api.example.com' }),
  resource: 'articles',
});

export const loadActiveArticles = () => {
  return articles.find({
    filter: {
      where: { status: 'published' },
      order: ['views DESC'],
      limit: 10,
    },
  });
};

export const countActiveArticles = () => {
  return articles.count({
    where: { status: 'published' },
  });
};
```

## Writing data

`HttpRepository` provides write methods:

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
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
}

const tasks = new HttpRepository<TaskRecord>({
  dataSource: new HttpDataSource({ baseUrl: 'https://api.example.com' }),
  resource: 'tasks',
});

export const updateTaskWorkflow = async () => {
  const { data: created } = await tasks.create({
    data: { title: 'New Task', completed: false },
  });

  await tasks.updateById({
    id: created.id,
    data: { completed: true },
  });

  await tasks.deleteBy({
    where: { completed: true },
  });
};
```

## Registering repositories

Two ways to register repositories in an application:

1. Automatic discovery with `@datasource()` and `@repository()`:

```ts
import {
  datasource,
  DefaultNetworkRequestService,
  repository,
  RepositoryTypes,
  useRepository,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface Invoice {
  id: string;
  amount: number;
}

@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({
      baseUrl: '/api',
      authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage,
    });
  }
}

@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })
export class InvoiceRepository extends HttpRepository<Invoice> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'invoices' });
  }
}

export const useInvoices = () => useRepository({ target: InvoiceRepository });
```

2. Manual registration in `bindContext()`:

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';

export interface Invoice {
  id: string;
  amount: number;
}

export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({ baseUrl: '/api' });
  }
}

export class InvoiceRepository extends HttpRepository<Invoice> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'invoices' });
  }
}

export class InvoiceApplication extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return {
      name: 'invoice-app',
      version: '1.0.0',
      description: 'Invoice application',
    };
  }

  bindContext(): void {
    this.dataSource(ApiDataSource);
    this.repository(InvoiceRepository);
  }
}
```

For a complete guide building an admin with resources and repositories, see [Build an admin](../guides/tutorials/build-an-admin).

## Related

- [Build an admin](../guides/tutorials/build-an-admin) - step by step tutorial creating resources and repositories
- [Data provider](data-provider) - data provider contract and options
- [Network](network) - network service headers and error shapes
- [Hooks](hooks) - `useRepository` reference
- [Services and repositories](../best-practices/services) - design patterns for repositories and services
- [Auth recovery](../best-practices/auth-recovery) - 401 recovery lifecycle across transports
