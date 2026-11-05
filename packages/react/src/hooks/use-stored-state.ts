import React from 'react';

import {
  BrowserStorage,
  type IStorageCodec,
  StorageCodecs,
  type TStorageArea,
} from '@venizia/ardor-kernel';

/** What `useStoredState` stores, where and how. */
export interface IUseStoredStateOptions<TValue> {
  /** The storage key. */
  key: string;
  /** The value while the key holds nothing. */
  defaultValue: TValue;
  /** @default 'local' */
  storage?: TStorageArea;
  /** @default JSON */
  codec?: IStorageCodec<TValue>;
  /** Write storage once, this many milliseconds after the last `setValue`; `value` changes at once. Above 0, also pass a stable `codec`. @default 0 */
  writeDelayMs?: number;
}

/** The value `useStoredState` holds, and how to change or remove it. */
export interface IUseStoredStateReturn<TValue> {
  /** The stored value, or `defaultValue` when the key holds nothing. */
  value: TValue;
  /** Stores a value, or the result of an updater called with the current one. */
  setValue: (next: TValue | ((current: TValue) => TValue)) => void;
  /** Removes the key, so `value` is `defaultValue` again. */
  remove: () => void;
}

/** The call signatures of `useStoredState`. */
export interface IUseStoredState {
  /** With a codec, the value type is the codec's: a literal `defaultValue` is checked against it, not widened past it. */
  <TValue>(
    opts: Omit<IUseStoredStateOptions<TValue>, 'defaultValue' | 'codec'> & {
      defaultValue: NoInfer<TValue>;
      codec: IStorageCodec<TValue>;
    },
  ): IUseStoredStateReturn<TValue>;
  // oxlint-disable-next-line typescript/unified-signatures -- the first overload takes the type from the codec, a union would lose that
  <TValue>(opts: IUseStoredStateOptions<TValue>): IUseStoredStateReturn<TValue>;
}

const RAW_TEXT = StorageCodecs.text();

interface IKept<TValue> {
  key: string;
  storage?: TStorageArea;
  codec?: IStorageCodec<TValue>;
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
 * With `writeDelayMs` the value waits in the same place for the delay: a change of the storage from
 * outside drops it, and an unmount or a new key or storage writes it at once.
 *
 * @example
 * ```tsx
 * import { useStoredState } from '@venizia/ardor';
 *
 * export function ThemeToggle() {
 *   const { value, setValue } = useStoredState({ key: 'theme', defaultValue: 'light' });
 *   return <button onClick={() => setValue(value === 'light' ? 'dark' : 'light')}>{value}</button>;
 * }
 * ```
 */
export const useStoredState: IUseStoredState = <TValue>(
  opts: IUseStoredStateOptions<TValue>,
): IUseStoredStateReturn<TValue> => {
  const { key, defaultValue, storage, codec, writeDelayMs = 0 } = opts;
  const decoded = React.useRef<IDecoded<TValue>>(undefined);
  const keptRef = React.useRef<IKept<TValue>>(undefined);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const [kept, setKept] = React.useState<IKept<TValue>>();

  // Every change of the kept value ends a pending write; only a delayed setValue starts one.
  const keep = React.useCallback((next: IKept<TValue> | undefined) => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    keptRef.current = next;
    setKept(next);
  }, []);

  const write = React.useCallback(
    (entry: IKept<TValue>) => {
      keep(BrowserStorage.set(entry) ? undefined : entry);
    },
    [keep],
  );

  // A new key or storage, and an unmount, write the pending value to the key it was set for.
  React.useEffect(() => {
    return () => {
      if (timerRef.current !== undefined && keptRef.current) {
        write(keptRef.current);
      }
    };
  }, [key, storage, write]);

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
      const entry = { key, storage, codec, value: isUpdater(next) ? next(current) : next };

      if (!(writeDelayMs > 0)) {
        write(entry);

        return;
      }

      keep(entry);
      timerRef.current = setTimeout(() => write(entry), writeDelayMs);
    },
    [key, storage, codec, writeDelayMs, getSnapshot, keep, write],
  );

  const remove = React.useCallback(() => {
    const isRemoved = BrowserStorage.remove({ key, storage });

    keep(isRemoved ? undefined : { key, storage, value: defaultValue });
  }, [key, storage, defaultValue, keep]);

  return { value, setValue, remove };
};
