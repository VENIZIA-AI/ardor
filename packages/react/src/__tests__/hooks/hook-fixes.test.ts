import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { Logger } from '@venizia/ardor-kernel';
import { act, renderHook } from '@testing-library/react';
import { useAutosave } from '@/hooks/use-autosave';
import { useConfirm } from '@/hooks/use-confirm';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useSizer } from '@/hooks/use-sizer';
import { useWindowDimensions } from '@/hooks/use-window-dimensions';

describe('useSizer', () => {
  const original = globalThis.ResizeObserver;
  let notify: (() => void) | undefined;

  afterEach(() => {
    globalThis.ResizeObserver = original;
    notify = undefined;
  });

  test('reports the offset size of the container, with no extra pixel', () => {
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;

    const container = document.createElement('div');
    container.id = 'sizer-fixes';
    // A scrollbar or a border makes clientWidth differ from offsetWidth: only offset is read.
    for (const [key, value] of Object.entries({
      offsetWidth: 300,
      offsetHeight: 200,
      clientWidth: 285,
      clientHeight: 185,
    })) {
      Object.defineProperty(container, key, { value, configurable: true });
    }
    document.body.appendChild(container);

    const { result, unmount } = renderHook(() => useSizer({ containerId: 'sizer-fixes' }));
    act(() => notify?.());
    expect(result.current).toEqual({ width: 300, height: 200 });

    Object.defineProperty(container, 'offsetWidth', { value: 320, configurable: true });
    act(() => notify?.());
    expect(result.current).toEqual({ width: 320, height: 200 });

    unmount();
    document.body.removeChild(container);
  });
});

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
    expect(await first).toBe(false);

    act(() => result.current.handleConfirm());
    expect(await second).toBe(true);
    expect(result.current.message).toBeUndefined();
  });
});

describe('hooks log through the application logger', () => {
  test('useAutosave reports a failed save to the logger, not to console', async () => {
    const logger = Logger.getInstance({ scope: 'useAutosave' });
    const loggerSpy = spyOn(logger, 'error').mockImplementation(() => {});
    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      const onSave = () => Promise.reject(new Error('save failed'));
      const { rerender, unmount } = renderHook(
        ({ data }) => useAutosave({ data, onSave, interval: 5 }),
        { initialProps: { data: 'a' } },
      );
      rerender({ data: 'b' });
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(loggerSpy).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      unmount();
    } finally {
      loggerSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  test('useCopyToClipboard reports a failure to the logger, not to console', async () => {
    const logger = Logger.getInstance({ scope: 'useCopyToClipboard' });
    const loggerSpy = spyOn(logger, 'warn').mockImplementation(() => {});
    const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const original = navigator.clipboard;

    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denied')) },
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard());
      let copied = true;
      await act(async () => {
        copied = await result.current.copy({ value: 'x' });
      });

      expect(copied).toBe(false);
      expect(loggerSpy).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: original,
        configurable: true,
        writable: true,
      });
      loggerSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });
});
