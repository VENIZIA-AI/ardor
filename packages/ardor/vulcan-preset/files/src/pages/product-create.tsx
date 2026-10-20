import { CreateBase } from 'ra-core';

import { ProductForm } from '@/pages/product-form';

export const ProductCreate = () => (
  <CreateBase resource="products" redirect="list">
    <h1>Create a product</h1>
    <ProductForm />
  </CreateBase>
);
