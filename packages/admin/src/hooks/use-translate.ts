import { type I18nProvider, type TranslateFunction, useTranslate as useRaTranslate } from 'ra-core';

import type { TFullPaths } from '@venizia/ardor-kernel';
import type { englishMessages } from '@/common/locales';

/**
 * Augment this interface to add keys to `TUseTranslateKeys` (messages an app adds to the defaults):
 *
 * ```ts
 * declare module '@venizia/ardor' {
 *   interface IUseTranslateKeysOverrides {
 *     'app.orders.title': unknown;
 *   }
 * }
 * ```
 */
export interface IUseTranslateKeysOverrides {}

/** Every dotted path to a message in the built-in English messages. */
export type TUseTranslateKeysDefault = TFullPaths<typeof englishMessages>;

/** The keys `useTranslate` accepts: the built-in message paths plus the keys added through `IUseTranslateKeysOverrides`. */
export type TUseTranslateKeys = TUseTranslateKeysDefault | keyof IUseTranslateKeysOverrides;

/** The options react-admin's `translate` takes (`smart_count`, `_` for a default text, ...). */
export type TUseTranslateOptions = Parameters<I18nProvider['translate']>[1];

/** `translate` with the key narrowed to `TUseTranslateKeys`. */
export type TUseTranslateFn = (key: TUseTranslateKeys, options?: TUseTranslateOptions) => string;

/** `translate` as react-admin types it, taking any string key. */
export type TUseUntypedTranslateFn = TranslateFunction;

/** For a key that exists only at run time (`errors.${code}`); a key written in code belongs to `useTranslate`. */
export const useUntypedTranslate: () => TUseUntypedTranslateFn = useRaTranslate;

/** The same function as `useUntypedTranslate`, with the key narrowed to `TUseTranslateKeys`. */
export const useTranslate: () => TUseTranslateFn = useUntypedTranslate;
