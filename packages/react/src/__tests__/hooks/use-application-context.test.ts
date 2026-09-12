import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import React from 'react';

import { Container } from '@venizia/ignis-inversion';
import { Logger } from '@venizia/ardor-kernel';

import { ApplicationContext } from '@/contexts/application';
import { useApplicationContext, useApplicationLogger } from '@/hooks/use-application-context';

interface IApplicationContextValue {
  readonly container: Container | null;
  readonly registry: Container | null;
  readonly logger: Logger | null;
}

interface IRenderHookOptions<TReturn> {
  readonly hook: () => TReturn;
  readonly providerValue?: IApplicationContextValue;
}

interface IRenderHookResult<TReturn> {
  readonly current: TReturn;
}

let useContextSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  useContextSpy = spyOn(React, 'useContext');
});

afterAll(() => {
  useContextSpy.mockRestore();
});

const renderHookResult = <TReturn>({
  hook,
  providerValue,
}: IRenderHookOptions<TReturn>): IRenderHookResult<TReturn> => {
  useContextSpy.mockImplementation((context: unknown) => {
    if (context === ApplicationContext) {
      return (
        providerValue ?? {
          container: null,
          registry: null,
          logger: null,
        }
      );
    }

    return null;
  });

  return { current: hook() };
};

describe('useApplicationContext', () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeAll(() => {
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test('returns the container inside a provider', () => {
    const container = new Container();

    const result = renderHookResult({
      hook: () => useApplicationContext(),
      providerValue: {
        container,
        registry: null,
        logger: null,
      },
    });

    expect(result.current).toBe(container);
  });

  test('throws when used outside a provider', () => {
    expect(() => {
      renderHookResult({
        hook: () => useApplicationContext(),
      });
    }).toThrow('[useApplicationContext] must be used within a ApplicationContextProvider');
  });

  test('throws when the container is null inside a provider', () => {
    expect(() => {
      renderHookResult({
        hook: () => useApplicationContext(),
        providerValue: {
          container: null,
          registry: null,
          logger: null,
        },
      });
    }).toThrow('[useApplicationContext] must be used within a ApplicationContextProvider');
  });
});

describe('useApplicationLogger', () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeAll(() => {
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test('returns the logger inside a provider', () => {
    const logger = Logger.getInstance({ scope: 'test' });

    const result = renderHookResult({
      hook: () => useApplicationLogger(),
      providerValue: {
        container: null,
        registry: null,
        logger,
      },
    });

    expect(result.current).toBe(logger);
  });

  test('throws when used outside a provider', () => {
    expect(() => {
      renderHookResult({
        hook: () => useApplicationLogger(),
      });
    }).toThrow('[useApplicationLogger] must be used within a ApplicationContextProvider');
  });

  test('throws when the logger is null inside a provider', () => {
    expect(() => {
      renderHookResult({
        hook: () => useApplicationLogger(),
        providerValue: {
          container: null,
          registry: null,
          logger: null,
        },
      });
    }).toThrow('[useApplicationLogger] must be used within a ApplicationContextProvider');
  });
});
