import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { configureStore, type Store } from '@reduxjs/toolkit';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { type AuthProvider, useTranslate } from 'ra-core';
import { MemoryRouter } from 'react-router-dom';

import { ArdorApplication } from '@/components/application';
import type { TI18nSource } from '@/common';
import type { TArdorRoute, TFeature } from '@/features';
import { Features } from '@/features';
import { DefaultI18nProvider } from '@/providers/i18n';
import { SelectorHooks, useApplicationLogger } from '@venizia/ardor-react';
import { CoreBindings, DefaultAuthService } from '@venizia/ardor-kernel';
import { FakeStorage } from '@venizia/ardor-kernel/testing';
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
  beforeEach(() => {
    localStorage.clear();
  });

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

  test('a page that is open shows the data of the user signed in now, not the one that left', async () => {
    const authService = new DefaultAuthService();
    const container = createContainer({ load: () => Promise.resolve({ reports: { title: 'R' } }) });
    container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toValue(authService);
    authService.saveAuth({
      userId: 7,
      username: 'alice',
      token: { value: 'jwt-alice', type: 'Bearer' },
    });

    const Probe = () => {
      const { data } = useQuery({
        queryKey: ['probe'],
        queryFn: () => Promise.resolve(authService.getAuth()?.value ?? 'nobody'),
      });

      return <p>{`data: ${data}`}</p>;
    };

    render(
      <MemoryRouter initialEntries={['/probe']}>
        <ArdorApplication
          container={container}
          reduxStore={configureStore({ reducer: () => ({}) })}
          suspense={<span>loading</span>}
          routes={[{ path: '/probe', element: <Probe /> }]}
        />
      </MemoryRouter>,
    );
    await screen.findByText('data: jwt-alice');

    authService.saveAuth({
      userId: 8,
      username: 'bob',
      token: { value: 'jwt-bob', type: 'Bearer' },
    });

    await screen.findByText('data: jwt-bob');
    expect(screen.queryByText('data: jwt-alice')).toBeNull();
  });

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

  test('is emptied after the redirect, not at once, when the session ends', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    const clear = spyOn(queryClient, 'resetQueries');

    authService.cleanUp();
    expect(clear).not.toHaveBeenCalled();
    await settle();

    expect(clear).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['reports', 'getList'])).toBeUndefined();
  });

  test('is emptied at once when another user signs in over the first, canAccess answers included', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    queryClient.setQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }], true);

    authService.saveAuth({ userId: 8, token: { value: 'bob', type: 'Bearer' } });

    expect(queryClient.getQueryData(['reports', 'getList'])).toBeUndefined();
    expect(
      queryClient.getQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }]),
    ).toBeUndefined();
  });

  test('is emptied when the next user signs in within the same tick as the sign-out', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    queryClient.setQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }], true);

    authService.cleanUp();
    authService.saveAuth({ userId: 8, token: { value: 'bob', type: 'Bearer' } });
    await settle();

    expect(queryClient.getQueryData(['reports', 'getList'])).toBeUndefined();
    expect(
      queryClient.getQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }]),
    ).toBeUndefined();
  });

  test('is kept when the token of the same user is refreshed', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    queryClient.setQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }], true);
    const clear = spyOn(queryClient, 'resetQueries');

    authService.saveAuth({ userId: 7, token: { value: 'jwt-2', type: 'Bearer' } });
    await settle();

    expect(clear).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['reports', 'getList'])).toBeDefined();
    expect(
      queryClient.getQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }]),
    ).toBe(true);
  });

  test('is kept by the first sign-in of a visitor who had no session', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    const clear = spyOn(queryClient, 'resetQueries');

    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();

    expect(clear).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['reports', 'getList'])).toBeDefined();
  });

  test('is emptied when another user signs in over a session that was stored before the page loaded', async () => {
    const authService = new DefaultAuthService();
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
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
    await screen.findByText('R');

    authService.saveAuth({ userId: 8, token: { value: 'bob', type: 'Bearer' } });

    expect(queryClient.getQueryData(['reports', 'getList'])).toBeUndefined();
  });

  test('is emptied when another tab signs in another user', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    queryClient.setQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }], true);

    // What another tab does: it writes the keys, and this tab hears the `storage` events.
    new DefaultAuthService().saveAuth({ userId: 8, token: { value: 'bob', type: 'Bearer' } });

    for (const key of ['@app/auth/token', '@app/auth/identity']) {
      globalThis.dispatchEvent(
        Object.assign(new Event('storage'), { key, storageArea: localStorage }),
      );
    }

    expect(queryClient.getQueryData(['reports', 'getList'])).toBeUndefined();
    expect(
      queryClient.getQueryData(['auth', 'canAccess', { resource: 'orders', action: 'list' }]),
    ).toBeUndefined();
  });

  test('is emptied once, with the token of the new user, when another tab writes its session key by key', async () => {
    class EventPerWriteStorage extends FakeStorage {
      override setItem(key: string, value: string): void {
        super.setItem(key, value);
        globalThis.dispatchEvent(
          Object.assign(new Event('storage'), { key, storageArea: localStorage }),
        );
      }
    }

    const restoreStorage = new EventPerWriteStorage().install();
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt-alice', type: 'Bearer' } });
    await settle();
    const seen: Array<string | undefined> = [];
    const reset = spyOn(queryClient, 'resetQueries').mockImplementation(() => {
      seen.push(authService.getAuth()?.value);

      return Promise.resolve();
    });

    new DefaultAuthService().saveAuth({ userId: 8, token: { value: 'jwt-bob', type: 'Bearer' } });
    await settle();
    restoreStorage();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['jwt-bob']);
  });

  test('is emptied once, for the last of two switches close together, and ends with the token of the last user', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt-carol', type: 'Bearer' } });
    await settle();
    const seen: Array<string | undefined> = [];
    const reset = spyOn(queryClient, 'resetQueries').mockImplementation(() => {
      seen.push(`${authService.getUser().userId}|${authService.getAuth()?.value}`);

      return Promise.resolve();
    });
    const otherTab = new DefaultAuthService();

    const tokenEvent = () => {
      globalThis.dispatchEvent(
        Object.assign(new Event('storage'), { key: '@app/auth/token', storageArea: localStorage }),
      );
    };

    otherTab.saveAuth({ userId: 8, token: { value: 'jwt-alice', type: 'Bearer' } });
    // The second switch has stored its identity when this tab handles the event of the first token.
    localStorage.setItem('@app/auth/identity', JSON.stringify({ userId: 9 }));
    tokenEvent();
    await settle();
    otherTab.saveAuth({ userId: 9, token: { value: 'jwt-bob', type: 'Bearer' } });
    tokenEvent();
    await settle();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['9|jwt-bob']);
  });

  test('stops listening when the application unmounts', async () => {
    const { authService, queryClient } = renderWithSession();
    await screen.findByText('R');
    authService.saveAuth({ userId: 7, token: { value: 'jwt', type: 'Bearer' } });
    await settle();
    const clear = spyOn(queryClient, 'resetQueries');

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

// react-admin does not check a custom route: `checkAuth` and `canAccess` run only for a route that
// declares `access`.
describe('ArdorApplication route access', () => {
  const AdminPage = () => <h1>Admin only</h1>;

  const createGuardedContainer = (opts: {
    checkAuth: () => Promise<void>;
    canAccess: (params: { resource: string; action: string }) => Promise<boolean>;
    features?: Array<TFeature>;
  }) => {
    const features = opts.features ?? [];
    const container = new Container();
    container.bind({ key: CoreBindings.FEATURES }).toValue(features);
    container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue({});
    container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toValue({
      checkAuth: opts.checkAuth,
      checkError: () => Promise.resolve(),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      getPermissions: () => Promise.resolve(),
      canAccess: opts.canAccess,
    });
    container
      .bind({ key: CoreBindings.DEFAULT_I18N_PROVIDER })
      .toValue(new DefaultI18nProvider({}, features).value(container));

    return container;
  };

  const renderRoute = (opts: {
    container: Container;
    routes?: Array<TArdorRoute>;
    path?: string;
    authProvider?: AuthProvider;
  }) => {
    return render(
      <MemoryRouter initialEntries={[opts.path ?? '/admin-only']}>
        <ArdorApplication
          container={opts.container}
          reduxStore={configureStore({ reducer: () => ({}) })}
          suspense={<span>loading</span>}
          {...(opts.routes ? { routes: opts.routes } : {})}
          {...(opts.authProvider ? { authProvider: opts.authProvider } : {})}
        />
      </MemoryRouter>,
    );
  };

  const denied = () => Promise.resolve(false);
  const allowed = () => Promise.resolve(true);

  test('a route without access renders for a user who is signed out and denied everything', async () => {
    const canAccess = mock(denied);
    const checkAuth = mock(() => Promise.reject(new Error('signed out')));

    renderRoute({
      container: createGuardedContainer({ checkAuth, canAccess }),
      routes: [{ path: '/admin-only', element: <AdminPage /> }],
    });

    const result = await screen.findByText('Admin only');
    expect(result).toBeDefined();
    expect(canAccess).toHaveBeenCalledTimes(0);
  });

  test('a route with access does not render when canAccess says no, and asks for its resource and action', async () => {
    const canAccess = mock((_params: { resource: string; action: string }) => denied());

    renderRoute({
      container: createGuardedContainer({ checkAuth: () => Promise.resolve(), canAccess }),
      routes: [
        {
          path: '/admin-only',
          element: <AdminPage />,
          access: { resource: 'settings', action: 'edit' },
        },
      ],
    });

    await waitFor(() => expect(canAccess).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(canAccess.mock.calls[0]?.[0]).toMatchObject({ resource: 'settings', action: 'edit' });
    expect(screen.queryByText('Admin only')).toBeNull();
  });

  test('a route with access renders when canAccess says yes', async () => {
    renderRoute({
      container: createGuardedContainer({
        checkAuth: () => Promise.resolve(),
        canAccess: allowed,
      }),
      routes: [
        {
          path: '/admin-only',
          element: <AdminPage />,
          access: { resource: 'settings', action: 'edit' },
        },
      ],
    });

    const result2 = await screen.findByText('Admin only');
    expect(result2).toBeDefined();
  });

  test('a route with access does not render, and asks nothing, while checkAuth rejects', async () => {
    const canAccess = mock(allowed);

    renderRoute({
      container: createGuardedContainer({
        checkAuth: () => Promise.reject(new Error('signed out')),
        canAccess,
      }),
      routes: [
        {
          path: '/admin-only',
          element: <AdminPage />,
          access: { resource: 'settings', action: 'edit' },
        },
      ],
    });

    await act(async () => {});

    expect(screen.queryByText('Admin only')).toBeNull();
    expect(canAccess).toHaveBeenCalledTimes(0);
  });

  test('a route with access fails at mount when sign-in is off, naming the route', () => {
    expect(() =>
      renderRoute({
        container: createContainer({ load: () => Promise.resolve({}), withAuthProvider: false }),
        routes: [
          {
            path: '/admin-only',
            element: <AdminPage />,
            access: { resource: 'settings', action: 'edit' },
          },
        ],
      }),
    ).toThrow(/'\/admin-only'.*sign-in/);
  });

  test('a route with access fails at mount when no permission provider is bound, naming the route', () => {
    expect(() =>
      renderRoute({
        container: createContainer({ load: () => Promise.resolve({}) }),
        routes: [
          {
            path: '/admin-only',
            element: <AdminPage />,
            access: { resource: 'settings', action: 'edit' },
          },
        ],
      }),
    ).toThrow(/'\/admin-only'.*PERMISSION_PROVIDER/);
  });

  const guardedRoutes: Array<TArdorRoute> = [
    {
      path: '/admin-only',
      element: <AdminPage />,
      access: { resource: 'settings', action: 'edit' },
    },
  ];

  const propProvider = (opts: { canAccess?: AuthProvider['canAccess'] }): AuthProvider => {
    return {
      checkAuth: () => Promise.resolve(),
      checkError: () => Promise.resolve(),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      getPermissions: () => Promise.resolve(),
      ...(opts.canAccess ? { canAccess: opts.canAccess } : {}),
    };
  };

  test('the check reads the authProvider prop of the shell: a prop without canAccess fails at mount although the container provider has one', () => {
    expect(() =>
      renderRoute({
        container: createGuardedContainer({
          checkAuth: () => Promise.resolve(),
          canAccess: denied,
        }),
        authProvider: propProvider({}),
        routes: guardedRoutes,
      }),
    ).toThrow(/'\/admin-only'.*PERMISSION_PROVIDER/);
  });

  test('the check reads the authProvider prop of the shell: a prop with canAccess mounts although sign-in is off in the container, and is asked', async () => {
    const canAccess = mock((_params: { resource: string; action: string }) => denied());

    renderRoute({
      container: createContainer({ load: () => Promise.resolve({}), withAuthProvider: false }),
      authProvider: propProvider({ canAccess }),
      routes: guardedRoutes,
    });

    await waitFor(() => expect(canAccess).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByText('Admin only')).toBeNull();
  });

  test('guards a route that gives a Component, and a route of a feature', async () => {
    const canAccess = mock((_params: { resource: string; action: string }) => denied());
    const access = { resource: 'settings', action: 'edit' };
    const feature = Features.define({
      name: 'settings',
      routes: [{ path: '/from-feature', element: <AdminPage />, access }],
    });

    renderRoute({
      path: '/from-component',
      container: createGuardedContainer({
        checkAuth: () => Promise.resolve(),
        canAccess,
        features: [feature],
      }),
      routes: [{ path: '/from-component', Component: AdminPage, access }],
    });

    await waitFor(() => expect(canAccess).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByText('Admin only')).toBeNull();
    cleanup();

    renderRoute({
      path: '/from-feature',
      container: createGuardedContainer({
        checkAuth: () => Promise.resolve(),
        canAccess,
        features: [feature],
      }),
    });

    await waitFor(() => expect(canAccess).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.queryByText('Admin only')).toBeNull();
  });
});
