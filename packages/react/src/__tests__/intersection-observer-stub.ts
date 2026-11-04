export interface IIntersectionRecord {
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  readonly targets: Array<Element>;
  disconnected: boolean;
  readonly instance: IntersectionObserver;
}

export const intersections: Array<IIntersectionRecord> = [];

class StubIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly record: IIntersectionRecord;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { callback, options, targets: [], disconnected: false, instance: this };
    intersections.push(this.record);
  }

  observe = (target: Element): void => {
    this.record.targets.push(target);
  };

  unobserve = (_target: Element): void => {};

  disconnect = (): void => {
    this.record.disconnected = true;
  };

  takeRecords = (): Array<IntersectionObserverEntry> => [];
}

export const intersectionAt = (index: number): IIntersectionRecord => {
  const record = intersections[index];
  if (!record) {
    throw new Error(`No IntersectionObserver was created at ${index}`);
  }

  return record;
};

export const intersectionEntryOf = (opts: {
  target: Element;
  isIntersecting: boolean;
  ratio: number;
}): IntersectionObserverEntry => {
  const rect = new DOMRectReadOnly(0, 0, 10, 10);

  return {
    target: opts.target,
    isIntersecting: opts.isIntersecting,
    intersectionRatio: opts.ratio,
    boundingClientRect: rect,
    intersectionRect: rect,
    rootBounds: null,
    time: 0,
  };
};

export const fireIntersection = (opts: {
  record: IIntersectionRecord;
  entries: Array<IntersectionObserverEntry>;
}) => {
  opts.record.callback(opts.entries, opts.record.instance);
};

const original = globalThis.IntersectionObserver;

export const installIntersectionStub = () => {
  intersections.length = 0;
  globalThis.IntersectionObserver = StubIntersectionObserver;
};

export const restoreIntersectionStub = () => {
  globalThis.IntersectionObserver = original;
};
