import { Features } from '@venizia/ardor';
import { lazy } from 'react';

import { OrdersAccess, OrdersPaths, OrdersPermissions } from './constants';
import { OrdersDataSource } from './datasources/orders.datasource';
import { ordersEnglish } from './messages/en';
import { OrderListPage } from './pages/order-list';
import { OrderShowPage } from './pages/order-show';
import { OrderRepository } from './repositories/order.repository';
import { OrderService } from './services/order.service';

export { OrdersAccess, OrdersPaths, OrdersPermissions } from './constants';

export const ordersFeature = Features.define({
  name: 'orders',
  resources: [{ name: OrdersAccess.RESOURCE, list: OrderListPage, show: OrderShowPage }],
  routes: [
    {
      path: OrdersPaths.SUMMARY,
      Component: lazy(() => import('./pages/order-summary')),
      access: { resource: OrdersAccess.RESOURCE, action: OrdersAccess.SUMMARY },
    },
  ],
  menu: [
    {
      label: 'orders.menu.list',
      to: OrdersPaths.LIST,
      access: { resource: OrdersAccess.RESOURCE, action: OrdersAccess.LIST },
    },
    {
      label: 'orders.menu.summary',
      to: OrdersPaths.SUMMARY,
      access: { resource: OrdersAccess.RESOURCE, action: OrdersAccess.SUMMARY },
    },
  ],
  messages: { en: ordersEnglish, vi: () => import('./messages/vi') },
  artifacts: {
    dataSources: [OrdersDataSource],
    repositories: [OrderRepository],
    services: [OrderService],
  },
  permissions: [OrdersPermissions.LIST, OrdersPermissions.SHOW, OrdersPermissions.SUMMARY],
});
