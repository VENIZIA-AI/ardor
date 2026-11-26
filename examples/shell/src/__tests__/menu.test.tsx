import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, screen } from '@testing-library/react';

import { Roles, ShellTestIds } from '@/constants/shell';
import { blockNetwork, renderShell, startShell } from './shell';

const MAX_TURNS = 200;

// react-admin registers its resources on timers after the first render: each turn runs inside `act`,
// so those updates are applied as React expects while the menu is awaited.
const expectMenu = async (opts: { text: string }) => {
  const read = () => screen.queryByTestId(ShellTestIds.MENU)?.textContent;

  for (let turn = 0; turn < MAX_TURNS && read() !== opts.text; turn++) {
    await act(() => Bun.sleep(5));
  }

  await act(() => Bun.sleep(5));
  expect(read()).toBe(opts.text);
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
    await renderShell({ application, path: '/' });

    await expectMenu({ text: 'OrdersProducts' });
    expect(screen.getByTestId(ShellTestIds.ROLES).textContent).toBe('Roles: viewer');
  });

  test('an admin sees every entry, in feature order', async () => {
    const application = await startShell({ roles: [Roles.ADMIN] });
    await renderShell({ application, path: '/' });

    await expectMenu({ text: 'OrdersOrder summaryProducts' });
    expect(screen.getByTestId(ShellTestIds.ROLES).textContent).toBe('Roles: admin');
  });

  test('switching to Vietnamese loads the lazy bundle of orders', async () => {
    const application = await startShell({ roles: [Roles.VIEWER] });
    await renderShell({ application, path: '/' });
    await expectMenu({ text: 'OrdersProducts' });

    await act(async () => {
      screen.getByRole('button', { name: 'Tiếng Việt' }).click();
    });

    await expectMenu({ text: 'Đơn hàngSản phẩm' });
  });
});
