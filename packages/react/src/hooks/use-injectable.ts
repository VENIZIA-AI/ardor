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

export const useInjectable = <T>(opts: TUseInjectableOptions) => {
  const requestContainer = opts?.container;
  const applicationContext = React.useContext(ApplicationContext);

  const container = requestContainer ?? applicationContext.container;
  if (!container) {
    throw getError({
      message: '[useInjectable] Failed to determine injectable container!',
    });
  }

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
      message: `[useInjectable] Failed to resolve binding key for target: ${target.name}! | Decorate it (@service, @component, ...) or register it on the application before injecting`,
    });
  }

  return container.get<T>({ key: resolved });
};
