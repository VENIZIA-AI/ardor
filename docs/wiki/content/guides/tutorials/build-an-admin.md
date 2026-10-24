---
title: Build an Admin Interface
description: Build a complete list, create, edit, and delete admin interface for a resource served by an IGNIS REST API using ARDOR and ra-core.
---

# Build an Admin Interface

To build a CRUD administrative interface for an IGNIS REST API, declare a resource mapping `list`, `create`, and `edit` views to `ra-core` controller components and pass it to `ArdorApplication`.

```tsx
import type { ComponentType } from 'react';
import type { ResourceProps } from 'ra-core';

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

The `resources` prop registers hash routes: `list` at `#/products`, `create` at `#/products/create`, and `edit` at `#/products/:id`.

## REST Data Provider Contract

`DefaultRestDataProvider` (`packages/admin/src/providers/rest-data.ts`) maps react-admin operations to HTTP requests:

| Operation | react-admin method | HTTP verb | Path | Body or query | Total count source |
| --- | --- | --- | --- | --- | --- |
| Load list page | `getList` | GET | `/api/products` | Query: `filter` JSON string (`order`, `limit`, `skip`) | `Content-Range` header |
| Open edit page | `getOne` | GET | `/api/products/:id` | Query: `filter` JSON string from `meta.filter` | N/A |
| Submit create form | `create` | POST | `/api/products` | Body: JSON object with record data | N/A |
| Submit edit form | `update` | PATCH | `/api/products/:id` | Body: JSON object with updated fields | N/A |
| Click delete button | `delete` | DELETE | `/api/products/:id` | None | N/A |

The backend must format `Content-Range` as `records <start>-<end>/<total>` (or `records */<total>` when empty). If missing, the total falls back to `data.length`. See [REST data provider](../../references/data-provider).

## Step 1: Configure Providers

Create `src/configurations/admin.configuration.ts`:

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
    return { url: '/api', noAuthPathRegex: /./ };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions() {
    return {
      i18nSources: { en: englishMessages },
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

`noAuthPathRegex: /./` sends requests without `Authorization`, and leaving `DEFAULT_AUTH_PROVIDER` unbound keeps all routes public. See [Configuration](../core-concepts/configuration).

## Step 2: Build the List View

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
          <tr><th>ID</th><th>Name</th><th>Price</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {(data ?? []).map((product) => (
            <tr key={product.id}>
              <td>{product.id}</td>
              <td>{product.name}</td>
              <td>${product.price}</td>
              <td><a href={`#/products/${product.id}`}>Edit</a></td>
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

`ListBase` initializes `ListContext`, requesting 10 records sorted by `name ASC` via `getList`.

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
      <label>
        Product Name
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Price
        <input type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))} required />
      </label>
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

`CreateBase` initializes `CreateContext`, and `redirect="list"` returns to `#/products` after creation.

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
      <label>
        Product Name
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Price
        <input type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))} required />
      </label>
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

`EditBase` supplies `EditContext` from `getOne`, and `useDeleteController` handles record removal.

## Common Pitfalls

- **Total equals page size**: The backend is missing the `Content-Range` header. `DefaultRestDataProvider` falls back to `data.length`. Ensure the API returns `Content-Range: records 0-9/27` and includes `Access-Control-Expose-Headers: Content-Range` for cross-origin requests.
- **Form updates return 404 or 405**: The backend expects `PUT /api/products/:id`. ARDOR uses `PATCH` for updates.
- **Blank page with unhandled binding key error**: Calling `createRoot().render()` before `await application.start()` completes causes `useInjectable` to throw `Binding key: @app/application/data/rest/default is not bounded in context! | A key derived from a class name (<namespace>.<ClassName>) changes when a minifier renames the class: resolve it by { target }, or pin it with binding: { namespace, key } on the class`. Always await `application.start()` before mounting the React tree.
- **Accidental sign-in redirects**: For an open admin, leave `DEFAULT_AUTH_PROVIDER` unbound and omit `loginPage` on `ArdorApplication`.

## Related

- [5-Minute Quickstart](../get-started/5-minute-quickstart)
- [Add Sign-in](./add-sign-in)
- [Configuration](../core-concepts/configuration)
- [REST data provider](../../references/data-provider)
