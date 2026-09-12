import { useInjectable, useTranslate } from '@venizia/ardor';
import { useEffect, useState } from 'react';
import { useListContext, useLogout } from 'ra-core';

import { type IProduct, ProductApi } from '@/application';

// A resource list: react-admin's list context gives the rows the data provider fetched; the
// service resolved from the container answers a question the list alone cannot.
export const ProductList = () => {
  const { data, total, isPending } = useListContext<IProduct>();
  const translate = useTranslate();
  const logout = useLogout();
  const productApi = useInjectable<ProductApi>({ key: 'services.ProductApi' });
  const [expensive, setExpensive] = useState<IProduct[]>([]);

  useEffect(() => {
    productApi
      .findExpensive({ minimumPrice: 5000 })
      .then(setExpensive)
      .catch((error: unknown) => {
        console.error('[ProductList] findExpensive failed | error: %s', error);
      });
  }, [productApi]);

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
      <p data-testid="expensive">{expensive.length}</p>
    </main>
  );
};
