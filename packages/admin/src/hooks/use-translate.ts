import React from 'react';

import { type I18nProvider, useI18nProvider } from 'ra-core';

import type { TFullPaths } from '@venizia/ardor-kernel';
import type { englishMessages } from '@/common/locales';

export interface IUseTranslateKeysOverrides {}

export type TUseTranslateKeysDefault = TFullPaths<typeof englishMessages>;

export type TUseTranslateKeys = TUseTranslateKeysDefault | keyof IUseTranslateKeysOverrides;

/** The options react-admin's `translate` takes (`smart_count`, `_` for a default text, ...). */
export type TUseTranslateOptions = Parameters<I18nProvider['translate']>[1];

export type TUseTranslateFn = (key: TUseTranslateKeys, options?: TUseTranslateOptions) => string;

export type TUseUntypedTranslateFn = (key: string, options?: TUseTranslateOptions) => string;

const identity: TUseUntypedTranslateFn = (key) => key;

/** For a key that exists only at run time (`errors.${code}`); a key written in code belongs to `useTranslate`. */
export const useUntypedTranslate = (): TUseUntypedTranslateFn => {
  const i18nProvider = useI18nProvider();

  const translate: TUseUntypedTranslateFn = React.useCallback(
    (key, options) => {
      return i18nProvider.translate(key, options);
    },
    [i18nProvider],
  );

  return i18nProvider ? translate : identity;
};

/** The same function as `useUntypedTranslate`, with the key narrowed to `TUseTranslateKeys`. */
export const useTranslate: () => TUseTranslateFn = useUntypedTranslate;
