import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';

import { useResizeEffect } from '@/hooks/use-resize-effect';
import {
  cancelled,
  entryOf,
  fire,
  flushFrames,
  frames,
  installObserverStubs,
  observerAt,
  observers,
  restoreObserverStubs,
} from '../resize-observer-stub';

beforeEach(installObserverStubs);

afterEach(() => {
  cleanup();
  restoreObserverStubs();
});

const refOf = (element: Element | null) => ({ current: element });

const recorder = () => {
  const calls: Array<Array<ResizeObserverEntry>> = [];

  return {
    calls,
    onResize: (entries: Array<ResizeObserverEntry>) => {
      calls.push(entries);
    },
  };
};

describe('useResizeEffect', () => {
  test('one observer for all the elements, with the content box by default', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ refs: [refOf(first), refOf(second)], onResize }));

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([first, second]);
    expect(observerAt(0).options).toEqual([{ box: 'content-box' }, { box: 'content-box' }]);
  });

  test('box border-box observes every element with that box', () => {
    const element = document.createElement('div');
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ refs: [refOf(element)], onResize, box: 'border-box' }));

    expect(observerAt(0).options).toEqual([{ box: 'border-box' }]);
  });

  test('one call gives the entries of the elements that resized', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const third = document.createElement('div');
    const { calls, onResize } = recorder();
    renderHook(() => {
      useResizeEffect({ refs: [refOf(first), refOf(second), refOf(third)], onResize });
    });
    const one = entryOf({ width: 10, height: 10, target: first });
    const two = entryOf({ width: 20, height: 20, target: third });

    fire({ observer: observerAt(0), entries: [one] });
    fire({ observer: observerAt(0), entries: [two] });
    expect(calls).toHaveLength(0);
    flushFrames();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([one, two]);
  });

  test('several resizes of one element inside a frame give one call with the latest entry', () => {
    const element = document.createElement('div');
    const { calls, onResize } = recorder();
    renderHook(() => useResizeEffect({ refs: [refOf(element)], onResize }));
    const latest = entryOf({ width: 100, height: 50, target: element });

    fire({
      observer: observerAt(0),
      entries: [entryOf({ width: 10, height: 10, target: element })],
    });
    fire({ observer: observerAt(0), entries: [latest] });
    expect(frames.size).toBe(1);
    flushFrames();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([latest]);
  });

  test('an entry delivered when observing starts is passed on like any other', () => {
    const element = document.createElement('div');
    const { calls, onResize } = recorder();
    renderHook(() => useResizeEffect({ refs: [refOf(element)], onResize }));
    const first = entryOf({ width: 30, height: 20, target: element });

    fire({ observer: observerAt(0), entries: [first] });
    flushFrames();

    expect(calls).toEqual([[first]]);
  });

  test('a frame after a frame gives a second call with only the new entries', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { calls, onResize } = recorder();
    renderHook(() => useResizeEffect({ refs: [refOf(first), refOf(second)], onResize }));
    const early = entryOf({ width: 10, height: 10, target: first });
    const late = entryOf({ width: 20, height: 20, target: second });

    fire({ observer: observerAt(0), entries: [early] });
    flushFrames();
    fire({ observer: observerAt(0), entries: [late] });
    flushFrames();

    expect(calls).toEqual([[early], [late]]);
  });

  test('the latest onResize is called, and a new one does not observe again', () => {
    const element = document.createElement('div');
    const refs = [refOf(element)];
    const old = recorder();
    const next = recorder();
    const { rerender } = renderHook(
      (props: { onResize: (entries: Array<ResizeObserverEntry>) => void }) => {
        useResizeEffect({ refs, onResize: props.onResize });
      },
      { initialProps: { onResize: old.onResize } },
    );

    rerender({ onResize: next.onResize });
    fire({ observer: observerAt(0), entries: [entryOf({ width: 5, height: 5, target: element })] });
    flushFrames();

    expect(observers).toHaveLength(1);
    expect(old.calls).toHaveLength(0);
    expect(next.calls).toHaveLength(1);
  });

  test('a new box observes again with that box', () => {
    const refs = [refOf(document.createElement('div'))];
    const { onResize } = recorder();
    const { rerender } = renderHook(
      (props: { box: 'content-box' | 'border-box' }) => {
        useResizeEffect({ refs, onResize, box: props.box });
      },
      { initialProps: { box: 'content-box' } },
    );

    rerender({ box: 'border-box' });

    expect(observers).toHaveLength(2);
    expect(observerAt(0).disconnected).toBe(true);
    expect(observerAt(1).options).toEqual([{ box: 'border-box' }]);
  });

  test('a new list of refs disconnects the old observer and observes the new set only', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const third = document.createElement('div');
    const { onResize } = recorder();
    const { rerender } = renderHook(
      (props: { refs: Array<{ current: Element | null }> }) => {
        useResizeEffect({ refs: props.refs, onResize });
      },
      { initialProps: { refs: [refOf(first), refOf(second)] } },
    );

    rerender({ refs: [refOf(third)] });

    expect(observerAt(0).disconnected).toBe(true);
    expect(observers).toHaveLength(2);
    expect(observerAt(1).targets).toEqual([third]);
  });

  test('a list made anew in every render observes again in every render, so pass a stable one', () => {
    const element = document.createElement('div');
    const { onResize } = recorder();
    const { rerender } = renderHook(() => {
      useResizeEffect({ refs: [refOf(element)], onResize });
    });

    rerender();
    rerender();

    expect(observers).toHaveLength(3);
  });

  test('a ref with no element is skipped, and no element at all observes nothing', () => {
    const element = document.createElement('div');
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ refs: [refOf(null), refOf(element)], onResize }));
    expect(observerAt(0).targets).toEqual([element]);

    renderHook(() => useResizeEffect({ refs: [refOf(null)], onResize }));
    renderHook(() => useResizeEffect({ refs: [], onResize }));
    expect(observers).toHaveLength(1);
  });

  test('unmount disconnects and cancels a pending frame, so a late resize calls nothing', () => {
    const element = document.createElement('div');
    const { calls, onResize } = recorder();
    const { unmount } = renderHook(() => useResizeEffect({ refs: [refOf(element)], onResize }));
    fire({ observer: observerAt(0), entries: [entryOf({ width: 5, height: 5, target: element })] });
    const pending = [...frames.keys()];

    unmount();

    expect(observerAt(0).disconnected).toBe(true);
    expect(cancelled).toEqual(pending);
    expect(frames.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  test('a host with no ResizeObserver observes nothing, does not throw and calls nothing', () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
    const { calls, onResize } = recorder();

    const { unmount } = renderHook(() => {
      useResizeEffect({ refs: [refOf(document.createElement('div'))], onResize });
    });
    unmount();

    expect(observers).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});

describe('useResizeEffect with children', () => {
  const waitForMutations = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const treeOf = () => {
    const parent = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    const grandchild = document.createElement('div');
    first.append(grandchild);
    parent.append(first, second);

    return { parent, first, second, grandchild };
  };

  test('observes each ref and its direct children, and not deeper', () => {
    const { parent, first, second } = treeOf();
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ refs: [refOf(parent)], onResize, children: true }));

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([parent, first, second]);
  });

  test('without children only the refs are observed', () => {
    const { parent } = treeOf();
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ refs: [refOf(parent)], onResize }));

    expect(observerAt(0).targets).toEqual([parent]);
  });

  test('a resize of a child calls onResize with the entry of that child', () => {
    const { parent, second } = treeOf();
    const { calls, onResize } = recorder();
    renderHook(() => useResizeEffect({ refs: [refOf(parent)], onResize, children: true }));
    const entry = entryOf({ width: 8, height: 8, target: second });

    fire({ observer: observerAt(0), entries: [entry] });
    flushFrames();

    expect(calls).toEqual([[entry]]);
  });

  test('a child added or removed is observed or unobserved, and the others are not observed again', async () => {
    const { parent, first, second } = treeOf();
    const added = document.createElement('div');
    const { onResize } = recorder();
    renderHook(() => useResizeEffect({ refs: [refOf(parent)], onResize, children: true }));

    parent.append(added);
    parent.removeChild(first);
    await waitForMutations();

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([parent, first, second, added]);
    expect(observerAt(0).unobserved).toEqual([first]);
  });

  test('a resize of a removed child that is still pending is dropped', async () => {
    const { parent, first } = treeOf();
    const { calls, onResize } = recorder();
    renderHook(() => useResizeEffect({ refs: [refOf(parent)], onResize, children: true }));
    fire({ observer: observerAt(0), entries: [entryOf({ width: 1, height: 1, target: first })] });

    parent.removeChild(first);
    await waitForMutations();
    flushFrames();

    expect(calls).toHaveLength(0);
  });

  test('a MutationObserver exists only with children, and unmount disconnects it', () => {
    const created: Array<{ disconnected: boolean }> = [];
    const RealMutationObserver = globalThis.MutationObserver;
    globalThis.MutationObserver = class extends RealMutationObserver {
      private readonly record = { disconnected: false };

      constructor(callback: MutationCallback) {
        super(callback);
        created.push(this.record);
      }

      override disconnect(): void {
        this.record.disconnected = true;
        super.disconnect();
      }
    };
    const { parent } = treeOf();
    const { onResize } = recorder();

    try {
      renderHook(() => useResizeEffect({ refs: [refOf(parent)], onResize }));
      expect(created).toHaveLength(0);

      const { unmount } = renderHook(() => {
        useResizeEffect({ refs: [refOf(parent)], onResize, children: true });
      });
      expect(created).toHaveLength(1);

      unmount();
      expect(created[0]?.disconnected).toBe(true);
    } finally {
      globalThis.MutationObserver = RealMutationObserver;
    }
  });
});
