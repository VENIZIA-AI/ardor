import type { TStorageArea } from '@/common';

/**
 * Fakes of the browser APIs ARDOR's hooks and helpers use, for a test host that has none of them or
 * whose own do nothing, such as happy-dom. Each fake puts itself on the global with `install`,
 * which returns the function that puts the previous value back.
 */

/**
 * Defines `name` on the global and, where `window` is another object (happy-dom), on `window` too, so
 * code that reads `window.matchMedia` or `window.localStorage` meets the fake. `at` names a member of
 * them instead (`navigator`). Answers the function that puts the previous properties back.
 */
const swap = (opts: { name: string; value: unknown; at?: string }): (() => void) => {
  const { name, value, at } = opts;
  const roots: Array<unknown> = [globalThis, Reflect.get(globalThis, 'window')];
  const targets = new Set<object>();

  for (const root of roots) {
    const target: unknown = at && root ? Reflect.get(Object(root), at) : root;

    if (typeof target === 'object' && target !== null) {
      targets.add(target);
    }
  }

  const restores = [...targets].map((target) => {
    const previous = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { value, configurable: true, writable: true });

    return () => {
      if (previous) {
        Object.defineProperty(target, name, previous);
      } else {
        Reflect.deleteProperty(target, name);
      }
    };
  });

  return () => {
    for (const restore of restores) {
      restore();
    }
  };
};

/** Removes the first `item` from `list`. */
const drop = (opts: { list: Array<Element>; item: Element }): void => {
  const index = opts.list.indexOf(opts.item);

  if (index >= 0) {
    opts.list.splice(index, 1);
  }
};

/**
 * A `ResizeObserver` whose `observe()` records the element. `flush` delivers a size to the observers
 * of an element; a callback runs at once, so code that waits for an animation frame still needs the
 * test's own frame control.
 */
export class FakeResizeObserver implements ResizeObserver {
  /** The observers created since the last `install`, in creation order. */
  static all: Array<FakeResizeObserver> = [];

  /** The elements observed now. */
  readonly targets: Array<Element> = [];
  /** The options of each `observe` call, in order. */
  readonly options: Array<ResizeObserverOptions | undefined> = [];
  /** Every element passed to `unobserve`, in order. */
  readonly unobserved: Array<Element> = [];
  isDisconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.all.push(this);
  }

  /** Replaces `globalThis.ResizeObserver` with the fake and forgets the earlier observers. */
  static install(): () => void {
    FakeResizeObserver.all = [];

    return swap({ name: 'ResizeObserver', value: FakeResizeObserver });
  }

  /** Calls every observer of `element` with one entry of that size, for the content and the border box alike. */
  static flush(opts: { element: Element; width: number; height: number }): void {
    const { element, width, height } = opts;
    const box = { x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height };
    const size = [{ inlineSize: width, blockSize: height }];
    const entry: ResizeObserverEntry = {
      target: element,
      contentRect: { ...box, toJSON: () => box },
      contentBoxSize: size,
      borderBoxSize: size,
      devicePixelContentBoxSize: [],
    };

    for (const observer of FakeResizeObserver.all) {
      if (observer.targets.includes(element)) {
        observer.callback([entry], observer);
      }
    }
  }

  observe(target: Element, options?: ResizeObserverOptions): void {
    if (!this.targets.includes(target)) {
      this.targets.push(target);
      this.options.push(options);
    }
  }

  unobserve(target: Element): void {
    this.unobserved.push(target);
    drop({ list: this.targets, item: target });
  }

  disconnect(): void {
    this.isDisconnected = true;
    this.targets.length = 0;
  }
}

const intersectionEntryOf = (opts: {
  element: Element;
  isIntersecting: boolean;
  ratio: number;
}): IntersectionObserverEntry => {
  const box = { x: 0, y: 0, width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10 };
  const rect = { ...box, toJSON: () => box };

  return {
    target: opts.element,
    isIntersecting: opts.isIntersecting,
    intersectionRatio: opts.ratio,
    boundingClientRect: rect,
    intersectionRect: rect,
    rootBounds: null,
    time: 0,
  };
};

/**
 * An `IntersectionObserver` whose `observe()` records the element and reports nothing by itself: `settle`
 * delivers the first report of a browser, `flush` delivers an entry to the observers of an element.
 */
export class FakeIntersectionObserver implements IntersectionObserver {
  /** The observers created since the last `install`, in creation order. */
  static all: Array<FakeIntersectionObserver> = [];

  /** How many observers were created since the last `install`. */
  static get created(): number {
    return FakeIntersectionObserver.all.length;
  }

  /** The observers created since the last `install` that are not disconnected. */
  static live(): Array<FakeIntersectionObserver> {
    return FakeIntersectionObserver.all.filter((observer) => !observer.isDisconnected);
  }

  /** The targets this observer has reported on: a browser reports each newly observed target once, at first. */
  readonly #reported = new Set<Element>();

  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  /** The elements observed now. */
  readonly targets: Array<Element> = [];
  isDisconnected = false;

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.all.push(this);
  }

  /** Replaces `globalThis.IntersectionObserver` with the fake and forgets the earlier observers. */
  static install(): () => void {
    FakeIntersectionObserver.all = [];

    return swap({ name: 'IntersectionObserver', value: FakeIntersectionObserver });
  }

  /** Calls every observer of `element` with one entry. `ratio` is 1 when the element intersects and 0 when not, unless given. */
  static flush(opts: { element: Element; isIntersecting: boolean; ratio?: number }): void {
    const { element, isIntersecting, ratio = isIntersecting ? 1 : 0 } = opts;
    const entry = intersectionEntryOf({ element, isIntersecting, ratio });

    for (const observer of FakeIntersectionObserver.all) {
      if (observer.targets.includes(element)) {
        observer.#reported.add(element);
        observer.callback([entry], observer);
      }
    }
  }

  /**
   * The first report of a browser: every live observer is called, once per target it has not reported
   * on yet, with the entry for `isIntersecting` (not intersecting by default). A target already
   * reported on, by `settle` or `flush`, is skipped.
   */
  static settle(opts: { isIntersecting?: boolean; ratio?: number } = {}): void {
    const { isIntersecting = false, ratio = isIntersecting ? 1 : 0 } = opts;

    for (const observer of FakeIntersectionObserver.live()) {
      const entries = observer.targets
        .filter((element) => !observer.#reported.has(element))
        .map((element) => {
          observer.#reported.add(element);

          return intersectionEntryOf({ element, isIntersecting, ratio });
        });

      if (entries.length > 0) {
        observer.callback(entries, observer);
      }
    }
  }

  observe(target: Element): void {
    if (!this.targets.includes(target)) {
      this.targets.push(target);
    }
  }

  unobserve(target: Element): void {
    this.#reported.delete(target);
    drop({ list: this.targets, item: target });
  }

  disconnect(): void {
    this.isDisconnected = true;
    this.targets.length = 0;
  }

  takeRecords(): Array<IntersectionObserverEntry> {
    return [];
  }
}

/** The `MediaQueryList` that `matchMedia` answers under `FakeMatchMedia.install`: one per query, `false` until `set`. */
export class FakeMatchMedia extends EventTarget {
  /** The queries asked since the last `install`, with the list each one got. */
  static readonly queries = new Map<string, FakeMatchMedia>();

  readonly #listeners = new Set<EventListenerOrEventListenerObject>();

  constructor(
    readonly media: string,
    public matches = false,
  ) {
    super();
  }

  /** How many distinct `change` listeners are subscribed now, to assert a subscribe and an unsubscribe. */
  get listenerCount(): number {
    return this.#listeners.size;
  }

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (type === 'change' && listener) {
      this.#listeners.add(listener);
    }

    super.addEventListener(type, listener, options);
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    if (type === 'change' && listener) {
      this.#listeners.delete(listener);
    }

    super.removeEventListener(type, listener, options);
  }

  /** Replaces `window.matchMedia` with a function that answers the list of the query. */
  static install(): () => void {
    FakeMatchMedia.queries.clear();

    return swap({
      name: 'matchMedia',
      value: (query: string): FakeMatchMedia => FakeMatchMedia.of(query),
    });
  }

  /** The list of `query`, made on the first ask. */
  static of(query: string): FakeMatchMedia {
    const list = FakeMatchMedia.queries.get(query) ?? new FakeMatchMedia(query);
    FakeMatchMedia.queries.set(query, list);

    return list;
  }

  /** Sets whether `query` matches and tells its listeners with a `change` event. */
  static set(opts: { query: string; matches: boolean }): void {
    const list = FakeMatchMedia.of(opts.query);
    list.matches = opts.matches;
    list.dispatchEvent(new Event('change'));
  }
}

/**
 * A `Storage` that behaves like the real one: stored keys are own properties, so `Object.keys` lists
 * them. Each way to fail has its own switch, and each can change at any time: `failReads` makes
 * `getItem` throw `SecurityError`, `failListing` makes `key` and `length` throw it, `failWrites` makes
 * `setItem` and `clear` throw `QuotaExceededError` and `removeItem` throw `SecurityError`. A key named like a member of the fake (`getItem`,
 * `length`, `writes`, `failWrites` and the rest) would shadow it, so `setItem` throws a `TypeError`
 * for it, where the real `Storage` accepts it.
 */
export class FakeStorage implements Storage {
  [name: string]: unknown;

  #failReads = false;
  #failListing = false;
  #failWrites = false;
  readonly #writes: Array<string> = [];

  get failReads(): boolean {
    return this.#failReads;
  }

  set failReads(value: boolean) {
    this.#failReads = value;
  }

  get failListing(): boolean {
    return this.#failListing;
  }

  set failListing(value: boolean) {
    this.#failListing = value;
  }

  get failWrites(): boolean {
    return this.#failWrites;
  }

  set failWrites(value: boolean) {
    this.#failWrites = value;
  }

  /** The values passed to `setItem` that the storage accepted, in order. */
  get writes(): Array<string> {
    return this.#writes;
  }

  get length(): number {
    this.#assertListable();

    return Object.keys(this).length;
  }

  /** Makes this the `localStorage` (the default) or the `sessionStorage` of the global. */
  install(area: TStorageArea = 'local'): () => void {
    const name = area === 'session' ? 'sessionStorage' : 'localStorage';

    return swap({ name, value: this });
  }

  getItem(key: string): string | null {
    this.#assertReadable();
    const value = Object.getOwnPropertyDescriptor(this, key)?.value;

    return typeof value === 'string' ? value : null;
  }

  setItem(key: string, value: string): void {
    this.#assertWritable('The quota has been exceeded', 'QuotaExceededError');

    if (Object.hasOwn(FakeStorage.prototype, key)) {
      throw new TypeError(`FakeStorage cannot store the key "${key}": it is a member of the fake`);
    }

    const text = String(value);
    Object.defineProperty(this, key, {
      value: text,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    this.#writes.push(text);
  }

  removeItem(key: string): void {
    this.#assertWritable('Access is denied', 'SecurityError');
    Reflect.deleteProperty(this, key);
  }

  clear(): void {
    this.#assertWritable('The quota has been exceeded', 'QuotaExceededError');

    for (const key of Object.keys(this)) {
      Reflect.deleteProperty(this, key);
    }
  }

  key(index: number): string | null {
    this.#assertListable();

    return Object.keys(this)[index] ?? null;
  }

  #assertListable(): void {
    if (this.#failListing) {
      throw new DOMException('Access is denied', 'SecurityError');
    }
  }

  #assertReadable(): void {
    if (this.#failReads) {
      throw new DOMException('Access is denied', 'SecurityError');
    }
  }

  #assertWritable(message: string, name: string): void {
    if (this.#failWrites) {
      throw new DOMException(message, name);
    }
  }
}

/** A `navigator.clipboard` that keeps the text in memory; `isDenied` makes both methods reject as a refused permission does. */
export class FakeClipboard {
  /** The text of every `writeText`, in order. */
  readonly written: Array<string> = [];
  /** What `readText` answers; `writeText` replaces it. */
  text = '';
  isDenied = false;

  /** Makes this the `navigator.clipboard`. */
  install(): () => void {
    return swap({ at: 'navigator', name: 'clipboard', value: this });
  }

  writeText(text: string): Promise<void> {
    if (this.isDenied) {
      return Promise.reject(new DOMException('Write permission denied', 'NotAllowedError'));
    }

    this.written.push(text);
    this.text = text;

    return Promise.resolve();
  }

  readText(): Promise<string> {
    if (this.isDenied) {
      return Promise.reject(new DOMException('Read permission denied', 'NotAllowedError'));
    }

    return Promise.resolve(this.text);
  }
}
