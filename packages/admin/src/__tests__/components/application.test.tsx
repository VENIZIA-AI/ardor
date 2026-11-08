import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { configureStore, type Store } from '@reduxjs/toolkit';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useTranslate } from 'ra-core';
import { MemoryRouter } from 'react-router-dom';

import { ArdorApplication } from '@/components/application';
import type { TI18nSource } from '@/common';
import type { TFeature } from '@/features';
import { Features } from '@/features';
import { DefaultI18nProvider } from '@/providers/i18n';
import { SelectorHooks, useApplicationLogger } from '@venizia/ardor-react';
import { CoreBindings, DefaultAuthService } from '@venizia/ardor-kernel';
import { LoggerFactory, LogLevels } from '@venizia/ignis-helpers/core';
import { Container } from '@venizia/ignis-inversion';

const ReportList = () => {
  const translate = useTranslate();

  return <h1>{translate('reports.title')}</h1>;
};

const createContainer = (opts: {
  load: () => Promise<object>;
  withAuthProvider?: boolean;
  list?: () => React.ReactElement;
  i18nSources?: Record<string, TI18nSource>;
}) => {
  const reports = Features.define({
    name: 'reports',
    resources: [{ name: 'reports', list: opts.list ?? ReportList }],
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
    .toValue(
      new DefaultI18nProvider({ i18nSources: opts.i18nSources }, [reports]).value(container),
    );

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

  test("mounts once the application's lazy messages of the initial locale are loaded", async () => {
    const loadSource = mock(() => Promise.resolve({ ra: { action: { add: 'Add it' } } }));

    render(
      <MemoryRouter>
        <ArdorApplication
          container={createContainer({
            load: () => Promise.resolve({ reports: { title: 'Monthly reports' } }),
            i18nSources: { en: loadSource },
          })}
          reduxStore={configureStore({ reducer: () => ({}) })}
          suspense={<span>loading</span>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('loading')).toBeDefined();
    await screen.findByText('Monthly reports');
    expect(loadSource).toHaveBeenCalledTimes(1);
  });

  test("mounts in English when the application's lazy messages fail to load", async () => {
    const error = spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(
        <MemoryRouter>
          <ArdorApplication
            container={createContainer({
              load: () => Promise.resolve({ reports: { title: 'Monthly reports' } }),
              i18nSources: { en: () => Promise.reject(new Error('remote file is down')) },
            })}
            reduxStore={configureStore({ reducer: () => ({}) })}
            suspense={<span>loading</span>}
          />
        </MemoryRouter>,
      );

      await screen.findByText('Monthly reports');
      expect(error.mock.calls.some((call) => String(call[0]).includes('failed to load'))).toBe(
        true,
      );
    } finally {
      error.mockRestore();
    }
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

// The default logger of an ArdorApplication is built like every other one, from a BaseHelper, so the
// resolver an application installs at startup (the debugging page shows it) silences its debug lines too.
// The default logger of an ArdorApplication comes from LoggerFactory like every other one, so the level an
// application sets at startup (the debugging page shows it) decides its debug lines too.
describe('ArdorApplication logger', () => {
  const LoggingList = () => {
    const logger = useApplicationLogger();
    logger.debug('[LoggingList] debug');
    logger.info('[LoggingList] info');

    return <h1>Logged</h1>;
  };

  const mountAndRead = async (opts: { level: typeof LogLevels.DEBUG | typeof LogLevels.INFO }) => {
    const debug = spyOn(console, 'debug').mockImplementation(() => undefined);
    const info = spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      // oxlint-disable-next-line react-hooks/rules-of-hooks -- LoggerFactory.use sets a level; it is not a React hook
      LoggerFactory.use({ level: opts.level });

      render(
        <MemoryRouter>
          <ArdorApplication
            container={createContainer({
              load: () => Promise.resolve({ reports: { title: 'Monthly reports' } }),
              list: LoggingList,
            })}
            reduxStore={configureStore({ reducer: () => ({}) })}
            suspense={<span>loading</span>}
          />
        </MemoryRouter>,
      );

      await screen.findByText('Logged');

      return { debug: debug.mock.calls.length, info: info.mock.calls.length };
    } finally {
      LoggerFactory.reset();
      debug.mockRestore();
      info.mockRestore();
    }
  };

  test('drops its debug lines under LoggerFactory.use({ level: LogLevels.INFO }) and keeps the others', async () => {
    const calls = await mountAndRead({ level: LogLevels.INFO });

    expect(calls.debug).toBe(0);
    expect(calls.info).toBeGreaterThan(0);
  });

  test('writes its debug lines under LoggerFactory.use({ level: LogLevels.DEBUG })', async () => {
    const calls = await mountAndRead({ level: LogLevels.DEBUG });

    expect(calls.debug).toBeGreaterThan(0);
  });
});

describe('ArdorApplication and the data cache of a signed-out user', () => {
  const renderWithSession = () => {
    const authService = new DefaultAuthService();
    const container = createContainer({ load: () => Promise.resolve({ reports: { title: 'R' } }) });
    container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue(authService);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['reports', 'getList'], [{ id: 1, title: 'private' }]);

    render(
      <MemoryRouter>
        <ArdorApplication
          container={container}
          reduxStore={configureStore({ reducer: () => ({}) })}
          suspense={<span>loading</span>}
          queryClient={queryClient}
        />
      </MemoryRouter>,
    );

    return { authService, queryClient };
  };

  const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

  test('is emptied when the session ends by any route', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    expect(queryClient.getQueryData(['reports', 'getList'])).toBeDefined();

    authService.cleanUp();
    await settle();

    expect(queryClient.getQueryData(['reports', 'getList'])).toBeUndefined();
  });

  test('is emptied after the redirect, not at once, and not when the next user signed in meanwhile', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    const clear = spyOn(queryClient, 'clear');

    authService.cleanUp();
    expect(clear).not.toHaveBeenCalled();
    authService.saveAuth({ userId: 8, token: { value: 'bob', type: 'Bearer' } });
    await settle();

    expect(clear).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['reports', 'getList'])).toBeDefined();
  });

  test('stops listening when the application unmounts', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    const clear = spyOn(queryClient, 'clear');

    cleanup();
    authService.cleanUp();
    await settle();

    expect(clear).not.toHaveBeenCalled();
  });

  test('is kept while the session lives', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');

    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    authService.saveAuth({ userId: 7, token: { value: 'jwt2', type: 'Bearer' } });
    await settle();

    expect(queryClient.getQueryData(['reports', 'getList'])).toBeDefined();
  });
});

describe('ArdorApplication reduxStore', () => {
  const { useAppSelector } = SelectorHooks.create<{ greeting: string }>();

  const Greeting = () => {
    return <p>{useAppSelector((state) => state.greeting)}</p>;
  };

  const renderApplication = (opts: { reduxStore?: Store; element: React.ReactElement }) => {
    return render(
      <MemoryRouter initialEntries={['/greeting']}>
        <ArdorApplication
          container={createContainer({ load: () => Promise.resolve({}), withAuthProvider: false })}
          suspense={<span>loading</span>}
          routes={[{ path: '/greeting', element: opts.element }]}
          {...(opts.reduxStore ? { reduxStore: opts.reduxStore } : {})}
        />
      </MemoryRouter>,
    );
  };

  test('is not needed: an application without one mounts and renders a route', async () => {
    renderApplication({ element: <p>Hello without a store</p> });

    const result = await screen.findByText('Hello without a store');
    expect(result).toBeDefined();
  });

  test('is provided to the routes when passed', async () => {
    renderApplication({
      reduxStore: configureStore({ reducer: () => ({ greeting: 'Hello from the store' }) }),
      element: <Greeting />,
    });

    const result2 = await screen.findByText('Hello from the store');
    expect(result2).toBeDefined();
  });
});
