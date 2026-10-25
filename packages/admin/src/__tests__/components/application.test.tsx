import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { configureStore } from '@reduxjs/toolkit';
import { cleanup, render, screen } from '@testing-library/react';
import { useTranslate } from 'ra-core';
import { MemoryRouter } from 'react-router-dom';

import { ArdorApplication } from '@/components/application';
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
    expect(await screen.findByText('Monthly reports')).toBeDefined();
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

    expect(await screen.findByText('Monthly reports')).toBeDefined();
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
    expect(await screen.findByText('Monthly reports')).toBeDefined();
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
