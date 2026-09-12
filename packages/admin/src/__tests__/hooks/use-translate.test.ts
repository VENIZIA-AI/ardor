import { beforeAll, describe, expect, spyOn, test } from 'bun:test';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { Container } from '@venizia/ignis-inversion';
import { CoreAdminContext, testDataProvider, type I18nProvider } from 'ra-core';

import { useTranslate } from '@/hooks/use-translate';
import { DefaultI18nProvider } from '@/providers/i18n';

interface IWrapperOptions {
  readonly children: React.ReactNode;
}

interface ICreateWrapperOptions {
  readonly i18nProvider: I18nProvider;
}

const createWrapper = ({ i18nProvider }: ICreateWrapperOptions) => {
  const dataProvider = testDataProvider();

  return ({ children }: IWrapperOptions) => {
    return React.createElement(
      CoreAdminContext,
      {
        dataProvider,
        i18nProvider,
      },
      children,
    );
  };
};

describe('useTranslate hook without an i18n provider context', () => {
  test('returns a function that returns the key unchanged when called without options', () => {
    const { result } = renderHook(() => {
      return useTranslate();
    });

    const translate = result.current;

    expect(translate('ra.action.add')).toBe('ra.action.add');
  });

  test('returns a function that returns the key unchanged when called with options', () => {
    const { result } = renderHook(() => {
      return useTranslate();
    });

    const translate = result.current;

    expect(translate('ra.action.add', { ['smart_count']: 2 })).toBe('ra.action.add');
  });
});

describe('useTranslate hook within CoreAdminContext using DefaultI18nProvider', () => {
  beforeAll(() => {
    window.location.href = 'http://localhost/';
  });

  test('returns a function translating ra.action.add to Add', () => {
    const container = new Container();
    const defaultI18nProvider = new DefaultI18nProvider({});
    const i18nProvider = defaultI18nProvider.value(container);
    const wrapper = createWrapper({ i18nProvider });

    const { result } = renderHook(
      () => {
        return useTranslate();
      },
      { wrapper },
    );

    const translate = result.current;

    expect(translate('ra.action.add')).toBe('Add');
  });

  test('returns a function translating ra.action.add to Add and passing options through', () => {
    const container = new Container();
    const defaultI18nProvider = new DefaultI18nProvider({});
    const i18nProvider = defaultI18nProvider.value(container);
    const translateSpy = spyOn(i18nProvider, 'translate');
    const wrapper = createWrapper({ i18nProvider });

    const { result } = renderHook(
      () => {
        return useTranslate();
      },
      { wrapper },
    );

    const translate = result.current;
    const translation = translate('ra.action.add', { ['smart_count']: 5 });

    expect(translateSpy).toHaveBeenCalledWith('ra.action.add', { ['smart_count']: 5 });
    expect(translation).toBe('Add');
  });
});
