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

    renderHook(() => useResizeEffect({ targets: [refOf(first), refOf(second)], onResize }));

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([first, second]);
    expect(observerAt(0).options).toEqual([{ box: 'content-box' }, { box: 'content-box' }]);
  });

  test('box border-box observes every element with that box', () => {
    const element = document.createElement('div');
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ targets: [refOf(element)], onResize, box: 'border-box' }));

    expect(observerAt(0).options).toEqual([{ box: 'border-box' }]);
  });

  test('one call gives the entries of the elements that resized', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const third = document.createElement('div');
    const { calls, onResize } = recorder();
    renderHook(() => {
      useResizeEffect({ targets: [refOf(first), refOf(second), refOf(third)], onResize });
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
    renderHook(() => useResizeEffect({ targets: [refOf(element)], onResize }));
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
    renderHook(() => useResizeEffect({ targets: [refOf(element)], onResize }));
    const first = entryOf({ width: 30, height: 20, target: element });

    fire({ observer: observerAt(0), entries: [first] });
    flushFrames();

    expect(calls).toEqual([[first]]);
  });

  test('a frame after a frame gives a second call with only the new entries', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { calls, onResize } = recorder();
    renderHook(() => useResizeEffect({ targets: [refOf(first), refOf(second)], onResize }));
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
    const targets = [refOf(element)];
    const old = recorder();
    const next = recorder();
    const { rerender } = renderHook(
      (props: { onResize: (entries: Array<ResizeObserverEntry>) => void }) => {
        useResizeEffect({ targets, onResize: props.onResize });
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
    const targets = [refOf(document.createElement('div'))];
    const { onResize } = recorder();
    const { rerender } = renderHook(
      (props: { box: 'content-box' | 'border-box' }) => {
        useResizeEffect({ targets, onResize, box: props.box });
      },
      { initialProps: { box: 'content-box' } },
    );

    rerender({ box: 'border-box' });

    expect(observers).toHaveLength(2);
    expect(observerAt(0).disconnected).toBe(true);
    expect(observerAt(1).options).toEqual([{ box: 'border-box' }]);
  });

  test('a new list of targets observes the new ones and stops observing the old ones, on the same observer', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const third = document.createElement('div');
    const { onResize } = recorder();
    const { rerender } = renderHook(
      (props: { targets: Array<{ current: Element | null }> }) => {
        useResizeEffect({ targets: props.targets, onResize });
      },
      { initialProps: { targets: [refOf(first), refOf(second)] } },
    );

    rerender({ targets: [refOf(second), refOf(third)] });

    expect(observers).toHaveLength(1);
    expect(observerAt(0).disconnected).toBe(false);
    expect(observerAt(0).targets).toEqual([first, second, third]);
    expect(observerAt(0).unobserved).toEqual([first]);
  });

  test('a list made anew in every render observes each element once', () => {
    const element = document.createElement('div');
    const { onResize } = recorder();
    const { rerender } = renderHook(() => {
      useResizeEffect({ targets: [refOf(element)], onResize });
    });

    rerender();
    rerender();

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([element]);
    expect(observerAt(0).unobserved).toEqual([]);
  });

  test('an element held in state, set after the mount, is observed', () => {
    const element = document.createElement('div');
    const { onResize } = recorder();
    const { rerender } = renderHook<void, { element: Element | null }>(
      (props) => {
        useResizeEffect({ targets: [props.element], onResize });
      },
      { initialProps: { element: null } },
    );
    expect(observerAt(0).targets).toEqual([]);

    rerender({ element });

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([element]);
  });

  test('a target added and then removed is observed and then not', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { onResize } = recorder();
    const { rerender } = renderHook(
      (props: { list: Array<Element> }) => {
        useResizeEffect({ targets: props.list, onResize });
      },
      { initialProps: { list: [first] } },
    );

    rerender({ list: [first, second] });
    rerender({ list: [second] });

    expect(observerAt(0).targets).toEqual([first, second]);
    expect(observerAt(0).unobserved).toEqual([first]);
  });

  test('a ref whose element changes is followed at the next render', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = refOf(first);
    const { onResize } = recorder();
    const { rerender } = renderHook(() => useResizeEffect({ targets: [ref], onResize }));

    ref.current = second;
    rerender();

    expect(observerAt(0).targets).toEqual([first, second]);
    expect(observerAt(0).unobserved).toEqual([first]);
  });

  test('the same elements in another order, or twice, observe and unobserve nothing again', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { onResize } = recorder();
    const { rerender } = renderHook(
      (props: { list: Array<Element> }) => {
        useResizeEffect({ targets: props.list, onResize });
      },
      { initialProps: { list: [first, second, first] } },
    );
    expect(observerAt(0).targets).toEqual([first, second]);

    rerender({ list: [second, first] });
    rerender({ list: [second, first, second] });

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([first, second]);
    expect(observerAt(0).unobserved).toEqual([]);
  });

  test('a pending resize of a target that was removed is dropped', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const { calls, onResize } = recorder();
    const { rerender } = renderHook(
      (props: { list: Array<Element> }) => {
        useResizeEffect({ targets: props.list, onResize });
      },
      { initialProps: { list: [first, second] } },
    );
    fire({ observer: observerAt(0), entries: [entryOf({ width: 1, height: 1, target: first })] });

    rerender({ list: [second] });
    flushFrames();

    expect(calls).toHaveLength(0);
  });

  test('a null target, and an empty list, observe nothing and do not throw', () => {
    const element = document.createElement('div');
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ targets: [null, refOf(null), refOf(element)], onResize }));
    renderHook(() => useResizeEffect({ targets: [], onResize }));

    expect(observerAt(0).targets).toEqual([element]);
    expect(observerAt(1).targets).toEqual([]);
  });

  test('unmount disconnects and cancels a pending frame, so a late resize calls nothing', () => {
    const element = document.createElement('div');
    const { calls, onResize } = recorder();
    const { unmount } = renderHook(() => useResizeEffect({ targets: [refOf(element)], onResize }));
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
      useResizeEffect({ targets: [refOf(document.createElement('div'))], onResize });
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

  test('observes each target and its direct children, and not deeper', () => {
    const { parent, first, second } = treeOf();
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ targets: [refOf(parent)], onResize, children: true }));

    expect(observers).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([parent, first, second]);
  });

  test('without children only the targets are observed', () => {
    const { parent } = treeOf();
    const { onResize } = recorder();

    renderHook(() => useResizeEffect({ targets: [refOf(parent)], onResize }));

    expect(observerAt(0).targets).toEqual([parent]);
  });

  test('a resize of a child calls onResize with the entry of that child', () => {
    const { parent, second } = treeOf();
    const { calls, onResize } = recorder();
    renderHook(() => useResizeEffect({ targets: [refOf(parent)], onResize, children: true }));
    const entry = entryOf({ width: 8, height: 8, target: second });

    fire({ observer: observerAt(0), entries: [entry] });
    flushFrames();

    expect(calls).toEqual([[entry]]);
  });

  test('a child added or removed is observed or unobserved, and the others are not observed again', async () => {
    const { parent, first, second } = treeOf();
    const added = document.createElement('div');
    const { onResize } = recorder();
    renderHook(() => useResizeEffect({ targets: [refOf(parent)], onResize, children: true }));

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
    renderHook(() => useResizeEffect({ targets: [refOf(parent)], onResize, children: true }));
    fire({ observer: observerAt(0), entries: [entryOf({ width: 1, height: 1, target: first })] });

    parent.removeChild(first);
    await waitForMutations();
    flushFrames();

    expect(calls).toHaveLength(0);
  });

  test('with children, a new target brings its children and the old target and its children are unobserved', () => {
    const old = treeOf();
    const next = treeOf();
    const { onResize } = recorder();
    const { rerender } = renderHook(
      (props: { parent: Element }) => {
        useResizeEffect({ targets: [props.parent], onResize, children: true });
      },
      { initialProps: { parent: old.parent } },
    );

    rerender({ parent: next.parent });

    expect(observerAt(0).targets).toEqual([
      old.parent,
      old.first,
      old.second,
      next.parent,
      next.first,
      next.second,
    ]);
    expect(observerAt(0).unobserved).toEqual([old.parent, old.first, old.second]);
  });

  test('with children, a render with the same targets does no DOM work', () => {
    const { parent } = treeOf();
    const targets = [parent];
    const { onResize } = recorder();
    const reads: Array<number> = [];
    const children = Object.getOwnPropertyDescriptor(Element.prototype, 'children');
    const { rerender } = renderHook(() => {
      useResizeEffect({ targets: [...targets], onResize, children: true });
    });
    const before = observerAt(0).targets.length;

    Object.defineProperty(parent, 'children', {
      get() {
        reads.push(1);

        return children?.get?.call(this);
      },
    });
    rerender();
    rerender();

    expect(reads).toHaveLength(0);
    expect(observerAt(0).targets).toHaveLength(before);
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
      renderHook(() => useResizeEffect({ targets: [refOf(parent)], onResize }));
      expect(created).toHaveLength(0);

      const { unmount } = renderHook(() => {
        useResizeEffect({ targets: [refOf(parent)], onResize, children: true });
      });
      expect(created).toHaveLength(1);

      unmount();
      expect(created[0]?.disconnected).toBe(true);
    } finally {
      globalThis.MutationObserver = RealMutationObserver;
    }
  });
});
