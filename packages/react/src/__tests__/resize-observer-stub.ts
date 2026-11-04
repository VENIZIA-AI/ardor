import { act } from '@testing-library/react';

export interface IObserverRecord {
  readonly callback: ResizeObserverCallback;
  readonly targets: Array<Element>;
  readonly unobserved: Array<Element>;
  readonly options: Array<ResizeObserverOptions | undefined>;
  disconnected: boolean;
  readonly instance: ResizeObserver;
}

export const observers: Array<IObserverRecord> = [];

class StubResizeObserver implements ResizeObserver {
  private readonly record: IObserverRecord;

  constructor(callback: ResizeObserverCallback) {
    this.record = {
      callback,
      targets: [],
      unobserved: [],
      options: [],
      disconnected: false,
      instance: this,
    };
    observers.push(this.record);
  }

  observe = (target: Element, options?: ResizeObserverOptions): void => {
    this.record.targets.push(target);
    this.record.options.push(options);
  };

  unobserve = (target: Element): void => {
    this.record.unobserved.push(target);
  };

  disconnect = (): void => {
    this.record.disconnected = true;
  };
}

export const observerAt = (index: number): IObserverRecord => {
  const record = observers[index];
  if (!record) {
    throw new Error(`No ResizeObserver was created at ${index}`);
  }

  return record;
};

export const frames = new Map<number, FrameRequestCallback>();
export const cancelled: Array<number> = [];
let nextFrame = 1;

export const flushFrames = () => {
  const pending = [...frames.entries()];
  frames.clear();
  act(() => {
    for (const [, callback] of pending) {
      callback(0);
    }
  });
};

export const entryOf = (opts: {
  width: number;
  height: number;
  target?: Element;
  border?: { inlineSize: number; blockSize: number };
}): ResizeObserverEntry => {
  const target = opts.target ?? document.createElement('div');
  const rect = new DOMRectReadOnly(0, 0, opts.width, opts.height);
  const borderBoxSize: Array<ResizeObserverSize> = opts.border ? [opts.border] : [];

  return {
    target,
    contentRect: rect,
    borderBoxSize,
    contentBoxSize: [{ inlineSize: opts.width, blockSize: opts.height }],
    devicePixelContentBoxSize: [],
  };
};

export class LegacyEntry implements ResizeObserverEntry {
  declare readonly borderBoxSize: ReadonlyArray<ResizeObserverSize>;
  readonly target = document.createElement('div');
  readonly contentBoxSize: ReadonlyArray<ResizeObserverSize> = [];
  readonly devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize> = [];
  readonly contentRect: DOMRectReadOnly;

  constructor(opts: { width: number; height: number }) {
    this.contentRect = new DOMRectReadOnly(0, 0, opts.width, opts.height);
  }
}

export const fire = (opts: { observer: IObserverRecord; entries: Array<ResizeObserverEntry> }) => {
  opts.observer.callback(opts.entries, opts.observer.instance);
};

const original = {
  observer: globalThis.ResizeObserver,
  request: globalThis.requestAnimationFrame,
  cancel: globalThis.cancelAnimationFrame,
};

export const installObserverStubs = () => {
  observers.length = 0;
  frames.clear();
  cancelled.length = 0;
  nextFrame = 1;
  globalThis.ResizeObserver = StubResizeObserver;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
    frames.delete(id);
  };
};

export const restoreObserverStubs = () => {
  globalThis.ResizeObserver = original.observer;
  globalThis.requestAnimationFrame = original.request;
  globalThis.cancelAnimationFrame = original.cancel;
};
