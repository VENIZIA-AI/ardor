import 'reflect-metadata';

import { afterEach, describe, expect, test } from 'bun:test';

import { CatalogAccess } from '@shell-example/catalog';
import { OrdersAccess } from '@shell-example/orders';
import { CoreBindings, type IPermissionProvider } from '@venizia/ardor';

import { Roles } from '@/constants/shell';
import { startShell } from './shell';

const CHECKS = {
  orderList: { resource: OrdersAccess.RESOURCE, action: OrdersAccess.LIST },
  orderSummary: { resource: OrdersAccess.RESOURCE, action: OrdersAccess.SUMMARY },
  productList: { resource: CatalogAccess.RESOURCE, action: CatalogAccess.LIST },
  anything: { resource: 'invoices', action: 'delete' },
};

/** What the permission provider answers to each check, for a user signed in with `roles`. */
const answersFor = async (opts: { roles: Array<string> }) => {
  const application = await startShell(opts);
  const permissions = application.get<IPermissionProvider>({
    key: CoreBindings.PERMISSION_PROVIDER,
  });
  const entries = Object.entries(CHECKS).map(async ([name, check]) => {
    const allowed = await permissions.canAccess(check);
    const answer: [string, boolean] = [name, allowed];

    return answer;
  });
  const answers = await Promise.all(entries);

  return Object.fromEntries(answers);
};

describe('the grants of PermissionConfiguration', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('a viewer may list orders and products, and may not open the order summary', async () => {
    const answers = await answersFor({ roles: [Roles.VIEWER] });

    expect(answers).toEqual({
      orderList: true,
      orderSummary: false,
      productList: true,
      anything: false,
    });
  });

  test('an admin may do everything', async () => {
    const answers = await answersFor({ roles: [Roles.ADMIN] });

    expect(answers).toEqual({
      orderList: true,
      orderSummary: true,
      productList: true,
      anything: true,
    });
  });

  test('a user without a role may do nothing', async () => {
    const answers = await answersFor({ roles: [] });

    expect(answers).toEqual({
      orderList: false,
      orderSummary: false,
      productList: false,
      anything: false,
    });
  });
});
