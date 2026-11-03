import React from 'react';

import { App, BrowserUtility } from '@venizia/ardor-kernel';

export interface IUseDebounceOptions<TValue> {
  value: TValue;
  delay?: number;
  /** @default true */
  enabled?: boolean;
}

export interface IUseDebounceReturn<TValue> {
  debouncedValue: TValue;
}

export const useDebounce = <TValue>(
  opts: IUseDebounceOptions<TValue>,
): IUseDebounceReturn<TValue> => {
  const { value, delay, enabled = true } = opts;

  const [debouncedValue, setDebouncedValue] = React.useState<TValue>(value);

  React.useEffect(() => {
    if (!BrowserUtility.isBrowser() || !enabled) {
      return () => {};
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay ?? App.DEFAULT_DEBOUNCE_TIME);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay, enabled]);

  return { debouncedValue };
};
