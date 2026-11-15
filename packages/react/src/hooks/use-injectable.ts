import React from 'react';

import { type Container, getError, type TClass } from '@venizia/ignis-inversion';

import type { CoreBindings, ValueOf } from '@venizia/ardor-kernel';
import { ApplicationContext } from '../contexts/application';
import { resolveInjectable } from './resolve-injectable';

/** Declaration-merge string keys into this interface to make them valid `key` values of the injectable hooks. */
export interface IUseInjectableKeysOverrides {}

/**
 * The instance type of a binding key, so `useInjectable({ key })` and `useProvider({ key })` return it
 * with no generic. `@venizia/ardor-admin` merges the provider keys of `CoreBindings` into it, and
 * `@venizia/ardor` re-exports that package, so an application needs no augmentation of its own for
 * those. An application merges its own keys in with `declare module '@venizia/ardor'`; a key listed
 * here is a valid `key` and answers the type written against it.
 *
 * @example
 * ```ts
 * import { useInjectable } from '@venizia/ardor';
 *
 * class ClockKeys {
 *   static readonly NOW = '@app/clock/now';
 * }
 *
 * declare module '@venizia/ardor' {
 *   interface IUseInjectableKeyTypes {
 *     [ClockKeys.NOW]: () => number;
 *   }
 * }
 *
 * export const useNow = () => useInjectable({ key: ClockKeys.NOW });
 * ```
 */
export interface IUseInjectableKeyTypes {}

/** The binding keys the kernel defines (the string values of `CoreBindings`). */
export type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;

/** A key the injectable hooks accept: a kernel binding key, one added to `IUseInjectableKeysOverrides` or one in `IUseInjectableKeyTypes`. */
export type TUseInjectableKeys =
  | TUseInjectableKeysDefault
  | keyof IUseInjectableKeysOverrides
  | keyof IUseInjectableKeyTypes;

/** By class: the return type is inferred from the target. */
export interface IUseInjectableByTarget<TInstance> {
  /** The container to resolve from. @default The application's container (`ApplicationContext`) */
  container?: Container;
  /** The class to resolve; its recorded binding key is used. */
  target: TClass<TInstance>;
  key?: never;
}

/** By key: the type comes from `IUseInjectableKeyTypes` when the key is listed there, else from the caller. */
export interface IUseInjectableByKey<TKey extends TUseInjectableKeys = TUseInjectableKeys> {
  /** The container to resolve from. @default The application's container (`ApplicationContext`) */
  container?: Container;
  /** The binding key to resolve. */
  key: TKey;
  target?: never;
}

/**
 * Resolve by `key` or by `target` class, never both.
 *
 * @example
 * ```ts
 * import { CoreBindings, service, type TUseInjectableOptions } from '@venizia/ardor';
 *
 * @service()
 * class Greeter {}
 *
 * const byTarget: TUseInjectableOptions = { target: Greeter };
 * const byKey: TUseInjectableOptions = { key: CoreBindings.DEFAULT_REST_DATA_PROVIDER };
 * ```
 */
export type TUseInjectableOptions =
  | IUseInjectableByKey<TUseInjectableKeys>
  | IUseInjectableByTarget<unknown>;

/**
 * The container an injectable hook resolves from: the one passed in, else the application's. Shared,
 * so a hook never checks one container and resolves from another.
 *
 * @example
 * ```tsx
 * import { CoreBindings, useApplicationContainer } from '@venizia/ardor';
 *
 * export function BindingCheck() {
 *   const container = useApplicationContainer();
 *   return <span>{container.isBound({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) ? 'bound' : 'unbound'}</span>;
 * }
 * ```
 */
export const useApplicationContainer = (opts?: { container?: Container }): Container => {
  const applicationContext = React.useContext(ApplicationContext);
  const container = opts?.container ?? applicationContext.container;

  if (!container) {
    throw getError({
      message: '[useApplicationContainer] Failed to determine the application container!',
    });
  }

  return container;
};

/**
 * Resolves an instance from the container by `target` class, or by `key` for a binding that has no
 * class. It resolves on every render, as the container does for every `get`: a `TRANSIENT` binding
 * gives a new instance each time, so keep an instance that holds state in a `SINGLETON` binding. A
 * `target` bound to another class of the same name, and a `target` with no recorded binding key,
 * throw.
 *
 * - `{ target }` returns the instance type of the class. Leave the generic out: one you pass with it
 *   is your claim, and nothing checks it.
 * - `{ key }` of a key in `IUseInjectableKeyTypes` (the providers of `CoreBindings`, and the keys an
 *   application adds) returns the type listed there.
 * - Any other `{ key }` returns the type you pass as the generic. That type is your claim: nothing
 *   checks it against what the binding holds.
 *
 * @example
 * ```tsx
 * import { CoreBindings, service, useInjectable } from '@venizia/ardor';
 *
 * @service()
 * class PricingService {
 *   total(opts: { quantity: number }) { return opts.quantity * 3; }
 * }
 *
 * export function Total() {
 *   const pricing = useInjectable({ target: PricingService });
 *   const dataProvider = useInjectable({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER });
 *   return <span>{pricing.total({ quantity: 2 })} {typeof dataProvider.getList}</span>;
 * }
 * ```
 */
export function useInjectable<TKey extends keyof IUseInjectableKeyTypes>(
  opts: IUseInjectableByKey<TKey>,
): IUseInjectableKeyTypes[TKey];
export function useInjectable<TInstance = unknown>(
  opts: IUseInjectableByTarget<TInstance> | IUseInjectableByKey,
): TInstance;
// A generic written with a target that the class does not satisfy still compiles, as it always did.
export function useInjectable<TInstance = unknown>(
  // oxlint-disable-next-line typescript/unified-signatures -- keeps a generic that the class does not satisfy compiling
  opts: IUseInjectableByTarget<unknown> | IUseInjectableByKey,
): TInstance;

export function useInjectable(
  opts: IUseInjectableByTarget<unknown> | IUseInjectableByKey,
): unknown {
  const container = useApplicationContainer({ container: opts.container });

  return resolveInjectable({
    container,
    key: opts.key,
    target: opts.target,
    hook: 'useInjectable',
  });
}
