import { ShowBase, useRecordContext } from 'ra-core';

import { type IOrder, OrdersAccess } from '../constants';

const OrderDetails = () => {
  const order = useRecordContext<IOrder>();

  return (
    <main>
      <h1>{order?.reference}</h1>
      <p>
        {order?.status} - {order?.total}
      </p>
    </main>
  );
};

export const OrderShowPage = () => (
  <ShowBase resource={OrdersAccess.RESOURCE}>
    <OrderDetails />
  </ShowBase>
);
