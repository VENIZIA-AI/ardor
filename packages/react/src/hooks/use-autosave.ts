import React from 'react';

import { useDebounce } from './use-debounce';

export interface IUseAutosaveParams<TData, TReturn> {
  /**
   * The controlled form value to be auto saved
   */
  data: TData;
  /**
   * Callback function to save data
   */
  onSave: (data: TData) => Promise<TReturn> | TReturn | void;
  /**
   * The number of milliseconds between save attempts
   * @default 2000
   */
  interval?: number;
  /**
   * Set to false if you do not want the save function to fire on unmount
   */
  enableSaveOnUnmount?: boolean;
  /**
   * Disable autosave
   */
  disabled?: boolean;
}

export const useAutosave = <TData, TReturn>(params: IUseAutosaveParams<TData, TReturn>) => {
  const { data, onSave, interval = 2000, enableSaveOnUnmount, disabled } = params;

  //---------------------------------------------------------------------------
  const valueOnCleanup = React.useRef(data);
  const initialRender = React.useRef(true);
  const handleSave = React.useRef(onSave);

  //---------------------------------------------------------------------------
  const { debouncedValue: debouncedValueToSave } = useDebounce({
    value: data,
    delay: interval,
    disabled,
  });

  //---------------------------------------------------------------------------
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

  //---------------------------------------------------------------------------
  React.useEffect(() => {
    valueOnCleanup.current = data;
    return () => {};
  }, [data]);

  //---------------------------------------------------------------------------
  React.useEffect(() => {
    handleSave.current = onSave;
    return () => {};
  }, [onSave]);

  //---------------------------------------------------------------------------
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
