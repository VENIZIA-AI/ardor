import React from 'react';

import { BrowserStorage, type IStorageCodec, type TStorageArea } from '@venizia/ardor-kernel';

export interface IUseStoredStateOptions<TValue> {
  key: string;
  defaultValue: TValue;
  /** @default 'local' */
  storage?: TStorageArea;
  /** @default JSON */
  codec?: IStorageCodec<TValue>;
}

export interface IUseStoredStateReturn<TValue> {
  value: TValue;
  setValue: (next: TValue | ((current: TValue) => TValue)) => void;
  remove: () => void;
}

/** Reads the stored text as it is, `null` when there is none. */
const RAW_TEXT: IStorageCodec<string | null> = {
  encode: (text) => text ?? '',
  decode: (text) => text,
};

interface IDecoded<TValue> {
  key: string;
  storage?: TStorageArea;
  codec?: IStorageCodec<TValue>;
  text: string;
  value: TValue;
}

/**
 * A value kept in `localStorage` or `sessionStorage`, in step with other hooks on the key, with code
 * that writes through `BrowserStorage`, and with other tabs. Pass a stable `codec` and `defaultValue`.
 */
export const useStoredState = <TValue>(
  opts: IUseStoredStateOptions<TValue>,
): IUseStoredStateReturn<TValue> => {
  const { key, defaultValue, storage, codec } = opts;
  const decoded = React.useRef<IDecoded<TValue>>(undefined);

  const subscribe = React.useCallback(
    (listener: () => void) => BrowserStorage.subscribe({ key, storage, listener }),
    [key, storage],
  );

  const getSnapshot = React.useCallback((): TValue => {
    const text = BrowserStorage.get({ key, storage, fallback: null, codec: RAW_TEXT });
    if (text === null) {
      return defaultValue;
    }

    const hit = decoded.current;
    if (hit?.text === text && hit.key === key && hit.storage === storage && hit.codec === codec) {
      return hit.value;
    }

    const value = BrowserStorage.get({ key, fallback: defaultValue, storage, codec });
    decoded.current = { key, storage, codec, text, value };
    return value;
  }, [key, storage, codec, defaultValue]);

  const value = React.useSyncExternalStore(subscribe, getSnapshot, () => defaultValue);

  const setValue = React.useCallback(
    (next: TValue | ((current: TValue) => TValue)) => {
      const resolved =
        typeof next === 'function' ? (next as (current: TValue) => TValue)(getSnapshot()) : next;
      BrowserStorage.set({ key, value: resolved, storage, codec });
    },
    [key, storage, codec, getSnapshot],
  );

  const remove = React.useCallback(() => {
    BrowserStorage.remove({ key, storage });
  }, [key, storage]);

  return { value, setValue, remove };
};
