import { useTranslate } from '@venizia/ardor';
import { LinkBase, ListBase, useCreatePath, useListContext } from 'ra-core';

import { type IOrder, OrdersAccess } from '../constants';

const OrderRows = () => {
  const { data, total } = useListContext<IOrder>();
  const translate = useTranslate();
  const createPath = useCreatePath();

  return (
    <main>
      <h1>
        {translate('orders.list.title')} <small>({total})</small>
      </h1>
      <ul>
        {(data ?? []).map((order) => (
          <li key={order.id}>
            <LinkBase
              to={createPath({ resource: OrdersAccess.RESOURCE, id: order.id, type: 'show' })}
            >
              {order.reference}
            </LinkBase>{' '}
            - {order.status} - {order.total}
          </li>
        ))}
      </ul>
    </main>
  );
};

export const OrderListPage = () => (
  <ListBase resource={OrdersAccess.RESOURCE} perPage={10}>
    <OrderRows />
  </ListBase>
);
