import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useTranslate } from 'ra-core';
import { MemoryRouter } from 'react-router-dom';

import { ArdorApplication } from '@/components/application';
import type { TFeature } from '@/features';
import { Features } from '@/features';
import { DefaultI18nProvider } from '@/providers/i18n';
import { CoreBindings } from '@venizia/ardor-kernel';
import { Container } from '@venizia/ignis-inversion';

const ReportList = () => {
  const translate = useTranslate();
  return <h1>{translate('reports.title')}</h1>;
};

const createContainer = (opts: { load: () => Promise<object>; withAuthProvider?: boolean }) => {
  const reports = Features.define({
    name: 'reports',
    resources: [{ name: 'reports', list: ReportList }],
    messages: { en: opts.load },
  });

  const container = new Container();
  container.bind({ key: CoreBindings.FEATURES }).toValue([reports]);
  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({});
  if (opts.withAuthProvider ?? true) {
    container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toValue({
      checkAuth: () => Promise.resolve(),
      checkError: () => Promise.resolve(),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      getPermissions: () => Promise.resolve(),
    });
  }
  container
    .bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
    .toValue(new DefaultI18nProvider({}, [reports]).value(container));

  return container;
};

afterEach(() => {
  cleanup();
});

describe('ArdorApplication with features', () => {
  test("mounts a feature's resource once its lazy messages for the initial locale are loaded", async () => {
    const load = mock(() => Promise.resolve({ reports: { title: 'Monthly reports' } }));

    render(
      <MemoryRouter>
        <ArdorApplication
          container={createContainer({ load })}
          reduxStore={configureStore({ reducer: () => ({}) })}
          suspense={<span>loading</span>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('loading')).toBeDefined();
    const result = await screen.findByText('Monthly reports');
    expect(result).toBeDefined();
    expect(load).toHaveBeenCalledTimes(1);
  });

  // No sign-in is a configuration, not a defect: leave the auth provider unbound.
  test('renders without an auth provider bound', async () => {
    const load = mock(() => Promise.resolve({ reports: { title: 'Monthly reports' } }));

    render(
      <MemoryRouter>
        <ArdorApplication
          container={createContainer({ load, withAuthProvider: false })}
          reduxStore={configureStore({ reducer: () => ({}) })}
          suspense={<span>loading</span>}
        />
      </MemoryRouter>,
    );

    const result = await screen.findByText('Monthly reports');
    expect(result).toBeDefined();
  });

  test('resolves the providers once per container, however often it renders', async () => {
    const load = mock(() => Promise.resolve({ reports: { title: 'Monthly reports' } }));
    const container = createContainer({ load });
    const getSpy = spyOn(container, 'get');
    const reduxStore = configureStore({ reducer: () => ({}) });

    const tree = (title: string) => (
      <MemoryRouter>
        <ArdorApplication
          container={container}
          reduxStore={reduxStore}
          suspense={<span>loading</span>}
          title={title}
        />
      </MemoryRouter>
    );

    const { rerender } = render(tree('one'));
    const result = await screen.findByText('Monthly reports');
    expect(result).toBeDefined();
    rerender(tree('two'));
    rerender(tree('three'));

    const resolved = (key: string) => {
      return getSpy.mock.calls.filter(([opts]) => (opts as { key: string }).key === key).length;
    };
    expect(resolved(CoreBindings.DEFAULT_REST_DATA_PROVIDER)).toBe(1);
    expect(resolved(CoreBindings.DEFAULT_AUTH_PROVIDER)).toBe(1);
    expect(resolved(CoreBindings.DEFAULT_I18N_PROVIDER)).toBe(1);
  });
});

const InvoiceList = () => <h1>Open invoices</h1>;

const InvoiceReminders = () => <h1>Reminders</h1>;

const invoices = Features.define({
  name: 'invoices',
  resources: [{ name: 'invoices', list: InvoiceList }],
  routes: [{ path: '/reminders', element: <InvoiceReminders /> }],
});

const reports = Features.define({
  name: 'reports',
  resources: [{ name: 'reports', list: ReportList }],
  messages: { en: { reports: { title: 'Monthly reports' } } },
});

const createFeatureContainer = () => {
  const container = new Container();
  container.bind({ key: CoreBindings.FEATURES }).toValue([invoices, reports]);
  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({});
  container
    .bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
    .toValue(new DefaultI18nProvider({}, [invoices, reports]).value(container));

  return container;
};

describe('ArdorApplication features prop', () => {
  const renderAt = (opts: { path: string; features?: Array<TFeature> }) => {
    return render(
      <MemoryRouter initialEntries={[opts.path]}>
        <ArdorApplication
          container={createFeatureContainer()}
          reduxStore={configureStore({ reducer: () => ({}) })}
          suspense={<span>loading</span>}
          {...(opts.features ? { features: opts.features } : {})}
        />
      </MemoryRouter>,
    );
  };

  test('mounts every bound feature when no list is passed', async () => {
    renderAt({ path: '/reports' });
    const result = await screen.findByText('Monthly reports');
    expect(result).toBeDefined();
    cleanup();

    renderAt({ path: '/invoices' });
    const result2 = await screen.findByText('Open invoices');
    expect(result2).toBeDefined();
    cleanup();

    renderAt({ path: '/reminders' });
    const result3 = await screen.findByText('Reminders');
    expect(result3).toBeDefined();
  });

  test("mounts only the passed list's resources and routes", async () => {
    renderAt({ path: '/invoices', features: [invoices] });
    const result = await screen.findByText('Open invoices');
    expect(result).toBeDefined();
    cleanup();

    renderAt({ path: '/reminders', features: [invoices] });
    const result2 = await screen.findByText('Reminders');
    expect(result2).toBeDefined();
    cleanup();

    // The container still binds `reports`; the list left it out, so its page is not mounted.
    const { container } = renderAt({ path: '/reports', features: [invoices] });
    await act(async () => {});

    expect(screen.queryByText('Monthly reports')).toBeNull();
    expect(container.textContent).toBe('');
  });

  test('an empty list mounts no feature', async () => {
    const { container } = renderAt({ path: '/invoices', features: [] });
    await act(async () => {});

    expect(screen.queryByText('Open invoices')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
