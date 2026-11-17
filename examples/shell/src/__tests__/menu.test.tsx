import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, screen, waitFor } from '@testing-library/react';

import { Roles, ShellTestIds } from '@/constants/shell';
import { blockNetwork, renderShell, startShell } from './shell';

const expectMenu = async (opts: { text: string }) => {
  await waitFor(() => expect(screen.getByTestId(ShellTestIds.MENU).textContent).toBe(opts.text));
};

describe('the menu of ShellLayout', () => {
  let restoreNetwork = () => {};

  beforeEach(() => {
    restoreNetwork = blockNetwork();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    restoreNetwork();
  });

  test('a viewer sees the order list and the products, not the order summary', async () => {
    const application = await startShell({ roles: [Roles.VIEWER] });
    renderShell({ application, path: '/' });

    await expectMenu({ text: 'OrdersProducts' });
    expect(screen.getByTestId(ShellTestIds.ROLES).textContent).toBe('Roles: viewer');
  });

  test('an admin sees every entry, in feature order', async () => {
    const application = await startShell({ roles: [Roles.ADMIN] });
    renderShell({ application, path: '/' });

    await expectMenu({ text: 'OrdersOrder summaryProducts' });
    expect(screen.getByTestId(ShellTestIds.ROLES).textContent).toBe('Roles: admin');
  });

  test('switching to Vietnamese loads the lazy bundle of orders', async () => {
    const application = await startShell({ roles: [Roles.VIEWER] });
    renderShell({ application, path: '/' });
    await expectMenu({ text: 'OrdersProducts' });

    await act(async () => {
      screen.getByRole('button', { name: 'Tiếng Việt' }).click();
    });

    await expectMenu({ text: 'Đơn hàngSản phẩm' });
  });
});
