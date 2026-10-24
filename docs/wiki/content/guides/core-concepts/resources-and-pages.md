---
title: Resources and Pages
description: Add resource screens (list, create, edit, show) and custom routes in an ARDOR application using react-admin controllers and ARDOR hooks.
---

# Resources and Pages

ARDOR applications register resource CRUD screens with the `resources` prop and custom URL routes with the `routes` prop on `<ArdorApplication />`.

```tsx
import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import type { Container } from '@venizia/ignis-inversion';
import { ListBase } from 'ra-core';

const ProductList = () => (
  <ListBase resource="products">
    <p>Product list</p>
  </ListBase>
);

const SettingsPage = () => <p>Settings</p>;

export const App = (props: { container: Container }) => {
  const reduxStore = configureStore({
    reducer: { app: (state = {}) => state },
  });

  return (
    <ArdorApplication
      container={props.container}
      reduxStore={reduxStore}
      suspense={<p>Loading...</p>}
      resources={[{ name: 'products', list: ProductList }]}
      routes={[{ path: '/settings', element: <SettingsPage /> }]}
    />
  );
};
```

## Resource definitions

The `resources` prop accepts an array of `ResourceProps` objects (from `ra-core`, typed in `packages/admin/src/common/types.ts`):

- **`name`**: Unique identifier for the resource; sets the URL path prefix and the resource name passed to data provider calls.
- **`list`**: Mounted at `/:resource` (for example, `/products`).
- **`create`**: Mounted at `/:resource/create` (for example, `/products/create`).
- **`edit`**: Mounted at `/:resource/:id` (for example, `/products/123`).
- **`show`**: Mounted at `/:resource/:id/show` (for example, `/products/123/show`).
- **`icon`**: Optional React component for navigation menus.
- **`recordRepresentation`**: Optional field name or function representing records as strings.

A resource requires `name`. All four screen properties (`list`, `create`, `edit`, `show`) are optional; you supply only the screens your application needs.

## Controller components

React-admin provides headless controller components that run data fetching and expose state through context or render props:

- **`ListBase`**: Calls `dataProvider.getList`. Exposes data, pagination, and sorting through `useListContext()`.
- **`CreateBase`**: Exposes a `save` function to dispatch `dataProvider.create`.
- **`EditBase`**: Extracts `:id` from the URL, fetches the record via `dataProvider.getOne`, and exposes `record` and `save` (`dataProvider.update`).

```tsx
import type { FormEvent } from 'react';
import { EditBase, ListBase, useListContext } from 'ra-core';

interface IProduct {
  id: number;
  name: string;
}

export const ProductList = () => (
  <ListBase resource="products" perPage={25}>
    <ProductListView />
  </ListBase>
);

const ProductListView = () => {
  const { data, total, isPending } = useListContext<IProduct>();
  if (isPending) return <p>Loading...</p>;

  return (
    <section>
      <h1>Products ({total})</h1>
      <ul>
        {(data ?? []).map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </section>
  );
};

export const ProductEdit = () => (
  <EditBase<IProduct>
    resource="products"
    redirect="list"
    render={({ record, save, isPending }) => {
      if (isPending || !record) return <p>Loading...</p>;

      return (
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void save?.({ name: String(form.get('name')) });
          }}
        >
          <input name="name" defaultValue={record.name} required />
          <button type="submit" disabled={isPending}>Save</button>
        </form>
      );
    }}
  />
);
```

## Data provider call lifecycle

In `packages/admin/src/providers/rest-data.ts`, `DefaultRestDataProvider` converts controller calls into HTTP requests:

| Screen | Controller component | Data provider call | HTTP method and path |
| --- | --- | --- | --- |
| List (`list`) | `<ListBase>` | `dataProvider.getList(resource, params)` | `GET /${resource}?filter={where,order,limit,skip}` |
| Create (`create`) | `<CreateBase>` | `dataProvider.create(resource, { data })` | `POST /${resource}` (JSON body: `data`) |
| Edit load (`edit`) | `<EditBase>` | `dataProvider.getOne(resource, { id })` | `GET /${resource}/${id}` |
| Edit save (`edit`) | `<EditBase>` `save(data)` | `dataProvider.update(resource, { id, data })` | `PATCH /${resource}/${id}` (JSON body: `data`) |
| Show (`show`) | `<ShowBase>` | `dataProvider.getOne(resource, { id })` | `GET /${resource}/${id}` |
| Single delete | `useDelete()` | `dataProvider.delete(resource, { id })` | `DELETE /${resource}/${id}` |
| Bulk delete | `useDeleteMany()` | `dataProvider.deleteMany(resource, { ids })` | `DELETE /${resource}` (JSON body: `{ where: { id: { inq: ids } } }`) |
| Bulk update | `useUpdateMany()` | `dataProvider.updateMany(resource, { ids, data })` | `PATCH /${resource}` (JSON body: `{ ...data, where: { id: { inq: ids } } }`) |

In `DefaultRestDataProvider`:

- `getList` builds an IGNIS filter object containing `where`, `order`, `limit`, and `skip`. Total count comes from `Content-Range`, falling back to the returned row count when absent or malformed (`packages/kernel/src/base/services/network-request.ts`, `resolveTotal`).
- `update` sends a `PATCH` request with `params.data` directly (`packages/admin/src/providers/rest-data.ts`).
- `deleteMany` and `updateMany` send bulk operations in one HTTP request with the selector in the body. `updateMany` throws if `data` carries a `where` field, and both bulk calls throw when `ids` is empty.

For full options and request configuration, see the [REST data provider reference](../../references/data-provider).

## Custom routes and feature routes

Pass custom route objects matching React Router's `RouteProps` to the `routes` prop of `ArdorApplication`. In `packages/admin/src/components/application.tsx`, `ArdorApplication` renders custom routes inside `<CustomRoutes>`.

Feature packages can also bundle their own resources and routes using `Features.define`:

```tsx
import { Features, type TFeature } from '@venizia/ardor';

const AnalyticsDashboard = () => (
  <div>
    <h1>Analytics Dashboard</h1>
  </div>
);

export const AnalyticsFeature: TFeature = Features.define({
  name: 'analytics',
  routes: [{ path: '/analytics', element: <AnalyticsDashboard /> }],
});
```

In `packages/admin/src/features/feature.ts`, `Features.mount()` mounts the application's own `resources` and `routes` first, then each feature's in array order. A duplicated resource name throws an error. For details on feature packaging, see the [Features reference](../../references/features).

## Reaching ARDOR from a page

When a page requires data or actions outside the data provider's CRUD contract, use ARDOR hooks:

- **`useRepository`**: Resolves an injected repository instance from the container (under `repositories.`) to run specialized domain queries.
- **`useTranslate`**: Translates message keys against the internationalization bundles provided to `CoreBindings.I18N_PROVIDER_OPTIONS`.
- **`useRefreshToken`**: Manually calls `authProvider.refreshToken()` and invalidates the cached permissions query in TanStack Query.
- **`useNotifyError`**: Accepts an `ApplicationError` (from `@venizia/ignis-inversion`) and optional `NotificationOptions`, dispatching the code and arguments to react-admin's notification system.

Decorated repository and datasource classes must be bound into the container before `useRepository` resolves them:

```tsx
import {
  datasource,
  DefaultNetworkRequestService,
  repository,
  RepositoryTypes,
  useNotifyError,
  useRefreshToken,
  useRepository,
  useTranslate,
} from '@venizia/ardor';
import { HttpDataSource, HttpRepository } from '@venizia/ardor/repository';
import { getError } from '@venizia/ignis-inversion';
import { useEffect, useState } from 'react';

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
export class ProductRepository extends HttpRepository<{ id: number; name: string; price: number }> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'products' });
  }

  countExpensive(opts: { minimumPrice: number }) {
    return this.count({ where: { price: { gte: opts.minimumPrice } } });
  }
}

export const ProductList = () => {
  const translate = useTranslate();
  const notifyError = useNotifyError();
  const refreshToken = useRefreshToken();
  const products = useRepository({ target: ProductRepository });
  const [expensiveCount, setExpensiveCount] = useState<number>(0);

  useEffect(() => {
    products
      .countExpensive({ minimumPrice: 100 })
      .then(({ count }) => setExpensiveCount(count))
      .catch((error: unknown) => {
        console.error(error);
        notifyError(getError({ message: 'Count failed' }));
      });
  }, [products, notifyError]);

  return (
    <section>
      <h1>{translate('ra.page.list', { name: 'Products' })}</h1>
      <p>Expensive count: {expensiveCount}</p>
      <button type="button" onClick={() => void refreshToken()}>
        {translate('ra.action.refresh')}
      </button>
    </section>
  );
};
```

> [!NOTE]
> For repository class declarations and datasource configuration, consult [Repositories](../../references/repository). To configure internationalization bundles or authentication providers, follow the [Add a language](../tutorials/add-a-language) and [Add sign-in](../tutorials/add-sign-in) tutorials.

## CoreAdmin props

`IApplication` in `packages/admin/src/common/types.ts` extends `Omit<CoreAdminProps, 'children'>`. All remaining props pass directly to react-admin's `CoreAdmin`:

- **`loginPage`**: Component mounted at `/login`, or `false` to disable the route.
- **`dashboard`**: Component mounted on the root `/` route.
- **`catchAll`**: Component displayed when no route matches.
- **`layout`**: Main layout component wrapping page content.
- **`title`**: Application title string or component.
- **`basename`**: Base URL path prefix when running under a sub-path.
- **`requireAuth`**: Flag requiring authentication for all routes.
- **`disableTelemetry`**: Flag disabling anonymous telemetry requests.

## Next steps

- [Application](./application) - Container startup and provider mounting
- [Providers](./providers) - Default provider contracts and registration
- [Dependency injection](./dependency-injection) - Resolving repositories and services with hooks
- [Build an admin](../tutorials/build-an-admin) - End-to-end tutorial building an administrative interface
