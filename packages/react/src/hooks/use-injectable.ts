import React from 'react';

import { Container, getError, type TClass } from '@venizia/ignis-inversion';

import { type AnyType, CoreBindings, type ValueOf } from '@venizia/ardor-kernel';
import { ApplicationContext } from '../contexts/application';

export interface IUseInjectableKeysOverrides {}

export type TUseInjectableKeysDefault = Extract<ValueOf<typeof CoreBindings>, string>;

export type TUseInjectableKeys = TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides;

export type TUseInjectableOptions =
  | { container?: Container; key: TUseInjectableKeys; target?: never }
  | { container?: Container; key?: never; target: TClass<AnyType> };

/**
 * The container an injectable hook resolves from: the one passed in, else the one the application
 * context holds. Shared so that every hook built on `useInjectable` reads the SAME container it
 * resolves from - a hook that re-derived it would be checking one container and resolving from
 * another, and the check would pass by accident.
 */
export const useInjectableContainer = (opts?: { container?: Container }): Container => {
  const applicationContext = React.useContext(ApplicationContext);
  const container = opts?.container ?? applicationContext.container;

  if (!container) {
    throw getError({
      message: '[useInjectable] Failed to determine injectable container!',
    });
  }

  return container;
};

export const useInjectable = <T>(opts: TUseInjectableOptions) => {
  const container = useInjectableContainer({ container: opts?.container });

  const { key, target } = opts;

  if (key) {
    return container.get<T>({ key });
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

  return container.get<T>({ key: resolved });
};
