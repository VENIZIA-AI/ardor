import { afterEach, describe, expect, mock, test } from 'bun:test';
import React from 'react';
import { CoreAdminContext } from 'ra-core';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, renderHook } from '@testing-library/react';

import { useRequestHeaderLocale } from '@/hooks/use-request-header-locale';
import { CoreBindings, HeaderConsts, Logger } from '@venizia/ardor-kernel';
import { ApplicationContext } from '@venizia/ardor-react';
import { Container } from '@venizia/ignis-inversion';

interface IWrapperProps {
  children?: React.ReactNode;
}

interface ICreateTestHarnessOptions {
  expectedLocale?: string;
}

interface ITestHarness {
  container: Container;
  expectedLocale: string;
  setHeadersMock: ReturnType<typeof mock>;
  wrapper: (props: IWrapperProps) => React.ReactElement;
}

const createTestHarness = (opts: ICreateTestHarnessOptions): ITestHarness => {
  const expectedLocale = opts.expectedLocale ?? 'en';
  const container = new Container();
  const setHeadersMock = mock((_headers: Record<string, string>) => {
    return undefined;
  });

  const fakeNetworkService = {
    setHeaders: setHeadersMock,
  };

  const fakeDataProvider = {
    getNetworkService: () => {
      return fakeNetworkService;
    },
  };

  container.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toValue(fakeDataProvider);

  const testI18nProvider = {
    translate: (key: string): string => {
      return key;
    },
    changeLocale: (_locale: string): Promise<void> => {
      return Promise.resolve();
    },
    getLocale: (): string => {
      return expectedLocale;
    },
  };

  const wrapper = (props: IWrapperProps): React.ReactElement => {
    return React.createElement(
      ApplicationContext.Provider,
      {
        value: {
          container,
          registry: container,
          logger: Logger.getInstance({ scope: 'test' }),
        },
      },
      React.createElement(
        MemoryRouter,
        {},
        React.createElement(
          CoreAdminContext,
          {
            i18nProvider: testI18nProvider,
          },
          props.children,
        ),
      ),
    );
  };

  return {
    container,
    expectedLocale,
    setHeadersMock,
    wrapper,
  };
};

describe('useRequestHeaderLocale', () => {
  afterEach(() => {
    cleanup();
  });

  test('reads current ra-core locale and sets x-locale header on default rest data provider network service on mount', () => {
    const harness = createTestHarness({});

    renderHook(
      () => {
        useRequestHeaderLocale();
      },
      {
        wrapper: harness.wrapper,
      },
    );

    expect(harness.setHeadersMock).toHaveBeenCalledTimes(1);
    expect(harness.setHeadersMock).toHaveBeenCalledWith({
      [HeaderConsts.X_LOCALE]: harness.expectedLocale,
    });
    expect(harness.setHeadersMock).toHaveBeenCalledWith({
      'x-locale': harness.expectedLocale,
    });
  });

  test('falls back to x-locale header when an empty string key option is provided', () => {
    const harness = createTestHarness({});

    renderHook(
      () => {
        useRequestHeaderLocale({ key: '' });
      },
      {
        wrapper: harness.wrapper,
      },
    );

    expect(harness.setHeadersMock).toHaveBeenCalledTimes(1);
    expect(harness.setHeadersMock).toHaveBeenCalledWith({
      'x-locale': harness.expectedLocale,
    });
  });

  test('uses custom key option instead of x-locale when key is provided', () => {
    const harness = createTestHarness({});

    renderHook(
      () => {
        useRequestHeaderLocale({ key: 'x-custom-locale' });
      },
      {
        wrapper: harness.wrapper,
      },
    );

    expect(harness.setHeadersMock).toHaveBeenCalledTimes(1);
    expect(harness.setHeadersMock).toHaveBeenCalledWith({
      'x-custom-locale': harness.expectedLocale,
    });
    expect(harness.setHeadersMock).not.toHaveBeenCalledWith({
      'x-locale': harness.expectedLocale,
    });
  });

  test('updates headers when key option changes across renders', () => {
    const harness = createTestHarness({});

    const { rerender } = renderHook(
      (props: { key?: string }) => {
        useRequestHeaderLocale(props);
      },
      {
        initialProps: { key: 'x-first-locale' },
        wrapper: harness.wrapper,
      },
    );

    expect(harness.setHeadersMock).toHaveBeenCalledTimes(1);
    expect(harness.setHeadersMock).toHaveBeenCalledWith({
      'x-first-locale': harness.expectedLocale,
    });

    rerender({ key: 'x-second-locale' });

    expect(harness.setHeadersMock).toHaveBeenCalledTimes(2);
    expect(harness.setHeadersMock).toHaveBeenLastCalledWith({
      'x-second-locale': harness.expectedLocale,
    });
  });
});
