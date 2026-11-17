import { BaseService, inject, service } from '@venizia/ardor';

import { OrderStatuses } from '../constants';
import { OrderRepository } from '../repositories/order.repository';

export interface IOrderSummary {
  open: number;
  shipped: number;
}

@service()
export class OrderService extends BaseService {
  constructor(
    @inject({ target: OrderRepository })
    private readonly orders: OrderRepository,
  ) {
    super({ scope: OrderService.name });
  }

  async summarize(): Promise<IOrderSummary> {
    const [open, shipped] = await Promise.all([
      this.orders.countByStatus({ status: OrderStatuses.OPEN }),
      this.orders.countByStatus({ status: OrderStatuses.SHIPPED }),
    ]);

    return { open: open.count, shipped: shipped.count };
  }
}
