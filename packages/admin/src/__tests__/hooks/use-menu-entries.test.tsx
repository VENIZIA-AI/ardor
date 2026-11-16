import { afterEach, describe, expect, mock, test } from 'bun:test';
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ArdorApplication } from '@/components/application';
import { Features, type TFeature } from '@/features';
import { useMenuEntries } from '@/hooks/use-menu-entries';
import { DefaultI18nProvider } from '@/providers/i18n';
import { CoreBindings } from '@venizia/ardor-kernel';
import { Container } from '@venizia/ignis-inversion';

type TCanAccess = (params: { resource: string; action: string }) => Promise<boolean>;

const MenuLayout = (props: { children?: React.ReactNode }) => {
  const entries = useMenuEntries();

  return (
    <div>
      <p>{`menu: ${entries.map((entry) => `${entry.feature}/${entry.label}`).join(',')}`}</p>
      {props.children}
    </div>
  );
};

const orders = Features.define({
  name: 'orders',
  routes: [{ path: '/home', element: <h1>Home</h1> }],
  menu: [
    { label: 'orders.menu.list', to: '/orders', icon: 'cart' },
    {
      label: 'orders.menu.refunds',
      to: '/refunds',
      access: { resource: 'refunds', action: 'list' },
    },
  ],
});

const settings = Features.define({
  name: 'settings',
  menu: [
    { label: 'settings.menu.users', to: '/users', access: { resource: 'users', action: 'list' } },
    { label: 'settings.menu.about', to: '/about' },
  ],
});

const createContainer = (opts: {
  features: Array<TFeature>;
  auth?: { canAccess?: TCanAccess };
}) => {
  const container = new Container();
  container.bind({ key: CoreBindings.FEATURES }).toValue(opts.features);
  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({});

  if (opts.auth) {
    container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue({ use: true });
    container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toValue({
      checkAuth: () => Promise.resolve(),
      checkError: () => Promise.resolve(),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      getPermissions: () => Promise.resolve(),
      ...(opts.auth.canAccess ? { canAccess: opts.auth.canAccess } : {}),
    });
  }

  container
    .bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
    .toValue(new DefaultI18nProvider({}, opts.features).value(container));

  return container;
};

const renderMenu = (opts: { container: Container; features?: Array<TFeature> }) => {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <ArdorApplication
        container={opts.container}
        suspense={<span>loading</span>}
        layout={MenuLayout}
        {...(opts.features ? { features: opts.features } : {})}
      />
    </MemoryRouter>,
  );
};

afterEach(() => {
  cleanup();
});

describe('useMenuEntries', () => {
  test('lists the entries canAccess allows and every entry without access, in feature order', async () => {
    const canAccess = mock((params: { resource: string; action: string }) => {
      return Promise.resolve(params.resource === 'users');
    });

    renderMenu({
      container: createContainer({ features: [orders, settings], auth: { canAccess } }),
    });

    const result = await screen.findByText(
      'menu: orders/orders.menu.list,settings/settings.menu.users,settings/settings.menu.about',
    );
    expect(result).toBeDefined();
    expect(canAccess.mock.calls.map(([params]) => params)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'refunds', action: 'list' }),
        expect.objectContaining({ resource: 'users', action: 'list' }),
      ]),
    );
  });

  test('calls canAccess on the auth provider, so a method that reads this keeps it', async () => {
    const receivers: Array<unknown> = [];

    const canAccess = function (this: unknown): Promise<boolean> {
      receivers.push(this);

      return Promise.resolve(true);
    };

    renderMenu({ container: createContainer({ features: [orders], auth: { canAccess } }) });

    const result = await screen.findByText(
      'menu: orders/orders.menu.list,orders/orders.menu.refunds',
    );
    expect(result).toBeDefined();
    expect(receivers.length).toBeGreaterThan(0);
    expect(receivers.every((receiver) => typeof receiver === 'object' && receiver !== null)).toBe(
      true,
    );
  });

  test('lists only the entries of the mounted features', async () => {
    renderMenu({
      container: createContainer({
        features: [orders, settings],
        auth: { canAccess: () => Promise.resolve(true) },
      }),
      features: [orders],
    });

    const result = await screen.findByText(
      'menu: orders/orders.menu.list,orders/orders.menu.refunds',
    );
    expect(result).toBeDefined();
  });

  test('lists every entry when no permission provider answers canAccess', async () => {
    renderMenu({ container: createContainer({ features: [orders, settings], auth: {} }) });

    const result = await screen.findByText(
      'menu: orders/orders.menu.list,orders/orders.menu.refunds,settings/settings.menu.users,settings/settings.menu.about',
    );
    expect(result).toBeDefined();
  });

  test('lists every entry when the application has no sign-in', async () => {
    renderMenu({ container: createContainer({ features: [orders] }) });

    const result = await screen.findByText(
      'menu: orders/orders.menu.list,orders/orders.menu.refunds',
    );
    expect(result).toBeDefined();
  });

  test('lists only the entries without access while canAccess is pending, then the allowed ones', async () => {
    let answer: (value: boolean) => void = () => undefined;
    const canAccess = () =>
      new Promise<boolean>((resolve) => {
        answer = resolve;
      });

    renderMenu({ container: createContainer({ features: [orders], auth: { canAccess } }) });

    const pending = await screen.findByText('menu: orders/orders.menu.list');
    expect(pending).toBeDefined();

    await act(async () => {
      answer(true);
    });

    const result = await screen.findByText(
      'menu: orders/orders.menu.list,orders/orders.menu.refunds',
    );
    expect(result).toBeDefined();
  });

  test('hides an entry whose canAccess rejects', async () => {
    renderMenu({
      container: createContainer({
        features: [orders],
        auth: { canAccess: () => Promise.reject(new Error('permission service down')) },
      }),
    });

    await screen.findByText('Home');
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.getByText('menu: orders/orders.menu.list')).toBeDefined();
  });
});
