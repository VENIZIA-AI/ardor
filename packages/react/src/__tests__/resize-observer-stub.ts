import { act } from '@testing-library/react';

import { FakeResizeObserver } from '@venizia/ardor-kernel/testing';

export const observerAt = (index: number): FakeResizeObserver => {
  const observer = FakeResizeObserver.all[index];

  if (!observer) {
    throw new Error(`No ResizeObserver was created at ${index}`);
  }

  return observer;
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

export const fire = (opts: {
  observer: FakeResizeObserver;
  entries: Array<ResizeObserverEntry>;
}) => {
  opts.observer.callback(opts.entries, opts.observer);
};

const original = {
  request: globalThis.requestAnimationFrame,
  cancel: globalThis.cancelAnimationFrame,
};

let restoreObserver: (() => void) | undefined;

export const installObserverStubs = () => {
  frames.clear();
  cancelled.length = 0;
  nextFrame = 1;
  restoreObserver = FakeResizeObserver.install();

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
  restoreObserver?.();
  globalThis.requestAnimationFrame = original.request;
  globalThis.cancelAnimationFrame = original.cancel;
};
