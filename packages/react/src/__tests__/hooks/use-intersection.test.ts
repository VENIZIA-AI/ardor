import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';

import { FakeIntersectionObserver } from '@venizia/ardor-kernel/testing';
import { useIntersection } from '@/hooks/use-intersection';

let restore: (() => void) | undefined;

beforeEach(() => {
  restore = FakeIntersectionObserver.install();
});

afterEach(() => {
  cleanup();
  restore?.();
});

const observerAt = (index: number): FakeIntersectionObserver => {
  const observer = FakeIntersectionObserver.all[index];

  if (!observer) {
    throw new Error(`No IntersectionObserver was created at ${index}`);
  }

  return observer;
};

const intersectionEntryOf = (opts: {
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

const refOf = (element: Element | null) => ({ current: element });

const deliver = (entry: IntersectionObserverEntry, index = 0) => {
  act(() => {
    observerAt(index).callback([entry], observerAt(index));
  });
};

describe('useIntersection', () => {
  test('is undefined before the first entry, and observes the element with the options', () => {
    const element = document.createElement('div');

    const { result } = renderHook(() => {
      return useIntersection({ target: element, rootMargin: '10px', threshold: 0.5 });
    });

    expect(result.current).toBeUndefined();
    expect(FakeIntersectionObserver.all).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([element]);
    expect(observerAt(0).options).toEqual({ rootMargin: '10px', threshold: 0.5 });
  });

  test('gives the entry of the first observation and of each change', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => useIntersection({ target: element }));
    const first = intersectionEntryOf({ target: element, isIntersecting: false, ratio: 0 });
    const second = intersectionEntryOf({ target: element, isIntersecting: true, ratio: 0.6 });

    deliver(first);
    expect(result.current).toBe(first);

    deliver(second);
    expect(result.current).toBe(second);
    expect(result.current?.isIntersecting).toBe(true);
  });

  test('the last entry of one delivery is the one kept', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => useIntersection({ target: element }));
    const early = intersectionEntryOf({ target: element, isIntersecting: false, ratio: 0 });
    const late = intersectionEntryOf({ target: element, isIntersecting: true, ratio: 1 });

    act(() => {
      observerAt(0).callback([early, late], observerAt(0));
    });

    expect(result.current).toBe(late);
  });

  test('an entry with the same visibility and ratio renders nothing', () => {
    const element = document.createElement('div');
    let renders = 0;
    renderHook(() => {
      renders += 1;

      return useIntersection({ target: element });
    });
    deliver(intersectionEntryOf({ target: element, isIntersecting: true, ratio: 0.5 }));
    const before = renders;

    deliver(intersectionEntryOf({ target: element, isIntersecting: true, ratio: 0.5 }));

    expect(renders).toBe(before);
  });

  test('a changed rootMargin or threshold observes again and forgets the entry', () => {
    const element = document.createElement('div');
    const { result, rerender } = renderHook(
      (props: { rootMargin: string; threshold: number }) =>
        useIntersection({ target: element, ...props }),
      { initialProps: { rootMargin: '0px', threshold: 0 } },
    );
    deliver(intersectionEntryOf({ target: element, isIntersecting: true, ratio: 1 }));

    rerender({ rootMargin: '20px', threshold: 0 });
    expect(FakeIntersectionObserver.all).toHaveLength(2);
    expect(observerAt(0).isDisconnected).toBe(true);
    expect(observerAt(1).options).toEqual({ rootMargin: '20px', threshold: 0 });
    expect(result.current).toBeUndefined();

    rerender({ rootMargin: '20px', threshold: 0.5 });
    expect(FakeIntersectionObserver.all).toHaveLength(3);
    expect(observerAt(1).isDisconnected).toBe(true);
  });

  test('an element held in state, set after the mount, is observed', () => {
    const element = document.createElement('div');
    const { rerender } = renderHook<unknown, { element: Element | null }>(
      (props) => useIntersection({ target: props.element }),
      { initialProps: { element: null } },
    );
    expect(FakeIntersectionObserver.all).toHaveLength(0);

    rerender({ element });

    expect(FakeIntersectionObserver.all).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([element]);
  });

  test('a ref whose element changes is followed at the next render, from an empty entry', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = refOf(first);
    const { result, rerender } = renderHook(() => useIntersection({ target: ref }));
    deliver(intersectionEntryOf({ target: first, isIntersecting: true, ratio: 1 }));

    ref.current = second;
    rerender();

    expect(observerAt(0).isDisconnected).toBe(true);
    expect(observerAt(1).targets).toEqual([second]);
    expect(result.current).toBeUndefined();
  });

  test('a target that goes away stops the observation and forgets the entry', () => {
    const element = document.createElement('div');
    const { result, rerender } = renderHook<unknown, { element: Element | null }>(
      (props) => useIntersection({ target: props.element }),
      { initialProps: { element } },
    );
    deliver(intersectionEntryOf({ target: element, isIntersecting: true, ratio: 1 }));

    rerender({ element: null });

    expect(observerAt(0).isDisconnected).toBe(true);
    expect(result.current).toBeUndefined();
  });

  test('a render with the same element observes nothing again', () => {
    const element = document.createElement('div');
    const { rerender } = renderHook(() => useIntersection({ target: refOf(element) }));

    rerender();
    rerender();

    expect(FakeIntersectionObserver.all).toHaveLength(1);
  });

  test('unmount disconnects', () => {
    const element = document.createElement('div');
    const { unmount } = renderHook(() => useIntersection({ target: element }));

    unmount();

    expect(observerAt(0).isDisconnected).toBe(true);
  });

  test('a host with no IntersectionObserver gives undefined and does not throw', () => {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
    const element = document.createElement('div');

    const { result } = renderHook(() => useIntersection({ target: element }));

    expect(result.current).toBeUndefined();
    expect(FakeIntersectionObserver.all).toHaveLength(0);
  });
});

describe('useIntersection with several targets', () => {
  const flush = (element: Element, isIntersecting: boolean, ratio?: number) => {
    act(() => {
      FakeIntersectionObserver.flush({ element, isIntersecting, ratio });
    });
  };

  test('one observer watches every element, and a list gives one slot per target, undefined until reported', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    const c = document.createElement('section');
    const { result } = renderHook(() => useIntersection({ target: [a, b, c] }));

    expect(FakeIntersectionObserver.all).toHaveLength(1);
    expect(observerAt(0).targets).toEqual([a, b, c]);
    expect(result.current).toEqual([undefined, undefined, undefined]);

    flush(b, true, 0.4);

    expect(result.current).toHaveLength(3);
    expect(result.current[0]).toBeUndefined();
    expect(result.current[1]?.target).toBe(b);
    expect(result.current[1]?.intersectionRatio).toBe(0.4);
    expect(result.current[2]).toBeUndefined();
  });

  test('settle reports each target once, and the array keeps the target order, not the report order', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    const { result } = renderHook(() => useIntersection({ target: [b, a] }));

    act(() => {
      FakeIntersectionObserver.settle({ isIntersecting: true });
    });

    expect(result.current.map((entry) => entry?.target)).toEqual([b, a]);
    expect(result.current.every((entry) => entry?.isIntersecting)).toBe(true);
  });

  test('a delivery with several targets updates every slot, and an unchanged one renders nothing', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;

      return useIntersection({ target: [a, b] });
    });

    act(() => {
      observerAt(0).callback(
        [
          intersectionEntryOf({ target: a, isIntersecting: true, ratio: 1 }),
          intersectionEntryOf({ target: b, isIntersecting: false, ratio: 0 }),
        ],
        observerAt(0),
      );
    });
    expect(result.current.map((entry) => entry?.isIntersecting)).toEqual([true, false]);
    const afterFirst = renders;

    deliver(intersectionEntryOf({ target: a, isIntersecting: true, ratio: 1 }));

    expect(renders).toBe(afterFirst);
  });

  test('a target with no element yet is undefined and not observed, and a single target still gives one entry', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => useIntersection({ target: [null, element, refOf(null)] }));
    const single = renderHook(() => useIntersection({ target: element }));

    expect(observerAt(0).targets).toEqual([element]);
    flush(element, true);

    expect(result.current).toHaveLength(3);
    expect(result.current[0]).toBeUndefined();
    expect(result.current[1]?.isIntersecting).toBe(true);
    expect(result.current[2]).toBeUndefined();
    expect(Array.isArray(single.result.current)).toBe(false);
    expect(single.result.current?.target).toBe(element);
  });

  test('the same element twice fills both slots', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => useIntersection({ target: [element, element] }));

    flush(element, true);

    expect(result.current[0]).toBeDefined();
    expect(result.current[1]).toBe(result.current[0]);
  });

  test('a list made anew each render observes nothing again, a changed list observes again from empty', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    const c = document.createElement('section');
    const { result, rerender } = renderHook(
      (props: { elements: Element[] }) => useIntersection({ target: [...props.elements] }),
      { initialProps: { elements: [a, b] } },
    );
    flush(a, true);
    const before = result.current;

    rerender({ elements: [a, b] });
    rerender({ elements: [a, b] });
    expect(FakeIntersectionObserver.all).toHaveLength(1);
    expect(result.current).toBe(before);

    rerender({ elements: [a, b, c] });
    expect(FakeIntersectionObserver.all).toHaveLength(2);
    expect(observerAt(0).isDisconnected).toBe(true);
    expect(observerAt(1).targets).toEqual([a, b, c]);
    expect(result.current).toEqual([undefined, undefined, undefined]);
  });

  test('a list of the same length with another element, or in another order, observes again', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    const c = document.createElement('section');
    const { result, rerender } = renderHook(
      (props: { elements: Element[] }) => useIntersection({ target: props.elements }),
      { initialProps: { elements: [a, b] } },
    );
    flush(a, true);

    rerender({ elements: [a, c] });
    expect(FakeIntersectionObserver.all).toHaveLength(2);
    expect(observerAt(1).targets).toEqual([a, c]);
    expect(result.current).toEqual([undefined, undefined]);

    rerender({ elements: [c, a] });
    expect(FakeIntersectionObserver.all).toHaveLength(3);
  });

  test('the array result keeps its identity while nothing changed', () => {
    const a = document.createElement('section');
    const b = document.createElement('section');
    const { result, rerender } = renderHook(() => useIntersection({ target: [a, b] }));
    flush(a, true);
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  test('an empty list observes nothing and gives an empty array', () => {
    const { result } = renderHook(() => useIntersection({ target: [] }));

    expect(result.current).toEqual([]);
    expect(FakeIntersectionObserver.all).toHaveLength(0);
  });
});

describe('useIntersection root and threshold list', () => {
  test('a threshold list is passed to the observer, and the same values in a new list observe nothing again', () => {
    const element = document.createElement('div');
    const { rerender } = renderHook(
      (props: { threshold: number[] }) => useIntersection({ target: element, ...props }),
      { initialProps: { threshold: [0, 0.5, 1] } },
    );

    expect(observerAt(0).options).toEqual({ rootMargin: undefined, threshold: [0, 0.5, 1] });

    rerender({ threshold: [0, 0.5, 1] });
    expect(FakeIntersectionObserver.all).toHaveLength(1);

    rerender({ threshold: [0, 0.25, 1] });
    expect(FakeIntersectionObserver.all).toHaveLength(2);
    expect(observerAt(1).options?.threshold).toEqual([0, 0.25, 1]);
    expect(observerAt(0).isDisconnected).toBe(true);
  });

  test('a threshold given as a number is still a number', () => {
    const element = document.createElement('div');
    renderHook(() => useIntersection({ target: element, threshold: 0.25 }));

    expect(observerAt(0).options?.threshold).toBe(0.25);
  });

  test('a root element or a ref to one is the root of the observer, and none or null is the viewport', () => {
    const container = document.createElement('div');
    const element = document.createElement('div');

    renderHook(() => useIntersection({ target: element, root: container }));
    renderHook(() => useIntersection({ target: element, root: refOf(container) }));
    renderHook(() => useIntersection({ target: element, root: null }));
    renderHook(() => useIntersection({ target: element }));

    expect(observerAt(0).options?.root).toBe(container);
    expect(observerAt(1).options?.root).toBe(container);
    expect(observerAt(2).options?.root).toBeUndefined();
    expect(observerAt(3).options?.root).toBeUndefined();
  });

  test('a root ref with no element yet observes nothing until it has one, then observes against it', () => {
    const container = document.createElement('div');
    const element = document.createElement('div');
    const root = refOf(null);
    const { rerender } = renderHook(() => useIntersection({ target: element, root }));

    expect(FakeIntersectionObserver.all).toHaveLength(0);

    root.current = container;
    rerender();

    expect(FakeIntersectionObserver.all).toHaveLength(1);
    expect(observerAt(0).options?.root).toBe(container);
  });

  test('a new root observes again and forgets the entries', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const element = document.createElement('div');
    const { result, rerender } = renderHook(
      (props: { root: Element }) => useIntersection({ target: element, root: props.root }),
      { initialProps: { root: first } },
    );
    deliver(intersectionEntryOf({ target: element, isIntersecting: true, ratio: 1 }));
    expect(result.current).toBeDefined();

    rerender({ root: second });

    expect(observerAt(0).isDisconnected).toBe(true);
    expect(observerAt(1).options?.root).toBe(second);
    expect(result.current).toBeUndefined();
  });
});
