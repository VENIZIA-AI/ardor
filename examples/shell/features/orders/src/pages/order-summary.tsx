import { useService, useTranslate } from '@venizia/ardor';
import { useEffect, useState } from 'react';

import { type IOrderSummary, OrderService } from '../services/order.service';

const OrderSummaryPage = () => {
  const orders = useService({ target: OrderService });
  const translate = useTranslate();
  const [summary, setSummary] = useState<IOrderSummary>();

  useEffect(() => {
    orders.summarize().then(setSummary, () => setSummary(undefined));
  }, [orders]);

  return (
    <main>
      <h1>{translate('orders.summary.title')}</h1>
      <p>
        {translate('orders.summary.open')}: {summary?.open ?? '-'}
      </p>
      <p>
        {translate('orders.summary.shipped')}: {summary?.shipped ?? '-'}
      </p>
    </main>
  );
};

export default OrderSummaryPage;
