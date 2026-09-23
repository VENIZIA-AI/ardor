import { useRepository, useTranslate } from '@venizia/ardor';
import { useEffect, useState } from 'react';
import { useListContext, useLogout } from 'ra-core';

import { type IProduct, ProductRepository } from '@/application';

// react-admin's list context holds the page the data provider fetched; the repository answers a
// question the page alone cannot.
export const ProductList = () => {
  const { data, total, isPending } = useListContext<IProduct>();
  const translate = useTranslate();
  const logout = useLogout();
  const products = useRepository({ target: ProductRepository });
  const [expensive, setExpensive] = useState(0);

  useEffect(() => {
    products
      .countExpensive({ minimumPrice: 5000 })
      .then(({ count }) => setExpensive(count))
      .catch((error: unknown) => {
        console.error('[ProductList] countExpensive failed | error: %s', error);
      });
  }, [products]);

  if (isPending) {
    return <p>Loading</p>;
  }

  return (
    <main>
      <h1>
        {translate('quickstart.title')} <small data-testid="total">({total} total)</small>
      </h1>
      <button type="button" onClick={() => logout()}>
        Log out
      </button>
      <ul data-testid="products">
        {(data ?? []).map((product) => (
          <li key={product.id}>
            {product.name} - {product.price}
          </li>
        ))}
      </ul>
      <h2>{translate('quickstart.expensive')}</h2>
      <p data-testid="expensive">{expensive}</p>
    </main>
  );
};
