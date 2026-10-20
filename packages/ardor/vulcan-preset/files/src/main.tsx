import 'reflect-metadata';

import { configureStore } from '@reduxjs/toolkit';
import { ArdorApplication } from '@venizia/ardor';
import { createRoot } from 'react-dom/client';

import { Application } from '@/application';
import { ProductCreate } from '@/pages/product-create';
import { ProductEdit } from '@/pages/product-edit';
import { ProductList } from '@/pages/product-list';

const application = new Application();
const store = configureStore({
  reducer: { app: (state: { ready: boolean } = { ready: true }) => state },
});

await application.start();

createRoot(document.getElementById('root')!).render(
  <ArdorApplication
    container={application}
    reduxStore={store}
    suspense={<p>Loading</p>}
    resources={[{ name: 'products', list: ProductList, create: ProductCreate, edit: ProductEdit }]}
  />,
);
