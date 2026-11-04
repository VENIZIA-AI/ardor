import React from 'react';

import {
  BrowserStorage,
  type IStorageCodec,
  StorageCodecs,
  type TStorageArea,
} from '@venizia/ardor-kernel';

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

const RAW_TEXT = StorageCodecs.text();

interface IKept<TValue> {
  key: string;
  storage?: TStorageArea;
  value: TValue;
}

const isUpdater = <TValue>(
  next: TValue | ((current: TValue) => TValue),
): next is (current: TValue) => TValue => typeof next === 'function';

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
 * A write or a removal that the storage refuses is kept in this hook until the storage next changes.
 */
export const useStoredState = <TValue>(
  opts: IUseStoredStateOptions<TValue>,
): IUseStoredStateReturn<TValue> => {
  const { key, defaultValue, storage, codec } = opts;
  const decoded = React.useRef<IDecoded<TValue>>(undefined);
  const keptRef = React.useRef<IKept<TValue>>(undefined);
  const [kept, setKept] = React.useState<IKept<TValue>>();

  const keep = React.useCallback((next: IKept<TValue> | undefined) => {
    keptRef.current = next;
    setKept(next);
  }, []);

  const subscribe = React.useCallback(
    (listener: () => void) => {
      return BrowserStorage.subscribe({
        key,
        storage,
        listener: () => {
          keep(undefined);
          listener();
        },
      });
    },
    [key, storage, keep],
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

  const stored = React.useSyncExternalStore(subscribe, getSnapshot, () => defaultValue);
  const value = kept?.key === key && kept.storage === storage ? kept.value : stored;

  const setValue = React.useCallback(
    (next: TValue | ((current: TValue) => TValue)) => {
      const hit = keptRef.current;
      const current = hit?.key === key && hit.storage === storage ? hit.value : getSnapshot();
      const resolved = isUpdater(next) ? next(current) : next;
      const isStored = BrowserStorage.set({ key, value: resolved, storage, codec });

      keep(isStored ? undefined : { key, storage, value: resolved });
    },
    [key, storage, codec, getSnapshot, keep],
  );

  const remove = React.useCallback(() => {
    const isRemoved = BrowserStorage.remove({ key, storage });

    keep(isRemoved ? undefined : { key, storage, value: defaultValue });
  }, [key, storage, defaultValue, keep]);

  return { value, setValue, remove };
};
