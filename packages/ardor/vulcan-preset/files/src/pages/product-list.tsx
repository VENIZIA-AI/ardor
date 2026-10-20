import { Link } from 'react-router-dom';
import { ListBase, useCreatePath, useListContext } from 'ra-core';

interface IProduct {
  id: number;
  name: string;
  price: number;
}

const Rows = () => {
  const { data, total, isPending } = useListContext<IProduct>();
  const createPath = useCreatePath();

  if (isPending) {
    return <p>Loading</p>;
  }

  return (
    <main>
      <h1>
        Products <small>({total} total)</small>
      </h1>
      <Link to={createPath({ resource: 'products', type: 'create' })}>Create</Link>
      <ul>
        {(data ?? []).map((product) => (
          <li key={product.id}>
            <Link to={createPath({ resource: 'products', type: 'edit', id: product.id })}>
              {product.name}
            </Link>{' '}
            - {product.price}
          </li>
        ))}
      </ul>
    </main>
  );
};

export const ProductList = () => (
  <ListBase resource="products" perPage={10}>
    <Rows />
  </ListBase>
);
