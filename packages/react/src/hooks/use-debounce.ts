import React from 'react';

import { App, BrowserUtility } from '@venizia/ardor-kernel';

export interface IUseDebounceOptions<TValue> {
  /** The value to follow; the output changes once it has been still for `delay`. */
  value: TValue;
  /** Milliseconds to wait after the last change. @default 500 */
  delay?: number;
  /** @default true */
  enabled?: boolean;
}

export interface IUseDebounceReturn<TValue> {
  /** The last `value` that stayed unchanged for `delay`; the first `value` until then. */
  debouncedValue: TValue;
}

/** Follows `value` after it has stopped changing for `delay`. Outside a browser, or when not `enabled`, it never updates. */
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
