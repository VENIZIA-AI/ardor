import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { CoreAdminContext, useLocaleState } from 'ra-core';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, renderHook } from '@testing-library/react';

import { useHtmlLang } from '@/hooks/use-html-lang';

interface IWrapperProps {
  children?: React.ReactNode;
}

const createWrapper = (opts: { locale: string }) => {
  const i18nProvider = {
    translate: (key: string): string => {
      return key;
    },
    changeLocale: (_locale: string): Promise<void> => {
      return Promise.resolve();
    },
    getLocale: (): string => {
      return opts.locale;
    },
  };

  return (props: IWrapperProps): React.ReactElement => {
    return React.createElement(
      MemoryRouter,
      {},
      React.createElement(CoreAdminContext, { i18nProvider }, props.children),
    );
  };
};

describe('useHtmlLang', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.lang = '';
  });

  test('sets <html lang> to the current ra-core locale', () => {
    document.documentElement.lang = 'en';

    renderHook(
      () => {
        useHtmlLang();
      },
      { wrapper: createWrapper({ locale: 'vi' }) },
    );

    expect(document.documentElement.lang).toBe('vi');
  });

  test('follows a locale change', () => {
    const { result } = renderHook(
      () => {
        useHtmlLang();
        return useLocaleState();
      },
      { wrapper: createWrapper({ locale: 'vi' }) },
    );

    act(() => {
      const [, setLocale] = result.current;
      setLocale('en');
    });

    expect(document.documentElement.lang).toBe('en');
  });
});
