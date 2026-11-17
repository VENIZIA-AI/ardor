import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

describe('useCopyToClipboard isCopied', () => {
  const originalClipboard: Clipboard | undefined = navigator.clipboard;
  const RESET_MS = 1500;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const setClipboard = (writeText: ((text: string) => Promise<void>) | undefined) => {
    Object.defineProperty(navigator, 'clipboard', {
      value: writeText ? { writeText } : undefined,
      configurable: true,
      writable: true,
    });
  };

  const copyOnce = async (copy: () => Promise<boolean>) => {
    await act(async () => {
      await copy();
    });
  };

  beforeEach(() => {
    setClipboard(async () => {});
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  test('isCopied is false at first, true after a copy, and stays true without resetMs', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.isCopied).toBe(false);

    await copyOnce(() => result.current.copy({ value: 'a' }));
    expect(result.current.isCopied).toBe(true);

    await advance(60_000);
    expect(result.current.isCopied).toBe(true);
  });

  test('isCopied goes back to false after resetMs', async () => {
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: RESET_MS }));

    await copyOnce(() => result.current.copy({ value: 'a' }));
    await advance(RESET_MS - 1);
    expect(result.current.isCopied).toBe(true);

    await advance(1);
    expect(result.current.isCopied).toBe(false);
  });

  test('a second copy restarts the timer', async () => {
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: RESET_MS }));

    await copyOnce(() => result.current.copy({ value: 'a' }));
    await advance(RESET_MS - 500);
    await copyOnce(() => result.current.copy({ value: 'b' }));
    await advance(RESET_MS - 500);
    expect(result.current.isCopied).toBe(true);

    await advance(500);
    expect(result.current.isCopied).toBe(false);
  });

  test('a refused copy sets isCopied to false and ends the timer of the copy before', async () => {
    const started = spyOn(globalThis, 'setTimeout');
    const ended = spyOn(globalThis, 'clearTimeout');
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: RESET_MS }));
    await copyOnce(() => result.current.copy({ value: 'a' }));
    const call = started.mock.calls.findIndex(([, delay]) => delay === RESET_MS);
    const timer = started.mock.results[call]?.value;
    expect(call).toBeGreaterThanOrEqual(0);

    setClipboard(undefined);
    await copyOnce(() => result.current.copy({ value: 'b' }));

    expect(result.current.isCopied).toBe(false);
    expect(ended).toHaveBeenLastCalledWith(timer);
  });

  test('a resetMs of 0 or less starts no timer', async () => {
    const started = spyOn(globalThis, 'setTimeout');
    const zero = renderHook(() => useCopyToClipboard({ resetMs: 0 }));
    const negative = renderHook(() => useCopyToClipboard({ resetMs: -5 }));

    await copyOnce(() => zero.result.current.copy({ value: 'a' }));
    await copyOnce(() => negative.result.current.copy({ value: 'a' }));

    expect(started.mock.calls.filter(([, delay]) => delay === 0 || delay === -5)).toEqual([]);
    expect(zero.result.current.isCopied).toBe(true);
    expect(negative.result.current.isCopied).toBe(true);
  });

  test('unmount clears the timer', async () => {
    const before = jest.getTimerCount();
    const { result, unmount } = renderHook(() => useCopyToClipboard({ resetMs: RESET_MS }));
    await copyOnce(() => result.current.copy({ value: 'a' }));
    expect(jest.getTimerCount()).toBe(before + 1);

    unmount();

    expect(jest.getTimerCount()).toBe(before);
  });

  test('a copy that resolves after the unmount still resolves with its result and throws nothing', async () => {
    let finish: () => void = () => {};

    setClipboard(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useCopyToClipboard({ resetMs: RESET_MS }));
    const pending = result.current.copy({ value: 'a' });

    unmount();
    finish();

    const result2 = await pending;
    expect(result2).toBe(true);
  });

  test('copy keeps its identity between renders and after a copy', async () => {
    const { result, rerender } = renderHook(() => useCopyToClipboard({ resetMs: RESET_MS }));
    const before = result.current.copy;

    rerender();
    await copyOnce(() => result.current.copy({ value: 'a' }));

    expect(result.current.copy).toBe(before);
  });
});
