import { type I18nProvider, type TranslateFunction, useTranslate as useRaTranslate } from 'ra-core';

import type { TFullPaths } from '@venizia/ardor-kernel';
import type { englishMessages } from '@/common/locales';

export interface IUseTranslateKeysOverrides {}

export type TUseTranslateKeysDefault = TFullPaths<typeof englishMessages>;

export type TUseTranslateKeys = TUseTranslateKeysDefault | keyof IUseTranslateKeysOverrides;

/** The options react-admin's `translate` takes (`smart_count`, `_` for a default text, ...). */
export type TUseTranslateOptions = Parameters<I18nProvider['translate']>[1];

export type TUseTranslateFn = (key: TUseTranslateKeys, options?: TUseTranslateOptions) => string;

export type TUseUntypedTranslateFn = TranslateFunction;

/** For a key that exists only at run time (`errors.${code}`); a key written in code belongs to `useTranslate`. */
export const useUntypedTranslate: () => TUseUntypedTranslateFn = useRaTranslate;

/** The same function as `useUntypedTranslate`, with the key narrowed to `TUseTranslateKeys`. */
export const useTranslate: () => TUseTranslateFn = useUntypedTranslate;
