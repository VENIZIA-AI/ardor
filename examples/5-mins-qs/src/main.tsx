import 'reflect-metadata';

import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import { createRoot } from 'react-dom/client';
import { ListBase } from 'ra-core';

import { Application } from '@/application';
import { LoginPage } from '@/pages/login';
import { ProductList } from '@/pages/product-list';

const application = new Application();
const store = configureStore({
  reducer: { quickstart: (state: { ready: boolean } = { ready: true }) => state },
});

// `resource.list` is what react-admin renders for `/products`; `ListBase` runs the data provider.
const ProductsPage = () => (
  <ListBase resource="products" perPage={10}>
    <ProductList />
  </ListBase>
);

await application.start();

createRoot(document.getElementById('root')!).render(
  <ArdorApplication
    container={application}
    reduxStore={store}
    suspense={<p>Loading</p>}
    loginPage={LoginPage}
    resources={[{ name: 'products', list: ProductsPage }]}
  />,
);
