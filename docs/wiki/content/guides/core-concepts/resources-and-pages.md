---
title: Resources and Pages
description: Add resource screens (list, create, edit, show) and custom routes in an ARDOR application using react-admin controllers and ARDOR hooks.
---

# Resources and Pages

You register screens on the `<ArdorApplication />` root component:

- **Resource screens**: Pass resource definitions to the `resources` prop. A resource pairs a name with up to four page components: `list`, `create`, `edit`, and `show`.
- **Custom routes**: Pass route objects to the `routes` prop. Each entry maps a URL path to a React component.

The complete example registers all four screens for a `products` resource:

```tsx
import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import type { Container } from '@venizia/ignis-inversion';
import { CreateBase, EditBase, ListBase, ShowBase } from 'ra-core';

const ProductList = () => (
  <ListBase resource="products">
    <p>Product list</p>
  </ListBase>
);

const ProductCreate = () => (
  <CreateBase resource="products">
    <p>Product create form</p>
  </CreateBase>
);

const ProductEdit = () => (
  <EditBase resource="products">
    <p>Product edit form</p>
  </EditBase>
);

const ProductShow = () => (
  <ShowBase resource="products">
    <p>Product details</p>
  </ShowBase>
);

export const App = (props: { container: Container }) => {
  const reduxStore = configureStore({
    reducer: { app: (state = {}) => state },
  });

  return (
    <ArdorApplication
      container={props.container}
      reduxStore={reduxStore}
      suspense={<p>Loading...</p>}
      resources={[
        {
          name: 'products',
          list: ProductList,
          create: ProductCreate,
          edit: ProductEdit,
          show: ProductShow,
        },
      ]}
    />
  );
};
```

In `packages/admin/src/components/application.tsx`, `ArdorApplication` iterates over the `resources` prop and renders a react-admin `<Resource>` component for each entry.

## Resource definitions

A resource represents an entity type in your administrative interface, such as `products`, `orders`, or `users`.

The `resources` prop accepts an array of `ResourceProps` objects (defined in `ra-core` and typed in `packages/admin/src/common/types.ts`):

- **`name`**: The unique identifier for the resource. It determines the URL path prefix and the resource name passed to data provider calls.
- **`list`**: The component mounted at `/:resource` (for example, `/products`).
- **`create`**: The component mounted at `/:resource/create` (for example, `/products/create`).
- **`edit`**: The component mounted at `/:resource/:id` (for example, `/products/123`).
- **`show`**: The component mounted at `/:resource/:id/show` (for example, `/products/123/show`).
- **`icon`**: An optional React component used for navigation menus.
- **`recordRepresentation`**: An optional property or function specifying how records are represented as strings.

A resource requires a `name`. All four page properties (`list`, `create`, `edit`, `show`) are optional; you only supply the screens your application needs.

## Controller components

ARDOR provides no preset widgets or HTML styling. You bring your own markup, design system, or CSS framework.

Instead of coupled UI widgets, react-admin provides headless controller components: `ListBase`, `CreateBase`, and `EditBase`. Each controller executes the data fetching lifecycle, tracks pending network states, and exposes data and mutation handlers through React context or a `render` prop:

- **`ListBase`**: Calls `dataProvider.getList`. Exposes items, count, pagination controls, sorting, and filters through `useListContext()`.
- **`CreateBase`**: Exposes a `save` function to dispatch `dataProvider.create`, along with submission status flags.
- **`EditBase`**: Extracts `:id` from the route URL, fetches the record via `dataProvider.getOne`, and exposes both `record` and the `save` function (`dataProvider.update`).

The example demonstrates custom forms and views built on top of these controllers:

```tsx
import type { FormEvent } from 'react';
import { CreateBase, EditBase, ListBase, useListContext } from 'ra-core';

interface IProduct {
  id: number;
  name: string;
  price: number;
}

const ProductListView = () => {
  const { data, total, isPending } = useListContext<IProduct>();

  if (isPending) {
    return <p>Loading...</p>;
  }

  return (
    <section>
      <h1>Products ({total})</h1>
      <ul>
        {(data ?? []).map((product) => (
          <li key={product.id}>
            {product.name} - ${product.price}
          </li>
        ))}
      </ul>
    </section>
  );
};

export const ProductList = () => (
  <ListBase resource="products" perPage={25}>
    <ProductListView />
  </ListBase>
);

export const ProductCreate = () => (
  <CreateBase
    resource="products"
    redirect="list"
    render={({ save, isPending }) => (
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void save?.({
            name: String(form.get('name')),
            price: Number(form.get('price')),
          });
        }}
      >
        <input name="name" placeholder="Name" required />
        <input name="price" type="number" placeholder="Price" required />
        <button type="submit" disabled={isPending}>
          Create
        </button>
      </form>
    )}
  />
);

export const ProductEdit = () => (
  <EditBase<IProduct>
    resource="products"
    redirect="list"
    render={({ record, save, isPending }) => {
      if (isPending || !record) {
        return <p>Loading...</p>;
      }

      return (
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void save?.({
              name: String(form.get('name')),
              price: Number(form.get('price')),
            });
          }}
        >
          <input name="name" defaultValue={record.name} required />
          <input name="price" type="number" defaultValue={record.price} required />
          <button type="submit" disabled={isPending}>
            Save
          </button>
        </form>
      );
    }}
  />
);
```

## Data provider call lifecycle

When a controller runs, it calls methods on `IDataProvider`. In `packages/admin/src/providers/rest-data.ts`, `DefaultRestDataProvider` converts those requests into HTTP calls against your API.

The table details the lifecycle from the page component to the network:

| Screen | Controller component | Data provider call | HTTP method and path |
| --- | --- | --- | --- |
| List (`list`) | `<ListBase>` | `dataProvider.getList(resource, params)` | `GET /${resource}?filter={where,order,limit,skip,offset}` |
| Create (`create`) | `<CreateBase>` | `dataProvider.create(resource, { data })` | `POST /${resource}` (JSON body: `data`) |
| Edit load (`edit`) | `<EditBase>` | `dataProvider.getOne(resource, { id })` | `GET /${resource}/${id}` |
| Edit save (`edit`) | `<EditBase>` `save(data)` | `dataProvider.update(resource, { id, data })` | `PATCH /${resource}/${id}` (JSON body: `data`) |
| Show (`show`) | `<ShowBase>` | `dataProvider.getOne(resource, { id })` | `GET /${resource}/${id}` |
| Single delete | `useDelete()` | `dataProvider.delete(resource, { id })` | `DELETE /${resource}/${id}` |
| Bulk delete | `useDeleteMany()` | `dataProvider.deleteMany(resource, { ids })` | `DELETE /${resource}` (JSON body: `{ where: { id: { inq: ids } } }`) |
| Bulk update | `useUpdateMany()` | `dataProvider.updateMany(resource, { ids, data })` | `PATCH /${resource}` (JSON body: `{ ...data, where: { id: { inq: ids } } }`) |

In `DefaultRestDataProvider`:

- `getList` builds an IGNIS filter object containing `where`, `order`, `limit`, and `skip`/`offset`. The total comes from the `Content-Range` header, and when the header is absent or malformed it is the row count of the returned page (`packages/kernel/src/base/services/network-request.ts`, `resolveTotal`).
- `update` sends a `PATCH` request containing `params.data` exactly as react-admin passes it (`packages/admin/src/providers/rest-data.ts` `update`).
- `deleteMany` and `updateMany` send bulk operations in one atomic HTTP request with the selector in the body to avoid URL length limits. `updateMany` throws if `data` carries a `where` field, and both bulk calls throw when `ids` is empty.

For full options and request configuration, see the [REST data provider reference](../../references/data-provider).

## Custom routes and feature routes

Not every administrative page fits into standard resource CRUD. When you need arbitrary pages, such as an analytics overview, system settings, or diagnostic panels, use custom routes.

### Application routes

Pass custom route objects matching React Router's `RouteProps` to the `routes` prop of `ArdorApplication`:

```tsx
import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import type { Container } from '@venizia/ignis-inversion';

const SettingsPage = () => (
  <div>
    <h1>Application Settings</h1>
    <p>Custom administrative configuration</p>
  </div>
);

const MetricsPage = () => (
  <div>
    <h1>System Metrics</h1>
    <p>Real-time application telemetry</p>
  </div>
);

export const App = (props: { container: Container }) => {
  const reduxStore = configureStore({
    reducer: { app: (state = {}) => state },
  });

  return (
    <ArdorApplication
      container={props.container}
      reduxStore={reduxStore}
      suspense={<p>Loading...</p>}
      routes={[
        { path: '/settings', element: <SettingsPage /> },
        { path: '/metrics', element: <MetricsPage /> },
      ]}
    />
  );
};
```

In `packages/admin/src/components/application.tsx`, `ArdorApplication` places all custom routes inside react-admin's `<CustomRoutes>` component:

```tsx no-check
// Excerpt from packages/admin/src/components/application.tsx
// ...
<CustomRoutes>
  {mounted.routes.map((route) => {
    return <Route key={route.id ?? route.path} {...route} />;
  })}
</CustomRoutes>
```

### Feature routes

Feature modules can bundle their own resources and routes. Use `Features.define` to declare a feature package:

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

When `ArdorApplication` renders, `Features.mount()` in `packages/admin/src/features/feature.ts` combines routes and resources in a deterministic order:

1. The application's own `resources` and `routes` mount first.
2. Each feature's `resources` and `routes` mount in the order of the array returned by `features()`.

If two features or the application declare the same resource name, rendering throws an error to prevent silent route collisions. For details on feature packaging, see the [Features reference](../../references/features).

## Reaching ARDOR from a page

When a page requires data or actions outside the data provider's CRUD contract, use ARDOR hooks:

- **`useRepository`**: Resolves an injected repository instance from the inversion-of-control container (under the `repositories.` namespace) to run specialized domain queries.
- **`useTranslate`**: Translates message keys against the internationalization bundles provided to `CoreBindings.I18N_PROVIDER_OPTIONS`.
- **`useRefreshToken`**: Manually calls `authProvider.refreshToken()` and invalidates the cached permissions query in TanStack Query.
- **`useNotifyError`**: Returns a callback accepting an `ApplicationError` (from `@venizia/ignis-inversion`) and optional `NotificationOptions` (with optional `type`), dispatching `error.normalized?.code` and `error.normalized?.args` to react-admin's notification system.

The application build or `bindContext()` binds decorated repository and datasource classes into the container before `useRepository` resolves them. Do not call `useRepository` on an unbound class.

The following page illustrates all four hooks in one screen:

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
import { useListContext } from 'ra-core';

interface IProduct {
  id: number;
  name: string;
  price: number;
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
export class ProductRepository extends HttpRepository<IProduct> {
  constructor(dataSource: ApiDataSource) {
    super({ dataSource, resource: 'products' });
  }

  countExpensive(opts: { minimumPrice: number }) {
    return this.count({ where: { price: { gte: opts.minimumPrice } } });
  }
}

export const ProductList = () => {
  const { data, isPending } = useListContext<IProduct>();
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
        notifyError(getError({ message: 'Failed to load the expensive products count' }));
      });
  }, [products, notifyError]);

  if (isPending) {
    return <p>Loading...</p>;
  }

  return (
    <section>
      <h1>{translate('ra.page.list', { name: 'Products' })}</h1>
      <p>Expensive count: {expensiveCount}</p>
      <button type="button" onClick={() => void refreshToken()}>
        {translate('ra.action.refresh')}
      </button>
      <ul>
        {(data ?? []).map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </section>
  );
};
```

> [!NOTE]
> For repository class declarations and datasource configuration, consult [Repositories](../../references/repository). To configure internationalization bundles or authentication providers, follow the [Add a language](../tutorials/add-a-language) and [Add sign-in](../tutorials/add-sign-in) tutorials.

## CoreAdmin props

The `IApplication` interface in `packages/admin/src/common/types.ts` extends `Omit<CoreAdminProps, 'children'>`.

While `ArdorApplication` resolves framework providers and manages resources, all remaining properties pass directly into react-admin's `CoreAdmin`:

- **`loginPage`**: Component mounted at `/login`, or `false` to disable the route.
- **`dashboard`**: Component mounted on the root `/` route.
- **`catchAll`**: Component displayed when no route matches.
- **`layout`**: Main layout component wrapping page content.
- **`title`**: Application title string or component.
- **`basename`**: Base URL path prefix when running under a sub-path.
- **`requireAuth`**: Flag requiring authentication for all routes.
- **`disableTelemetry`**: Flag disabling anonymous telemetry requests.

The example demonstrates common administrative properties:

```tsx
import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import type { Container } from '@venizia/ignis-inversion';

const CustomLoginPage = () => (
  <div>
    <h1>Sign in</h1>
    <p>Custom login form</p>
  </div>
);

const Dashboard = () => (
  <div>
    <h1>Welcome</h1>
    <p>Operational summary</p>
  </div>
);

const NotFound = () => (
  <div>
    <h1>Page Not Found</h1>
    <p>The requested page does not exist.</p>
  </div>
);

export const App = (props: { container: Container }) => {
  const reduxStore = configureStore({
    reducer: { app: (state = {}) => state },
  });

  return (
    <ArdorApplication
      container={props.container}
      reduxStore={reduxStore}
      suspense={<p>Loading...</p>}
      loginPage={CustomLoginPage}
      dashboard={Dashboard}
      catchAll={NotFound}
      title="Corporate Admin"
    />
  );
};
```

To build a complete authentication workflow with credentials and redirection, follow the [Add sign-in](../tutorials/add-sign-in) tutorial.

## Next steps

- Explore container startup and provider mounting: [Application](./application)
- Declare provider options and singletons: [Configuration](./configuration)
- Learn how default providers interact: [Providers](./providers)
- Resolve repositories and services with hooks: [Dependency injection](./dependency-injection)
- Follow a step-by-step administrative tutorial: [Build an admin](../tutorials/build-an-admin)
