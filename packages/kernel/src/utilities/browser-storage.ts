import { type IStorageCodec, LocalStorageKeys, StorageAreas, type TStorageArea } from '@/common';

interface ISubscription {
  key: string;
  storage?: TStorageArea;
  listener: () => void;
}

/**
 * `localStorage` and `sessionStorage` that never throw: a missing area, a blocked accessor, a quota
 * error or text the codec cannot read gives the fallback or `false`. Nothing touches `window` at
 * import. A key under `LocalStorageKeys.PREFIX_AUTH` is the session and is never written here.
 */
export class BrowserStorage {
  private static readonly subs = new Set<ISubscription>();

  /** The one catch: a storage that throws is the case this class absorbs, so every access runs here. */
  private static safe<TResult>(opts: { run: () => TResult; fallback: TResult }): TResult {
    try {
      return opts.run();
      // eslint-disable-next-line venizia/no-silent-catch -- absorbing a throwing storage is the contract of BrowserStorage
    } catch {
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
  // oxlint-disable-next-line typescript/unified-signatures -- the first overload takes the type from the codec, a union would lose that
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

  /** The keys of the area, only those that start with `prefix` when it is given. Lists the session keys too. */
  static keys(
    opts: {
      storage?: TStorageArea;
      /** @default '' */
      prefix?: string;
    } = {},
  ): Array<string> {
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

  /**
   * Removes every key that starts with `prefix` and answers how many it removed. An empty `prefix`
   * removes nothing, and a session key is never removed, as in `remove`. A key another tab removed
   * after the listing still counts: `removeItem` of a missing key does not throw.
   */
  static removeWhere(opts: { storage?: TStorageArea; prefix: string }): number {
    const { storage, prefix } = opts;
    const keys = prefix ? BrowserStorage.keys({ storage, prefix }) : [];

    return keys.filter((key) => BrowserStorage.remove({ key, storage })).length;
  }

  /** `listener` runs after a write through `BrowserStorage` and after another tab changes the key. */
  static subscribe(opts: {
    key: string;
    storage?: TStorageArea;
    listener: () => void;
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
        BrowserStorage.notify({ key: opts.key, area });

        return true;
      },
      fallback: false,
    });
  }

  private static notify(opts: { key: unknown; area: unknown }): void {
    for (const { key, storage, listener } of BrowserStorage.subs) {
      if (
        (opts.key === null || opts.key === key) &&
        opts.area === BrowserStorage.area({ storage })
      ) {
        BrowserStorage.safe<void>({ run: listener, fallback: undefined });
      }
    }
  }

  private static readonly onEvent = (event: Event): void => {
    if ('key' in event && 'storageArea' in event) {
      BrowserStorage.notify({ key: event.key, area: event.storageArea });
    }
  };
}
