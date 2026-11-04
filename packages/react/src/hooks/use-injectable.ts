import React from 'react';

import { type Container, getError, type TClass } from '@venizia/ignis-inversion';

import type { CoreBindings, ValueOf } from '@venizia/ardor-kernel';
import { ApplicationContext } from '../contexts/application';

/** Declaration-merge string keys into this interface to make them valid `key` values of the injectable hooks. */
export interface IUseInjectableKeysOverrides {}

/** The binding keys the kernel defines (the string values of `CoreBindings`). */
export type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;

/** A key the injectable hooks accept: a kernel binding key or one added to `IUseInjectableKeysOverrides`. */
export type TUseInjectableKeys = TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides;

/**
 * Resolve by `key` or by `target` class, never both.
 *
 * @example
 * ```ts
 * import { CoreBindings, type TUseInjectableOptions } from '@venizia/ardor';
 *
 * const byKey: TUseInjectableOptions = { key: CoreBindings.DEFAULT_REST_DATA_PROVIDER };
 * class Greeter {}
 * const byTarget: TUseInjectableOptions = { target: Greeter };
 * ```
 */
export type TUseInjectableOptions =
  | {
      /** The container to resolve from. @default The application's container (`ApplicationContext`) */
      container?: Container;
      key: TUseInjectableKeys;
      target?: never;
    }
  | {
      /** The container to resolve from. @default The application's container (`ApplicationContext`) */
      container?: Container;
      key?: never;
      target: TClass<unknown>;
    };

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
 * Resolves an instance from the container by `key` or by `target` class. Throws when the key is not
 * bound, when the class has no recorded binding key, or when neither `key` nor `target` is given.
 */
export const useInjectable = <TInstance>(opts: TUseInjectableOptions) => {
  const container = useApplicationContainer({ container: opts?.container });

  const { key, target } = opts;

  if (key) {
    if (!container.isBound({ key })) {
      throw getError({
        message: `Binding key: ${key} is not bounded in context! | A key derived from a class name (<namespace>.<ClassName>) changes when a minifier renames the class: resolve it by { target }, or pin it with binding: { namespace, key } on the class`,
      });
    }

    return container.get<TInstance>({ key });
  }

  if (!target) {
    throw getError({
      message: '[useInjectable] Failed to determine injectable! | Missing both key and target',
    });
  }

  const resolved = container.getMetadataRegistry().getBindingKey({ target });

  if (!resolved) {
    throw getError({
      message: `[useInjectable] No binding key is recorded on ${target.name} | Register it by stereotype (@service() and the rest) or by hand (service(), repository(), dataSource(), component(), bindingList()), or resolve it by { key }`,
    });
  }

  return container.get<TInstance>({ key: resolved });
};
