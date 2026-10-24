import React from 'react';

import { Logger } from '@venizia/ardor-kernel';

import { useDebounce } from './use-debounce';

export interface IUseAutosaveOptions<TData, TReturn> {
  data: TData;
  onSave: (data: TData) => Promise<TReturn> | TReturn | void;
  /** @default 2000 */
  interval?: number;
  enableSaveOnUnmount?: boolean;
  /** @default true */
  enabled?: boolean;
}

const logger = Logger.getInstance({ scope: 'useAutosave' });

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
      return;
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
