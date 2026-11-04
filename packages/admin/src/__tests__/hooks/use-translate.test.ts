import { beforeAll, describe, expect, spyOn, test } from 'bun:test';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { Container } from '@venizia/ignis-inversion';
import { CoreAdminContext, testDataProvider, type I18nProvider } from 'ra-core';

import { useTranslate, useUntypedTranslate } from '@/hooks/use-translate';
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

describe('useUntypedTranslate hook', () => {
  beforeAll(() => {
    window.location.href = 'http://localhost/';
  });

  test('answers through the default provider of ra-core without an i18n provider', () => {
    const { result } = renderHook(() => {
      return useUntypedTranslate();
    });
    const key: string = ['errors', 'not_found'].join('.');

    expect(result.current(key)).toBe('errors.not_found');
    expect(result.current(key, { ['smart_count']: 2 })).toBe('errors.not_found');
    expect(result.current(key, { _: 'Not found: %{id}', id: 7 })).toBe('Not found: 7');
  });

  test('translates a key built at run time and passes the options through', () => {
    const container = new Container();
    const i18nProvider = new DefaultI18nProvider({}).value(container);
    const translateSpy = spyOn(i18nProvider, 'translate');
    const wrapper = createWrapper({ i18nProvider });

    const { result } = renderHook(
      () => {
        return useUntypedTranslate();
      },
      { wrapper },
    );
    const key: string = `ra.action.${'add'}`;

    expect(result.current(key, { ['smart_count']: 5 })).toBe('Add');
    expect(translateSpy).toHaveBeenCalledWith('ra.action.add', { ['smart_count']: 5 });
  });

  test('gives the default text of a key the catalogs do not hold', () => {
    const container = new Container();
    const i18nProvider = new DefaultI18nProvider({}).value(container);
    const wrapper = createWrapper({ i18nProvider });

    const { result } = renderHook(
      () => {
        return useUntypedTranslate();
      },
      { wrapper },
    );

    expect(result.current('status.unknown', { _: 'Unknown' })).toBe('Unknown');
    expect(result.current('status.unknown')).toBe('status.unknown');
  });

  test('is the implementation of useTranslate, which keeps the checked key type', () => {
    expect(useTranslate).toBe(useUntypedTranslate);

    const typed = renderHook(() => useTranslate());
    // @ts-expect-error a key outside the catalog is a compile error for the typed hook
    const result = typed.result.current('not.in.the.catalog');

    expect(result).toBe('not.in.the.catalog');
  });
});
