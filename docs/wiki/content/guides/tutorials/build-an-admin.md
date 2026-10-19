---
title: Build an Admin Interface
description: Build a complete list, create, edit, and delete admin interface for a resource served by an IGNIS REST API using ARDOR and ra-core.
---

# Build an Admin Interface

Build a complete administrative interface with list, create, edit, and delete capabilities for a `products` resource served by an IGNIS REST API.

## Prerequisites

- Completed [Setup](../get-started/setup)
- A running REST API that serves the `products` resource (such as the runnable stub in `examples/5-mins-qs/api/server.ts` or an IGNIS backend with a `ProductController`)

> [!NOTE]
> Authentication and internationalization are omitted in this tutorial so you can focus directly on resource CRUD operations. An application without sign-in leaves `DEFAULT_AUTH_PROVIDER` unbound, which makes all resource pages public. For adding sign-in, see [Add Sign-in](./add-sign-in). For multi-language support, see [Add a Language](./add-a-language).

## What You'll Build

**Resource Model (`products`):**
- `id`: Unique identifier (number)
- `name`: Product name (string)
- `price`: Unit price (number)

**Application Components:**
- `ApiDataSource`: HTTP transport pointing to `/api`
- `AdminConfiguration`: Application configuration declaring the REST data provider and default internationalization provider
- `ProductListPage`: Paginated and sorted product table using `ListBase` and `useListContext`
- `ProductCreatePage`: Record creation form using `CreateBase` and `useCreateContext`
- `ProductEditPage`: Record modification form and record removal using `EditBase`, `useEditContext`, and `useDeleteController`
- `ProductRepository`: Typed data access layer using `HttpRepository` and `useRepository` for queries outside the paginated view

### The REST Data Provider Contract

`DefaultRestDataProvider` in `packages/admin/src/providers/rest-data.ts` maps react-admin calls to HTTP requests against the backend:

| Operation | react-admin method | HTTP verb | Path | Body or query | Total count source |
| --- | --- | --- | --- | --- | --- |
| Load list page | `getList` | GET | `/api/products` | Query: `filter` JSON string (`order`, `limit`, `skip`, `offset`) | `Content-Range` header |
| Open edit page | `getOne` | GET | `/api/products/:id` | Query: `filter` JSON string from `meta.filter` | N/A |
| Submit create form | `create` | POST | `/api/products` | Body: JSON object with record data | N/A |
| Submit edit form | `update` | PATCH | `/api/products/:id` | Body: JSON object with updated fields | N/A |
| Click delete button | `delete` | DELETE | `/api/products/:id` | None | N/A |

The complete contract covering all methods is documented in [REST data provider](../../references/data-provider).

Key points of this contract:
- **Filter encoding**: `buildListFilter({ params })` maps sorting to `order: ["<field> <order>"]` and pagination to `limit`, `skip`, and `offset`. All parameters are serialized as a JSON string under the `filter` query parameter.
- **Total counts**: `DefaultRestDataProvider` extracts the collection total from the HTTP `Content-Range` response header. As implemented in `examples/5-mins-qs/api/server.ts`, the header takes the format `records <start>-<end>/<total>` (or `records */<total>` when a page is empty). If the header is missing, the total falls back to the current page row count (`data.length`). For cross-origin APIs, the server must include `Access-Control-Expose-Headers: Content-Range`.
- **Mutations**: Updates use HTTP `PATCH` with the record identifier in the URL path. Creates use HTTP `POST` to the resource collection path. Deletions use HTTP `DELETE` with the record identifier in the URL path.

## Step 1: Configure the Transport and Data Provider

Create `src/datasources/api.datasource.ts`:

```ts
import { datasource, DefaultNetworkRequestService } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';

@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor() {
    super({
      baseUrl: '/api',
      authTokenResolver: DefaultNetworkRequestService.readAuthTokenFromStorage,
    });
  }
}
```

`src/datasources/api.datasource.ts` establishes the base URL for HTTP communication. `@datasource()` registers the class with ARDOR's inversion-of-control container.

Next, create `src/configurations/admin.configuration.ts`:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultI18nProvider,
  DefaultRestDataProvider,
  englishMessages,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class AdminConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return {
      url: '/api',
      noAuthPathRegex: /./,
    };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: {
        en: englishMessages,
      },
      languages: [{ locale: 'en', name: 'English' }],
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
  i18nProvider() {
    return this.application.instantiate(DefaultI18nProvider).value(this.application);
  }
}
```

**Key Points:**
- The default internationalization provider is bound because `ArdorApplication` requires an i18n provider at startup.
- `noAuthPathRegex: /./` instructs the network service that every request to the backend is public and should be sent without an `Authorization` header.
- `CoreBindings.DEFAULT_AUTH_PROVIDER` is deliberately omitted. When this key is left unbound, `ArdorApplication` runs without authentication checks.
- For complete details on how `@configuration()` classes, lazy singletons, and options methods work, see [Configuration](../core-concepts/configuration).

**What to see in the browser:**
Starting the Vite development server at this stage verifies that TypeScript compiles the decorators and options without errors. No user interface renders yet because the page views have not been added.

## Step 2: Build the List View with Pagination and Sorting

Create `src/pages/products/product-list.tsx`:

```tsx
import React from 'react';
import { ListBase, useListContext } from 'ra-core';

export interface IProduct {
  id: number;
  name: string;
  price: number;
}

export const ProductListView = () => {
  const { data, total, isPending } = useListContext<IProduct>();

  if (isPending) {
    return <p>Loading products...</p>;
  }

  return (
    <section>
      <header>
        <h2>Products ({total ?? 0})</h2>
        <a href="#/products/create">Create Product</a>
      </header>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((product) => (
            <tr key={product.id}>
              <td>{product.id}</td>
              <td>{product.name}</td>
              <td>${product.price}</td>
              <td>
                <a href={`#/products/${product.id}`}>Edit</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const ProductListPage = () => (
  <ListBase<IProduct>
    resource="products"
    perPage={10}
    sort={{ field: 'name', order: 'ASC' }}>
    <ProductListView />
  </ListBase>
);
```

**Key Points:**
- `ListBase` from `ra-core` initializes the list controller and establishes `ListContext`.
- `perPage={10}` instructs `DefaultRestDataProvider.getList` to request a page size of 10 rows (`limit: 10, skip: 0, offset: 0`).
- `sort` set to `{ field: 'name', order: 'ASC' }` sets the default ordering (`order: ["name ASC"]`).
- `useListContext<IProduct>()` reads the returned records array (`data`), total count (`total`), and loading state (`isPending`).
- The total count is extracted by the network layer from the backend's `Content-Range` response header.

**What to see in the browser:**
Visiting `http://localhost:5173/#/products` shows a heading with the total count (such as `Products (27)`), a link to create a product, and an unstyled HTML table listing the first 10 products sorted alphabetically by name. In your browser Network tab, you see a request:
```
GET /api/products?filter={"order":["name ASC"],"limit":10,"skip":0,"offset":0}
```
with response header `content-range: records 0-9/27`.

## Step 3: Build the Create View

Create `src/pages/products/product-create.tsx`:

```tsx
import React, { useState } from 'react';
import { CreateBase, useCreateContext } from 'ra-core';

export interface IProduct {
  id?: number;
  name: string;
  price: number;
}

export const ProductCreateForm = () => {
  const { save, saving } = useCreateContext<Omit<IProduct, 'id'> & { id: number }>();
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (save) {
      save({ name, price: Number(price) });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Product</h2>
      <div>
        <label htmlFor="create-product-name">Product Name</label>
        <input
          id="create-product-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="create-product-price">Price</label>
        <input
          id="create-product-price"
          type="number"
          value={price}
          onChange={(event) => setPrice(Number(event.target.value))}
          required
        />
      </div>
      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Product'}
      </button>
    </form>
  );
};

export const ProductCreatePage = () => (
  <CreateBase resource="products" redirect="list">
    <ProductCreateForm />
  </CreateBase>
);
```

**Key Points:**
- `CreateBase` sets up `CreateContext` and `SaveContext`.
- `redirect="list"` automatically returns the user to `#/products` once the item has been created.
- `useCreateContext<Omit<IProduct, 'id'> & { id: number }>()` exposes the `save` submission handler and the `saving` boolean flag.
- Invoking `save(...)` triggers `DefaultRestDataProvider.create`, sending `POST /api/products` with the form contents as the JSON body.

**What to see in the browser:**
Navigating to `http://localhost:5173/#/products/create` displays the creation form. Filling in "Desk Lamp" and price "45", then clicking "Save Product", sends:
```
POST /api/products
```
with request body `{"name":"Desk Lamp","price":45}`. Upon a successful response, the browser redirects back to `#/products`, where the new product appears in the list.

## Step 4: Build the Edit View with Delete Action

Create `src/pages/products/product-edit.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { EditBase, useDeleteController, useEditContext } from 'ra-core';

export interface IProduct {
  id: number;
  name: string;
  price: number;
}

export const ProductEditForm = () => {
  const { record, isPending, save, saving } = useEditContext<IProduct>();
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);

  const { isPending: isDeleting, handleDelete } = useDeleteController({
    record,
    resource: 'products',
    redirect: 'list',
  });

  useEffect(() => {
    if (record) {
      setName(record.name ?? '');
      setPrice(record.price ?? 0);
    }
  }, [record]);

  if (isPending || !record) {
    return <p>Loading product...</p>;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (save) {
      save({ ...record, name, price: Number(price) });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Edit Product #{record.id}</h2>
      <div>
        <label htmlFor="edit-product-name">Product Name</label>
        <input
          id="edit-product-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="edit-product-price">Price</label>
        <input
          id="edit-product-price"
          type="number"
          value={price}
          onChange={(event) => setPrice(Number(event.target.value))}
          required
        />
      </div>
      <div>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Update Product'}
        </button>
        <button type="button" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </form>
  );
};

export const ProductEditPage = () => (
  <EditBase resource="products" redirect="list">
    <ProductEditForm />
  </EditBase>
);
```

**Key Points:**
- `EditBase` grabs the record identifier from the URL hash route (`#/products/:id`) and fetches the record via `DefaultRestDataProvider.getOne` (`GET /api/products/:id`).
- `useEditContext<IProduct>()` supplies the fetched `record`, loading state (`isPending`), and submission handler (`save`, `saving`).
- Submitting the form calls `save(...)`, which calls `DefaultRestDataProvider.update` to issue `PATCH /api/products/:id` with the updated fields in the body.
- The delete action uses `useDeleteController` from `ra-core`. Clicking the delete button invokes `handleDelete()`, which calls `DefaultRestDataProvider.delete` (`DELETE /api/products/:id`) and redirects to `#/products`.

**What to see in the browser:**
Clicking "Edit" on a product row opens `http://localhost:5173/#/products/1`. The inputs load populated with the product's name and price. Modifying the price and clicking "Update Product" sends a `PATCH /api/products/1` request and navigates back to the list. Clicking "Delete" sends a `DELETE /api/products/1` request and removes the item from the table.

## Step 5: Mount Resources in ArdorApplication

The application entrypoint (`src/main.tsx`), container setup (`src/application.ts`), and build configuration (`vite.config.ts`) follow the structure established in the [5-Minute Quickstart](../get-started/5-minute-quickstart).

Register the list, create, and edit components in the `resources` array passed to `ArdorApplication`:

```tsx
import type { ComponentType } from 'react';
import type { ResourceProps } from 'ra-core';

// Page components defined in steps 2 to 4
declare const ProductListPage: ComponentType;
declare const ProductCreatePage: ComponentType;
declare const ProductEditPage: ComponentType;

export const resources: Array<ResourceProps> = [
  {
    name: 'products',
    list: ProductListPage,
    create: ProductCreatePage,
    edit: ProductEditPage,
  },
];
```

The `resources` prop of `ArdorApplication` takes this array and automatically configures hash routes for the resource:
- `list` maps to `#/products`
- `create` maps to `#/products/create`
- `edit` maps to `#/products/:id`

Because `CoreBindings.DEFAULT_AUTH_PROVIDER` was left unbound in `AdminConfiguration`, `ArdorApplication` runs without an authentication gate and renders all resource pages directly.

**What to see in the browser:**
The full administrative application is now live at `http://localhost:5173`. You can browse the table, create new products, edit existing items, and delete records.

## Step 6: Query Across the Collection with a Custom Repository

The list page renders only the 10 records returned for the active page. When your user interface needs to display a metric about the entire catalog - such as counting how many items exceed a given price - a paginated view alone cannot answer the question without fetching and discarding every row.

An ARDOR repository queries the IGNIS API directly using the full filter vocabulary.

Create `src/repositories/product.repository.ts`:

<<< @/../../../examples/5-mins-qs/src/repositories/product.repository.ts{ts}

The repository reuses `ApiDataSource` defined in Step 1 to send HTTP requests to `/api/products` using the IGNIS filter syntax. The `useRepository({ target: ProductRepository })` hook resolves the repository singleton from the container using the class constructor as the lookup target. When called, the repository sends a filtered query and returns the total count extracted from the `Content-Range` response header.

Now consume `ProductRepository` in `src/pages/product-list.tsx`:

<<< @/../../../examples/5-mins-qs/src/pages/product-list.tsx{tsx}

**Key Points:**
- `ProductRepository` extends `HttpRepository<IProduct>` from `@venizia/ardor/repository`.
- `@repository({ type: RepositoryTypes.REMOTE, dataSource: ApiDataSource })` marks the class for auto-discovery and constructor injection with `ApiDataSource`.
- `this.count({ where: { price: { gte: opts.minimumPrice } } })` queries the `/api/products` endpoint with an IGNIS `where` filter and reads the total count from the `Content-Range` response header.
- `useRepository({ target: ProductRepository })` resolves the repository singleton from the application container.
- `ProductList` displays the expensive items count alongside the paginated table rendered via `useListContext`.

**What to see in the browser:**
When `ProductList` renders, the browser issues two independent network requests:
```
GET /api/products?filter={"order":["name ASC"],"limit":10,"skip":0,"offset":0}
GET /api/products?filter={"where":{"price":{"gte":5000}}}
```
The page displays the expensive item count returned by the repository query alongside the paginated table.

## What Could Go Wrong? Common Pitfalls

### The total equals the page size

**Cause:** The backend API is not sending the `Content-Range` header. `DefaultRestDataProvider` does not calculate totals independently; when `Content-Range` is absent or unparseable, it falls back to the current page row count (`data.length`).

**Fix:** Ensure the backend sends `Content-Range: records 0-9/27` (or `records */27` for empty results, matching `examples/5-mins-qs/api/server.ts`). Cross-origin APIs must also expose this header using `Access-Control-Expose-Headers: Content-Range`.

### Form Updates Fail with HTTP 404 or Method Not Allowed

**Cause:** The backend expects `PUT /api/products/:id` instead of `PATCH`.

**Fix:** ARDOR and IGNIS use `PATCH` for updating resources. Ensure your backend route accepts `PATCH /api/products/:id`.

### Blank Page or Binding Key Error at Startup

**Cause:** Calling `createRoot().render()` before `await application.start()` has finished. Build tooling discovers decorated classes automatically (see [Dependency Injection](../core-concepts/dependency-injection)), but `preConfigure()` registers the provided singletons during startup. If React mounts before `start()` completes, `useInjectable` throws:
```
Binding key: @app/application/data/rest/default is not bounded in context! | A key derived from a class name (<namespace>.<ClassName>) changes when a minifier renames the class: resolve it by { target }, or pin it with binding: { namespace, key } on the class
```

**Fix:** Always await `application.start()` before mounting the React tree in `src/main.tsx`.

### Accidental Sign-in Redirects

**Cause:** Binding `CoreBindings.DEFAULT_AUTH_PROVIDER` in your configuration class when your API has no sign-in endpoint.

**Fix:** For an open admin, leave `DEFAULT_AUTH_PROVIDER` unbound and omit `loginPage` on `ArdorApplication`.

## Continue Your Journey

Now that you have built a complete administrative interface, explore the related concepts and references:

1. [Configuration](../core-concepts/configuration) - Master `@configuration()`, `@provide()`, and options classes
2. [Application](../core-concepts/application) - Understand container initialization and lifecycle hooks
3. [Resources and Pages](../core-concepts/resources-and-pages) - Structure navigation and resource trees
4. [Dependency Injection](../core-concepts/dependency-injection) - Inject services and repositories across your UI
5. [Add Sign-in](./add-sign-in) - Secure your administrative routes with authentication
6. [Add a Language](./add-a-language) - Add localization and multi-language support
7. [REST data provider](../../references/data-provider) - Complete reference for the nine react-admin methods and the three ARDOR adds
8. [Repositories](../../references/repository) - Direct REST data access outside react-admin
