import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useTranslate } from 'ra-core';
import { MemoryRouter } from 'react-router-dom';

import { ArdorApplication } from '@/components/application';
import type { TI18nSource } from '@/common';
import type { TFeature } from '@/features';
import { Features } from '@/features';
import { DefaultI18nProvider } from '@/providers/i18n';
import { useApplicationLogger } from '@venizia/ardor-react';
import { CoreBindings } from '@venizia/ardor-kernel';
import { ConsoleLogger, type ILogger, LoggerSlot } from '@venizia/ignis-helpers/core';
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
describe('ArdorApplication logger', () => {
  const withoutDebug = (logger: ILogger): ILogger => ({
    debug: () => undefined,
    info: (message, ...args) => logger.info(message, ...args),
    warn: (message, ...args) => logger.warn(message, ...args),
    error: (message, ...args) => logger.error(message, ...args),
    emerg: (message, ...args) => logger.emerg(message, ...args),
    log: (level, message, ...args) => logger.log(level, message, ...args),
    for: (name) => withoutDebug(logger.for(name)),
  });

  test('drops debug lines once an application installs a resolver, and keeps the others', async () => {
    const debug = spyOn(console, 'debug').mockImplementation(() => undefined);
    const info = spyOn(console, 'log').mockImplementation(() => undefined);
    const installed = LoggerSlot.resolve;

    const LoggingList = () => {
      const logger = useApplicationLogger();
      logger.debug('[LoggingList] hidden');
      logger.info('[LoggingList] shown');

      return <h1>Logged</h1>;
    };

    try {
      LoggerSlot.use({
        resolver: ({ scopes }) => withoutDebug(ConsoleLogger.get({ scope: scopes.join('-') })),
      });

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

      expect(debug).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalled();
    } finally {
      LoggerSlot.resolve = installed;
      debug.mockRestore();
      info.mockRestore();
    }
  });
});
