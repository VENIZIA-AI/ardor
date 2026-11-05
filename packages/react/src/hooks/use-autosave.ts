import React from 'react';

import { LoggerFactory } from '@venizia/ignis-helpers/core';

import { useDebounce } from './use-debounce';

/** What `useAutosave` saves, through which callback, and how long it waits. */
export interface IUseAutosaveOptions<TData, TReturn> {
  /** The value to save; a change starts the `interval` wait. */
  data: TData;
  /** Called with the latest `data` once it has been still for `interval`. A rejection is logged, not thrown. */
  onSave: (data: TData) => Promise<TReturn> | TReturn | void;
  /** @default 2000 */
  interval?: number;
  /** Save the latest `data` on unmount. */
  enableSaveOnUnmount?: boolean;
  /** @default true */
  enabled?: boolean;
}

const logger = LoggerFactory.getLogger(['useAutosave']);

/**
 * Calls `onSave` with `data` after it has stopped changing for `interval` milliseconds. The first
 * render does not save. The latest `onSave` is always the one called.
 */
export const useAutosave = <TData, TReturn>(opts: IUseAutosaveOptions<TData, TReturn>) => {
  const { data, onSave, interval = 2000, enableSaveOnUnmount, enabled = true } = opts;

  const valueOnCleanup = React.useRef(data);
  const initialRender = React.useRef(true);
  const handleSave = React.useRef(onSave);

  const { debouncedValue: debouncedValueToSave } = useDebounce({
    value: data,
    delay: interval,
    enabled,
  });

  React.useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;

      return () => {};
    }

    Promise.resolve(handleSave.current(debouncedValueToSave)).catch((error: unknown) => {
      logger.error('[useAutosave] Failed to save debounced value | error: %s', error);
    });

    return () => {};
  }, [debouncedValueToSave]);

  React.useEffect(() => {
    valueOnCleanup.current = data;

    return () => {};
  }, [data]);

  React.useEffect(() => {
    handleSave.current = onSave;

    return () => {};
  }, [onSave]);

  React.useEffect(() => {
    return () => {
      if (!enableSaveOnUnmount) {
        return;
      }

      Promise.resolve(handleSave.current(valueOnCleanup.current)).catch((error: unknown) => {
        logger.error('[useAutosave] Failed to save value on unmount | error: %s', error);
      });
    };
  }, [enableSaveOnUnmount]);
};
