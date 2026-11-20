import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';

import { FakeMatchMedia } from '@venizia/ardor-kernel/testing';
import { DefaultBreakpoints, useBreakpoint } from '@/hooks/use-breakpoint';

let restoreMatchMedia: (() => void) | undefined;

beforeEach(() => {
  restoreMatchMedia = FakeMatchMedia.install();
});

afterEach(() => {
  restoreMatchMedia?.();
});

/** What a viewport of `width` CSS pixels makes every `(min-width: Npx)` query answer, as a browser does. */
const setViewport = (opts: { width: number; widths: Array<number> }) => {
  for (const width of opts.widths) {
    FakeMatchMedia.set({ query: `(min-width: ${width}px)`, matches: opts.width >= width });
  }
};

const tailwind = Object.values(DefaultBreakpoints);

const viewport = (width: number) => setViewport({ width, widths: tailwind });

describe('useBreakpoint with the default table', () => {
  test('is null below the smallest breakpoint', () => {
    viewport(639);

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.name).toBeNull();
    expect(result.current.isBelow('sm')).toBe(true);
    expect(result.current.isAtLeast('sm')).toBe(false);
  });

  test.each([
    [639, null],
    [640, 'sm'],
    [767, 'sm'],
    [768, 'md'],
    [1023, 'md'],
    [1024, 'lg'],
    [1279, 'lg'],
    [1280, 'xl'],
    [1535, 'xl'],
    [1536, '2xl'],
    [4000, '2xl'],
  ])('a viewport of %p pixels is %p', (width, expected) => {
    viewport(width);

    const { result } = renderHook(() => useBreakpoint());

    expect(String(result.current.name)).toBe(String(expected));
  });

  test('isAtLeast and isBelow answer every name', () => {
    viewport(1100);

    const { result } = renderHook(() => useBreakpoint());
    const { isAtLeast, isBelow } = result.current;

    expect([isAtLeast('sm'), isAtLeast('md'), isAtLeast('lg')]).toEqual([true, true, true]);
    expect(isAtLeast('xl')).toBe(false);
    expect(isAtLeast('2xl')).toBe(false);
    expect(isBelow('lg')).toBe(false);
    expect(isBelow('xl')).toBe(true);
    expect(isBelow('2xl')).toBe(true);
  });

  test('zoom moves the name: a zoomed-in page has a narrower CSS viewport', () => {
    viewport(1280);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.name).toBe('xl');

    // 200% zoom halves the CSS width of a 1280 px window, and the media queries follow.
    act(() => viewport(640));
    expect(result.current.name).toBe('sm');

    act(() => viewport(320));
    expect(result.current.name).toBeNull();

    act(() => viewport(1600));
    expect(result.current.name).toBe('2xl');
  });

  test('re-renders only when the name changes', () => {
    viewport(700);
    let renders = 0;

    renderHook(() => {
      renders += 1;

      return useBreakpoint();
    });
    const first = renders;

    act(() => viewport(701));
    act(() => viewport(760));
    expect(renders).toBe(first);

    act(() => viewport(768));
    expect(renders).toBe(first + 1);
  });

  test('keeps the same helpers while the name does not change', () => {
    viewport(700);
    const { result, rerender } = renderHook(() => useBreakpoint());
    const before = result.current;

    rerender();

    expect(result.current).toBe(before);
  });

  test('stops listening to every boundary on unmount', () => {
    viewport(700);
    const removed = tailwind.map((width) => {
      return spyOn(FakeMatchMedia.of(`(min-width: ${width}px)`), 'removeEventListener');
    });

    const { unmount } = renderHook(() => useBreakpoint());
    unmount();

    for (const spy of removed) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toBe('change');
    }
  });

  test('a server render gives null and does not touch matchMedia', () => {
    const Probe = () => React.createElement('p', null, String(useBreakpoint().name));

    expect(renderToString(React.createElement(Probe))).toContain('null');
    expect(FakeMatchMedia.queries.size).toBe(0);
  });
});

describe('useBreakpoint with a table of the app', () => {
  const widths = [600, 1200];

  test('names the breakpoints of the table, ordered by width and not by key', () => {
    setViewport({ width: 900, widths });

    const { result } = renderHook(() =>
      useBreakpoint({ breakpoints: { wide: 1200, compact: 600 } }),
    );

    expect(result.current.name).toBe('compact');
    expect(result.current.isAtLeast('compact')).toBe(true);
    expect(result.current.isAtLeast('wide')).toBe(false);
    expect(result.current.isBelow('wide')).toBe(true);
  });

  test('an inline table, new on every render, is not subscribed again', () => {
    setViewport({ width: 900, widths });
    let renders = 0;

    const { rerender } = renderHook(() => {
      renders += 1;

      return useBreakpoint({ breakpoints: { compact: 600, wide: 1200 } });
    });
    const listeners = FakeMatchMedia.of('(min-width: 600px)').listenerCount;

    rerender();
    rerender();

    expect(renders).toBeGreaterThan(1);
    expect(FakeMatchMedia.of('(min-width: 600px)').listenerCount).toBe(listeners);
  });

  test('follows a table that changes', () => {
    setViewport({ width: 900, widths: [600, 800, 1200] });

    const initialTable: Record<string, number> = { compact: 600, wide: 1200 };
    const { result, rerender } = renderHook(
      (props: { table: Record<string, number> }) => useBreakpoint({ breakpoints: props.table }),
      { initialProps: { table: initialTable } },
    );
    expect(result.current.name).toBe('compact');

    expect(FakeMatchMedia.of('(min-width: 1200px)').listenerCount).toBe(1);

    rerender({ table: { compact: 600, medium: 800 } });
    expect(result.current.name).toBe('medium');
    expect(FakeMatchMedia.of('(min-width: 1200px)').listenerCount).toBe(0);
    expect(FakeMatchMedia.of('(min-width: 800px)').listenerCount).toBe(1);
  });

  test('an empty options object or an undefined table gives the default table', () => {
    viewport(800);

    const empty = renderHook(() => useBreakpoint({}));
    const unset = renderHook(() => useBreakpoint({ breakpoints: undefined }));

    expect(empty.result.current.name).toBe('md');
    expect(unset.result.current.name).toBe('md');
  });

  test('a name that is not in the table does not compile', () => {
    setViewport({ width: 900, widths });

    const { result } = renderHook(() => useBreakpoint({ breakpoints: { compact: 600 } }));
    // @ts-expect-error - 'xxl' is not a breakpoint of this table
    result.current.isAtLeast('xxl');

    const defaults = renderHook(() => useBreakpoint());
    // @ts-expect-error - 'xxl' is not a breakpoint of the default table
    defaults.result.current.isAtLeast('xxl');

    expect(true).toBe(true);
  });
});
