import { EditBase } from 'ra-core';

import { ProductForm } from '@/pages/product-form';

export const ProductEdit = () => (
  <EditBase resource="products" redirect="list">
    <h1>Edit a product</h1>
    <ProductForm />
  </EditBase>
);
