import { useRepository, useTranslate } from '@venizia/ardor';
import { ListBase, useListContext } from 'ra-core';
import { useEffect, useState } from 'react';

import { CatalogAccess, type IProduct } from '../constants';
import { ProductRepository } from '../repositories/product.repository';

const ProductRows = () => {
  const { data } = useListContext<IProduct>();
  const products = useRepository({ target: ProductRepository });
  const translate = useTranslate();
  const [count, setCount] = useState<number>();

  useEffect(() => {
    products.count({ where: {} }).then(
      (result) => setCount(result.count),
      () => setCount(undefined),
    );
  }, [products]);

  return (
    <main>
      <h1>{translate('catalog.list.title')}</h1>
      <p>
        {translate('catalog.list.count')}: {count ?? '-'}
      </p>
      <ul>
        {(data ?? []).map((product) => (
          <li key={product.id}>
            {product.name} - {product.price}
          </li>
        ))}
      </ul>
    </main>
  );
};

export const ProductListPage = () => (
  <ListBase resource={CatalogAccess.RESOURCE} perPage={10}>
    <ProductRows />
  </ListBase>
);
