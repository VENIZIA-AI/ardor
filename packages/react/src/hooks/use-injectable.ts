import React from 'react';

import { type Container, getError, type TBindingKey, type TClass } from '@venizia/ignis-inversion';

import { ApplicationContext } from '../contexts/application';
import { resolveInjectable } from './resolve-injectable';

/** By class: the return type is inferred from the target. */
export interface IUseInjectableByTarget<TInstance> {
  /** The container to resolve from. @default The application's container (`ApplicationContext`) */
  container?: Container;
  /** The class to resolve; its recorded binding key is used. */
  target: TClass<TInstance>;
  key?: never;
}

/** By key: the instance type is the one the key carries (`BindingKeys.build<T>`). */
export interface IUseInjectableByKey<TValue = unknown> {
  /** The container to resolve from. @default The application's container (`ApplicationContext`) */
  container?: Container;
  /** The binding key to resolve. */
  key: TBindingKey<TValue>;
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
export type TUseInjectableOptions = IUseInjectableByKey | IUseInjectableByTarget<unknown>;

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
 * - `{ target }` returns the instance type of the class, and takes no generic that the class does not satisfy.
 * - `{ key }` returns the type the key carries: a key made by `BindingKeys.build<T>` answers `T`, with no
 *   generic. A generic you pass with it must be that type.
 * - Options of either shape (a variable typed as both) return `unknown`, and take no generic.
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
export function useInjectable<TValue = unknown>(opts: IUseInjectableByKey<TValue>): TValue;
export function useInjectable<TInstance = unknown>(
  opts: IUseInjectableByTarget<TInstance>,
): TInstance;
export function useInjectable(opts: IUseInjectableByTarget<unknown> | IUseInjectableByKey): unknown;

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
