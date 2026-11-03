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

class LegacyEntry implements ResizeObserverEntry {
  declare readonly borderBoxSize: ReadonlyArray<ResizeObserverSize>;
  readonly target = document.createElement('div');
  readonly contentBoxSize: ReadonlyArray<ResizeObserverSize> = [];
  readonly devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize> = [];
  readonly contentRect: DOMRectReadOnly;

  constructor(opts: { width: number; height: number }) {
    this.contentRect = new DOMRectReadOnly(0, 0, opts.width, opts.height);
  }
}

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

    expect(result.current).toEqual({ width: 0, height: 0, measured: false });
    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([element]);
    expect(observerAt(0).options).toEqual([{ box: 'content-box' }]);

    const before = renders;
    fire({ observer: observerAt(0), entries: [entryOf({ width: 10, height: 10 })] });
    fire({ observer: observerAt(0), entries: [entryOf({ width: 40, height: 20 })] });
    fire({ observer: observerAt(0), entries: [entryOf({ width: 100, height: 50 })] });

    expect(frames.size).toBe(1);
    expect(result.current).toEqual({ width: 0, height: 0, measured: false });

    flushFrames();

    expect(result.current).toEqual({ width: 100, height: 50, measured: true });
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
    expect(result.current).toEqual({ width: 108, height: 58, measured: true });

    fire({ observer: observerAt(0), entries: [entryOf({ width: 70, height: 30 })] });
    flushFrames();
    expect(result.current).toEqual({ width: 70, height: 30, measured: true });
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

  test('border-box on an entry without borderBoxSize, as before Safari 15.4, reads the content rect', () => {
    const ref = refOf(document.createElement('div'));
    const { result } = renderHook(() => useElementSize({ ref, box: 'border-box' }));

    fire({ observer: observerAt(0), entries: [new LegacyEntry({ width: 70, height: 30 })] });
    flushFrames();

    expect(result.current).toEqual({ width: 70, height: 30, measured: true });
  });

  test('a new box observes again with that box and starts from zero', () => {
    const ref = refOf(document.createElement('div'));
    const { result, rerender } = renderHook(
      (props: { box: 'content-box' | 'border-box' }) => useElementSize({ ref, box: props.box }),
      { initialProps: { box: 'content-box' } },
    );
    fire({ observer: observerAt(0), entries: [entryOf({ width: 100, height: 50 })] });
    flushFrames();
    expect(result.current).toEqual({ width: 100, height: 50, measured: true });

    rerender({ box: 'border-box' });

    expect(observerAt(0).disconnected).toBe(true);
    expect(observerAt(1).options).toEqual([{ box: 'border-box' }]);
    expect(result.current).toEqual({ width: 0, height: 0, measured: false });
  });

  test('a new ref cancels the pending frame, so the old element sets nothing, and starts from zero', () => {
    const first = refOf(document.createElement('div'));
    const second = refOf(document.createElement('div'));
    const { result, rerender } = renderHook(
      (props: { ref: { current: Element | null } }) => useElementSize({ ref: props.ref }),
      { initialProps: { ref: first } },
    );
    fire({ observer: observerAt(0), entries: [entryOf({ width: 100, height: 50 })] });
    flushFrames();
    fire({ observer: observerAt(0), entries: [entryOf({ width: 400, height: 300 })] });
    const pending = [...frames.keys()];
    expect(pending).toHaveLength(1);

    rerender({ ref: second });

    expect(cancelled).toEqual(pending);
    expect(frames.size).toBe(0);
    expect(result.current).toEqual({ width: 0, height: 0, measured: false });
  });

  test('a host with no ResizeObserver stays at zero, observes nothing and does not throw', () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
    const ref = refOf(document.createElement('div'));

    const { result } = renderHook(() => useElementSize({ ref }));

    expect(observers).toHaveLength(0);
    expect(result.current).toEqual({ width: 0, height: 0, measured: false });
  });

  test('a ref with no element observes nothing and does not throw', () => {
    const { result } = renderHook(() => useElementSize({ ref: refOf(null) }));

    expect(observers).toHaveLength(0);
    expect(result.current).toEqual({ width: 0, height: 0, measured: false });
  });
});

describe('useElementSize callback ref, round and measured', () => {
  test('the returned ref follows an element mounted later, then a replaced one', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { result } = renderHook(() => useElementSize());

    expect(observers).toHaveLength(0);
    expect(result.current).toMatchObject({ width: 0, height: 0, measured: false });

    act(() => {
      result.current.ref(first);
    });
    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([first]);

    fire({ observer: observerAt(0), entries: [entryOf({ width: 100, height: 50 })] });
    flushFrames();
    expect(result.current).toMatchObject({ width: 100, height: 50, measured: true });

    act(() => {
      result.current.ref(second);
    });
    expect(observerAt(0).disconnected).toBe(true);
    expect(observerAt(1).targets).toEqual([second]);
    expect(result.current).toMatchObject({ width: 0, height: 0, measured: false });

    act(() => {
      result.current.ref(null);
    });
    expect(observerAt(1).disconnected).toBe(true);
    expect(observers).toHaveLength(2);
  });

  test('the returned ref keeps its identity between renders', () => {
    const { result, rerender } = renderHook(() => useElementSize());
    const before = result.current.ref;

    rerender();

    expect(result.current.ref).toBe(before);
  });

  test('a ref object gives no ref back', () => {
    const { result } = renderHook(() =>
      useElementSize({ ref: refOf(document.createElement('div')) }),
    );

    expect(Reflect.has(result.current, 'ref')).toBe(false);
  });

  test('round gives whole pixels and renders nothing for a change under half a pixel', () => {
    const ref = refOf(document.createElement('div'));
    const { result } = renderHook(() => useElementSize({ ref, round: true }));

    fire({ observer: observerAt(0), entries: [entryOf({ width: 100.4, height: 49.6 })] });
    flushFrames();
    expect(result.current).toEqual({ width: 100, height: 50, measured: true });
    const before = result.current;

    fire({ observer: observerAt(0), entries: [entryOf({ width: 100.2, height: 49.9 })] });
    flushFrames();
    expect(result.current).toBe(before);
  });

  test('without round the size keeps its fraction', () => {
    const ref = refOf(document.createElement('div'));
    const { result } = renderHook(() => useElementSize({ ref }));

    fire({ observer: observerAt(0), entries: [entryOf({ width: 100.4, height: 49.6 })] });
    flushFrames();

    expect(result.current).toEqual({ width: 100.4, height: 49.6, measured: true });
  });

  test('a new round observes again from zero', () => {
    const ref = refOf(document.createElement('div'));
    const { result, rerender } = renderHook(
      (props: { round: boolean }) => useElementSize({ ref, round: props.round }),
      { initialProps: { round: false } },
    );
    fire({ observer: observerAt(0), entries: [entryOf({ width: 10.5, height: 10.5 })] });
    flushFrames();

    rerender({ round: true });

    expect(observers).toHaveLength(2);
    expect(result.current).toEqual({ width: 0, height: 0, measured: false });
  });

  test('an element measured at 0 by 0 is measured, unlike one not read yet', () => {
    const ref = refOf(document.createElement('div'));
    const { result } = renderHook(() => useElementSize({ ref }));
    expect(result.current.measured).toBe(false);

    fire({ observer: observerAt(0), entries: [entryOf({ width: 0, height: 0 })] });
    flushFrames();

    expect(result.current).toEqual({ width: 0, height: 0, measured: true });
  });

  test('a host with no ResizeObserver stays unmeasured, also through the callback ref', () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
    const { result } = renderHook(() => useElementSize());

    act(() => {
      result.current.ref(document.createElement('div'));
    });

    expect(result.current).toMatchObject({ width: 0, height: 0, measured: false });
  });
});
