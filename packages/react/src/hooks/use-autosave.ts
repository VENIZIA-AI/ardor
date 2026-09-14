import React from 'react';

import { useDebounce } from './use-debounce';

export interface IUseAutosaveParams<TData, TReturn> {
  data: TData;
  onSave: (data: TData) => Promise<TReturn> | TReturn | void;
  /** @default 2000 */
  interval?: number;
  enableSaveOnUnmount?: boolean;
  disabled?: boolean;
}

export const useAutosave = <TData, TReturn>(params: IUseAutosaveParams<TData, TReturn>) => {
  const { data, onSave, interval = 2000, enableSaveOnUnmount, disabled } = params;

  const valueOnCleanup = React.useRef(data);
  const initialRender = React.useRef(true);
  const handleSave = React.useRef(onSave);

  const { debouncedValue: debouncedValueToSave } = useDebounce({
    value: data,
    delay: interval,
    disabled,
  });

  React.useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    Promise.resolve(handleSave.current(debouncedValueToSave)).catch((error: unknown) => {
      console.error('[useAutosave] Failed to save debounced value | error: %s', error);
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
        console.error('[useAutosave] Failed to save value on unmount | error: %s', error);
      });
    };
  }, [enableSaveOnUnmount]);
};
