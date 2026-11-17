import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { FakeClipboard } from '@venizia/ardor-kernel/testing';
import { useAutosave } from '@/hooks/use-autosave';
import { useConfirm } from '@/hooks/use-confirm';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useWindowDimensions } from '@/hooks/use-window-dimensions';

describe('useWindowDimensions', () => {
  test('answers 0 x 0 in a render that has no window, then measures the browser', () => {
    const renders: Array<{ width: number; height: number }> = [];

    const { result } = renderHook(() => {
      // Only the render sees no window, the way a server render does.
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
      Reflect.deleteProperty(globalThis, 'window');

      try {
        const dimensions = useWindowDimensions();
        renders.push(dimensions);

        return dimensions;
      } finally {
        if (descriptor) {
          Object.defineProperty(globalThis, 'window', descriptor);
        }
      }
    });

    expect(renders[0]).toEqual({ width: 0, height: 0 });
    expect(result.current).toEqual({ width: window.innerWidth, height: window.innerHeight });
  });
});

describe('useConfirm', () => {
  test('a second confirm resolves the prompt it replaces with false', async () => {
    const { result } = renderHook(() => useConfirm());

    let first: Promise<boolean> | undefined;
    let second: Promise<boolean> | undefined;
    act(() => {
      first = result.current.confirm({ message: 'First?' });
    });
    act(() => {
      second = result.current.confirm({ message: 'Second?' });
    });

    expect(result.current.message).toBe('Second?');
    const result2 = await first;
    expect(result2).toBe(false);

    act(() => result.current.handleConfirm());
    const result3 = await second;
    expect(result3).toBe(true);
    expect(result.current.message).toBeUndefined();
  });
});

describe('hooks log through the application logger', () => {
  // A fake clock, not a sleep: the debounce fires when the test says so, on any runner.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('useAutosave reports a failed save through its scoped logger', async () => {
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      const onSave = () => Promise.reject(new Error('save failed'));
      const { rerender, unmount } = renderHook(
        ({ data }) => useAutosave({ data, onSave, interval: 5 }),
        { initialProps: { data: 'a' } },
      );
      rerender({ data: 'b' });
      await act(async () => {
        jest.advanceTimersByTime(5);
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(String(consoleSpy.mock.calls[0]?.[0])).toContain('[useAutosave]');
      unmount();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  test('useCopyToClipboard reports a failure through its scoped logger', async () => {
    const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const clipboard = new FakeClipboard();
    clipboard.isDenied = true;
    const restore = clipboard.install();

    try {
      const { result } = renderHook(() => useCopyToClipboard());
      let copied = true;
      await act(async () => {
        const result2 = await result.current.copy({ value: 'x' });
        copied = result2;
      });

      expect(copied).toBe(false);
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(String(consoleSpy.mock.calls[0]?.[0])).toContain('[useCopyToClipboard]');
    } finally {
      restore();
      consoleSpy.mockRestore();
    }
  });
});
