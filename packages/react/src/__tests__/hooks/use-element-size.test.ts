import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';

import { useElementSize } from '@/hooks/use-element-size';

interface IObserverRecord {
  readonly callback: ResizeObserverCallback;
  readonly targets: Array<Element>;
  readonly options: Array<ResizeObserverOptions | undefined>;
  disconnected: boolean;
  readonly instance: ResizeObserver;
}

const observers: Array<IObserverRecord> = [];

class StubResizeObserver implements ResizeObserver {
  private readonly record: IObserverRecord;

  constructor(callback: ResizeObserverCallback) {
    this.record = { callback, targets: [], options: [], disconnected: false, instance: this };
    observers.push(this.record);
  }

  observe = (target: Element, options?: ResizeObserverOptions): void => {
    this.record.targets.push(target);
    this.record.options.push(options);
  };

  unobserve = (_target: Element): void => {};

  disconnect = (): void => {
    this.record.disconnected = true;
  };
}

const observerAt = (index: number): IObserverRecord => {
  const record = observers[index];
  if (!record) {
    throw new Error(`No ResizeObserver was created at ${index}`);
  }

  return record;
};

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
const cancelled: Array<number> = [];

const flushFrames = () => {
  const pending = [...frames.entries()];
  frames.clear();
  act(() => {
    for (const [, callback] of pending) {
      callback(0);
    }
  });
};

const entryOf = (opts: {
  width: number;
  height: number;
  border?: { inlineSize: number; blockSize: number };
}): ResizeObserverEntry => {
  const target = document.createElement('div');
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

const fire = (opts: { observer: IObserverRecord; entries: Array<ResizeObserverEntry> }) => {
  opts.observer.callback(opts.entries, opts.observer.instance);
};

const original = {
  observer: globalThis.ResizeObserver,
  request: globalThis.requestAnimationFrame,
  cancel: globalThis.cancelAnimationFrame,
};

beforeEach(() => {
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
});

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = original.observer;
  globalThis.requestAnimationFrame = original.request;
  globalThis.cancelAnimationFrame = original.cancel;
});

const refOf = (element: Element | null) => ({ current: element });

describe('useElementSize', () => {
  test('starts at zero, observes the content box by default, and updates once per frame', () => {
    const element = document.createElement('div');
    const ref = refOf(element);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useElementSize({ ref });
    });

    expect(result.current).toEqual({ width: 0, height: 0 });
    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([element]);
    expect(observerAt(0).options).toEqual([{ box: 'content-box' }]);

    const before = renders;
    fire({ observer: observerAt(0), entries: [entryOf({ width: 10, height: 10 })] });
    fire({ observer: observerAt(0), entries: [entryOf({ width: 40, height: 20 })] });
    fire({ observer: observerAt(0), entries: [entryOf({ width: 100, height: 50 })] });

    expect(frames.size).toBe(1);
    expect(result.current).toEqual({ width: 0, height: 0 });

    flushFrames();

    expect(result.current).toEqual({ width: 100, height: 50 });
    expect(renders - before).toBe(1);
  });

  test('a measure that did not change renders nothing', () => {
    const ref = refOf(document.createElement('div'));
    const { result } = renderHook(() => useElementSize({ ref }));
    fire({ observer: observerAt(0), entries: [entryOf({ width: 100, height: 50 })] });
    flushFrames();
    const before = result.current;

    fire({ observer: observerAt(0), entries: [entryOf({ width: 100, height: 50 })] });
    flushFrames();

    expect(result.current).toBe(before);
  });

  test('box border-box observes the border box and reads its size, falling back to the content rect', () => {
    const ref = refOf(document.createElement('div'));
    const { result } = renderHook(() => useElementSize({ ref, box: 'border-box' }));

    expect(observerAt(0).options).toEqual([{ box: 'border-box' }]);

    fire({
      observer: observerAt(0),
      entries: [entryOf({ width: 100, height: 50, border: { inlineSize: 108, blockSize: 58 } })],
    });
    flushFrames();
    expect(result.current).toEqual({ width: 108, height: 58 });

    fire({ observer: observerAt(0), entries: [entryOf({ width: 70, height: 30 })] });
    flushFrames();
    expect(result.current).toEqual({ width: 70, height: 30 });
  });

  test('unmount disconnects and cancels a pending frame, so a late measure sets nothing', () => {
    const ref = refOf(document.createElement('div'));
    const { unmount } = renderHook(() => useElementSize({ ref }));
    fire({ observer: observerAt(0), entries: [entryOf({ width: 10, height: 10 })] });
    const pending = [...frames.keys()];

    unmount();

    expect(observerAt(0).disconnected).toBe(true);
    expect(cancelled).toEqual(pending);
    expect(frames.size).toBe(0);
  });

  test('a new ref disconnects the old observer and observes the new element', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { rerender } = renderHook(
      (props: { element: Element }) => {
        return useElementSize({ ref: refOf(props.element) });
      },
      { initialProps: { element: first } },
    );

    rerender({ element: second });

    expect(observers).toHaveLength(2);
    expect(observerAt(0).disconnected).toBe(true);
    expect(observerAt(1).targets).toEqual([second]);
  });

  test('a ref with no element observes nothing and does not throw', () => {
    const { result } = renderHook(() => useElementSize({ ref: refOf(null) }));

    expect(observers).toHaveLength(0);
    expect(result.current).toEqual({ width: 0, height: 0 });
  });
});
