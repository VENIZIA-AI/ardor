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
