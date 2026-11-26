type TEntries = ReadonlyMap<Element, IntersectionObserverEntry>;

export interface IIntersectionScope {
  /** In target order, `null` for a target with no element yet. */
  elements: Array<Element | null>;
  root: Element | null;
  /** A `root` ref whose element is not there yet: nothing is observed until it is. */
  isRootPending: boolean;
}

export interface IIntersectionRequest {
  scope: IIntersectionScope;
  rootMargin?: string;
  /** The `threshold` option as JSON, so a list is compared by value. */
  thresholdKey?: string;
}

export interface IIntersectionSnapshot {
  scope: IIntersectionScope;
  entries: TEntries;
}

const NO_ENTRIES: TEntries = new Map();
const EMPTY_SNAPSHOT: IIntersectionSnapshot = {
  scope: { elements: [], root: null, isRootPending: false },
  entries: NO_ENTRIES,
};

/**
 * The `IntersectionObserver` of one `useIntersection`, read through `useSyncExternalStore`: `sync`
 * observes what the hook asks for, and the snapshot changes when that or an entry does.
 */
export class IntersectionStore {
  private snapshot = EMPTY_SNAPSHOT;
  /** What is observed, flat, so two requests compare item by item; undefined while nothing is. */
  private observed: unknown[] | undefined;
  private observer: IntersectionObserver | undefined;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): IIntersectionSnapshot => this.snapshot;

  /** Observes the request, from empty entries; the request already observed changes nothing. */
  sync(opts: IIntersectionRequest): void {
    const { scope, rootMargin, thresholdKey } = opts;
    const next = [rootMargin, thresholdKey, scope.root, scope.isRootPending, ...scope.elements];

    if (
      this.observed?.length === next.length &&
      this.observed.every((item, index) => item === next[index])
    ) {
      return;
    }

    this.disconnect();
    this.observed = next;
    this.publish({ scope, entries: NO_ENTRIES });
    this.observe(opts);
  }

  /** Stops observing; the next `sync` observes again. */
  disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.observed = undefined;
  }

  private observe(opts: IIntersectionRequest): void {
    const { scope, rootMargin, thresholdKey } = opts;
    const watched = new Set(scope.elements.filter((element) => element !== null));

    if (watched.size === 0 || scope.isRootPending || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver((delivered) => this.receive({ delivered }), {
      root: scope.root ?? undefined,
      rootMargin,
      threshold: thresholdKey === undefined ? undefined : JSON.parse(thresholdKey),
    });

    for (const element of watched) {
      this.observer.observe(element);
    }
  }

  /** Keeps the latest entry of each target; one with the same visibility and ratio changes nothing. */
  private receive(opts: { delivered: IntersectionObserverEntry[] }): void {
    const { scope, entries } = this.snapshot;
    const next = new Map(entries);
    let isChanged = false;

    for (const entry of opts.delivered) {
      const known = next.get(entry.target);

      if (
        known?.isIntersecting === entry.isIntersecting &&
        known.intersectionRatio === entry.intersectionRatio
      ) {
        continue;
      }

      next.set(entry.target, entry);
      isChanged = true;
    }

    if (isChanged) {
      this.publish({ scope, entries: next });
    }
  }

  private publish(snapshot: IIntersectionSnapshot): void {
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener();
    }
  }
}
