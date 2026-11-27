import { getError } from '@venizia/ignis-inversion';
import { LoggerFactory } from '@venizia/ignis-helpers/core';
import { type IStorageCodec, LocalStorageKeys, StorageAreas, type TStorageArea } from '@/common';

/** What `BrowserStorage.subscribe` tells its listener about a change. */
export interface IStorageChange {
  /** `true` when another tab or window changed the storage (a `storage` event); `false` for a write or removal through `BrowserStorage` in this one. */
  isExternal: boolean;
}

interface ISubscription {
  key: string;
  storage?: TStorageArea;
  listener: (change: IStorageChange) => void;
}

/**
 * `localStorage` and `sessionStorage` that never throw: a missing area, a blocked accessor, a quota
 * error or text the codec cannot read gives the fallback or `false`. Nothing touches `window` at
 * import. A key under `LocalStorageKeys.PREFIX_AUTH` is the session and is never written here.
 */
export class BrowserStorage {
  private static readonly subs = new Set<ISubscription>();
  private static readonly logger = LoggerFactory.getLogger(['BrowserStorage']);

  /** The one catch: a storage that throws is the case this class absorbs, so every access runs here. */
  private static safe<TResult>(opts: { run: () => TResult; fallback: TResult }): TResult {
    try {
      return opts.run();
    } catch (error) {
      // The name only: a message may quote the stored text.
      BrowserStorage.logger.debug(
        '[safe] The storage refused | error: %s',
        error instanceof Error ? error.name : typeof error,
      );

      return opts.fallback;
    }
  }

  private static area(opts: { storage?: TStorageArea }): Storage | undefined {
    return BrowserStorage.safe<Storage | undefined>({
      run: () => {
        return opts.storage === StorageAreas.SESSION
          ? globalThis.sessionStorage
          : globalThis.localStorage;
      },
      fallback: undefined,
    });
  }

  /** With a codec, the fallback may be of another type, such as `null` for "nothing is stored". */
  static get<TValue, TFallback>(opts: {
    key: string;
    fallback: TFallback;
    storage?: TStorageArea;
    codec: IStorageCodec<TValue>;
  }): TValue | TFallback;
  static get<TValue>(opts: {
    key: string;
    fallback: TValue;
    storage?: TStorageArea;
    codec?: IStorageCodec<TValue>;
  }): TValue;
  static get<TValue>(opts: {
    key: string;
    fallback: TValue;
    storage?: TStorageArea;
    codec?: IStorageCodec<TValue>;
  }): TValue {
    const { key, fallback, codec } = opts;

    return BrowserStorage.safe({
      run: () => {
        const text = BrowserStorage.area(opts)?.getItem(key);

        return text === null || text === undefined
          ? fallback
          : codec
            ? codec.decode(text)
            : JSON.parse(text);
      },
      fallback,
    });
  }

  /** With a codec, the value is checked against the codec's type, so a literal is not widened past it. */
  static set<TValue>(opts: {
    key: string;
    value: NoInfer<TValue>;
    storage?: TStorageArea;
    codec: IStorageCodec<TValue>;
  }): boolean;
  /** Without a codec, or with one that may be absent, the value's own type is the stored type. */
  static set<TValue>(opts: {
    key: string;
    value: TValue;
    storage?: TStorageArea;
    codec?: IStorageCodec<TValue>;
  }): boolean;
  static set<TValue>(opts: {
    key: string;
    value: TValue;
    storage?: TStorageArea;
    codec?: IStorageCodec<TValue>;
  }): boolean {
    const { key, value, codec } = opts;

    return BrowserStorage.write({
      ...opts,
      run: (area) => {
        const text = codec ? codec.encode(value) : JSON.stringify(value);

        if (typeof text !== 'string') {
          throw new TypeError('not JSON');
        }

        area.setItem(key, text);
      },
    });
  }

  /** Removes the key; `false` when it is under `LocalStorageKeys.PREFIX_AUTH`, when there is no such area, or when storage throws. */
  static remove(opts: { key: string; storage?: TStorageArea }): boolean {
    return BrowserStorage.write({ ...opts, run: (area) => area.removeItem(opts.key) });
  }

  /**
   * The keys of the area, only those that start with `prefix` when it is given. Lists the session keys
   * too. A `prefix` that is given and is not a non-empty string throws.
   */
  static keys(
    opts: {
      storage?: TStorageArea;
      /** Absent: every key. */
      prefix?: string;
    } = {},
  ): Array<string> {
    if ('prefix' in opts) {
      BrowserStorage.assertPrefix({ prefix: opts.prefix, method: 'keys' });
    }

    const { prefix = '' } = opts;

    return BrowserStorage.safe<Array<string>>({
      run: () => {
        const area = BrowserStorage.area(opts);

        if (!area) {
          return [];
        }

        const keys = Array.from({ length: area.length }, (_, index) => area.key(index));

        return keys.filter((key): key is string => !!key?.startsWith(prefix));
      },
      fallback: [],
    });
  }

  /** Throws unless `prefix` is a non-empty string: `undefined` would match nothing, `''` everything. */
  private static assertPrefix(opts: { prefix: unknown; method: string }): void {
    if (typeof opts.prefix !== 'string' || !opts.prefix) {
      throw getError({
        message: `[BrowserStorage.${opts.method}] prefix must be a non-empty string`,
      });
    }
  }

  /**
   * Removes every key that starts with `prefix` and answers how many it removed. A `prefix` that is
   * not a non-empty string throws, so a name read wrongly cannot pass for a sweep, and a session key
   * is never removed, as in `remove`. Every subscriber of a key under the
   * prefix is told, whether or not the key was stored. A key another tab removed
   * after the listing still counts: `removeItem` of a missing key does not throw.
   */
  static removeWhere(opts: { storage?: TStorageArea; prefix: string }): number {
    const { storage, prefix } = opts;
    BrowserStorage.assertPrefix({ prefix, method: 'removeWhere' });
    const keys = BrowserStorage.keys({ storage, prefix });

    const removed = keys.filter((key) => BrowserStorage.remove({ key, storage })).length;

    // A key not stored yet, with a write waiting for it, is under the prefix too: tell its subscribers.
    BrowserStorage.notify({
      key: undefined,
      area: BrowserStorage.area({ storage }),
      prefix,
      isExternal: false,
    });

    return removed;
  }

  /**
   * `listener` runs after a write through `BrowserStorage` and after another tab changes the key, and says which
   * of the two it was in `change.isExternal`: a listener that writes back can skip the change of another tab, and one that
   * shows "changed in another tab" can skip its own. A listener that takes no argument is called the same way.
   */
  static subscribe(opts: {
    key: string;
    storage?: TStorageArea;
    listener: (change: IStorageChange) => void;
  }): () => void {
    const subscription: ISubscription = { ...opts };

    if (BrowserStorage.subs.size === 0) {
      BrowserStorage.listen({ on: true });
    }

    BrowserStorage.subs.add(subscription);

    return () => {
      BrowserStorage.subs.delete(subscription);

      if (BrowserStorage.subs.size === 0) {
        BrowserStorage.listen({ on: false });
      }
    };
  }

  private static listen(opts: { on: boolean }): void {
    const events: Partial<EventTarget> = globalThis;
    const method = opts.on ? events.addEventListener : events.removeEventListener;

    method?.call(globalThis, 'storage', BrowserStorage.onEvent);
  }

  private static write(opts: {
    key: string;
    storage?: TStorageArea;
    run: (area: Storage) => void;
  }): boolean {
    const area = BrowserStorage.area(opts);

    if (!area || opts.key.startsWith(LocalStorageKeys.PREFIX_AUTH)) {
      return false;
    }

    return BrowserStorage.safe({
      run: () => {
        opts.run(area);
        BrowserStorage.notify({ key: opts.key, area, isExternal: false });

        return true;
      },
      fallback: false,
    });
  }

  private static notify(opts: {
    key: unknown;
    area: unknown;
    prefix?: string;
    isExternal: boolean;
  }): void {
    for (const { key, storage, listener } of BrowserStorage.subs) {
      if (
        (opts.key === null || opts.key === key || (!!opts.prefix && key.startsWith(opts.prefix))) &&
        opts.area === BrowserStorage.area({ storage })
      ) {
        BrowserStorage.safe<void>({
          run: () => listener({ isExternal: opts.isExternal }),
          fallback: undefined,
        });
      }
    }
  }

  private static readonly onEvent = (event: Event): void => {
    if ('key' in event && 'storageArea' in event) {
      BrowserStorage.notify({ key: event.key, area: event.storageArea, isExternal: true });
    }
  };
}
