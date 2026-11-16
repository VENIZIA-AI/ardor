import { repository, RepositoryTypes } from '@venizia/ardor';
import { HttpRepository } from '@venizia/ardor/repository';

import { type IOrder, OrdersAccess, type TOrderStatus } from '../constants';
import { OrdersDataSource } from '../datasources/orders.datasource';

@repository({ type: RepositoryTypes.REMOTE, dataSource: OrdersDataSource })
export class OrderRepository extends HttpRepository<IOrder> {
  constructor(dataSource: OrdersDataSource) {
    super({ dataSource, resource: OrdersAccess.RESOURCE });
  }

  countByStatus(opts: { status: TOrderStatus }) {
    return this.count({ where: { status: opts.status } });
  }
}
