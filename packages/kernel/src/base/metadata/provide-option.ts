import { provide } from '@venizia/ignis-kernel/metadata';

import type { ICoreOptionTypes } from '@/common';

/**
 * `@provide` for an options key of `CoreBindings`: the method must return the options type of that
 * key (`ICoreOptionTypes`), so a wrong return type fails at compile time instead of mid-render.
 * The method is synchronous: the container does not await a provider.
 *
 * @example
 * ```ts
 * import {
 *   configuration,
 *   CoreBindings,
 *   provideOption,
 *   type IRestDataProviderOptions,
 * } from '@venizia/ardor';
 *
 * @configuration()
 * export class ApiConfiguration {
 *   @provideOption({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
 *   restDataProviderOptions(): IRestDataProviderOptions {
 *     return { url: 'https://api.example.com' };
 *   }
 * }
 * ```
 */
export const provideOption = <K extends keyof ICoreOptionTypes>(opts: { key: K }) => {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<() => ICoreOptionTypes[K]>,
  ): void => {
    provide({ key: opts.key })(target, propertyKey, descriptor);
  };
};
