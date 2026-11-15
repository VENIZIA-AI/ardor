import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, screen, waitFor } from '@testing-library/react';

import { Roles } from '@/constants/shell';
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
    expect(screen.queryByTestId('menu')).toBeNull();
  });

  test('a viewer who opens the order summary sees the layout and no page', async () => {
    const application = await startShell({ roles: [Roles.VIEWER] });
    renderShell({ application, path: '/orders/summary' });

    await waitFor(() => expect(screen.getByTestId('menu').textContent).toBe('OrdersProducts'));
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
