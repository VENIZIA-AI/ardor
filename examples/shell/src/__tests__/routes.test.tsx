import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, screen } from '@testing-library/react';

import { Roles, ShellTestIds } from '@/constants/shell';
import { blockNetwork, renderShell, startShell } from './shell';

describe('the routes of the features', () => {
  let restoreNetwork = () => {};

  beforeEach(() => {
    restoreNetwork = blockNetwork();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    restoreNetwork();
  });

  test('the public share page renders without sign-in and outside the layout', async () => {
    const application = await startShell();
    renderShell({ application, path: '/catalog/share' });

    const heading = await screen.findByRole('heading', { name: 'Our catalog' });
    expect(heading).toBeDefined();
    expect(screen.queryByTestId(ShellTestIds.MENU)).toBeNull();
  });

  test('a viewer who opens the order summary lands on the access-denied page, not the summary', async () => {
    const application = await startShell({ roles: [Roles.VIEWER] });
    renderShell({ application, path: '/orders/summary' });

    const denied = await screen.findByRole('heading', { name: 'Access denied' }, { timeout: 5000 });
    expect(denied).toBeDefined();
    expect(screen.getByTestId(ShellTestIds.MENU).textContent).toBe('OrdersProducts');
    expect(screen.queryByRole('heading', { name: 'Order summary' })).toBeNull();
  });

  test('a viewer who opens an order lands on the default access-denied page', async () => {
    const application = await startShell({ roles: [Roles.VIEWER] });
    renderShell({ application, path: '/orders/1/show' });

    const heading = await screen.findByRole('heading', { name: 'Access denied' });
    expect(heading).toBeDefined();
  });

  test('an admin opens the order summary, a page the feature loads lazily', async () => {
    const application = await startShell({ roles: [Roles.ADMIN] });
    renderShell({ application, path: '/orders/summary' });

    const heading = await screen.findByRole('heading', { name: 'Order summary' });
    expect(heading).toBeDefined();
  });
});
