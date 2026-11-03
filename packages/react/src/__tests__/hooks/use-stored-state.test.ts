import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';

import { BrowserStorage, type IStorageCodec, StorageAreas } from '@venizia/ardor-kernel';
import { useStoredState } from '@/hooks/use-stored-state';

const KEY = '@app/store/theme';

const storageEvent = (opts: { key: string | null; storageArea: Storage }): Event => {
  return new StorageEvent('storage', opts);
};

class SwitchStorage implements Storage {
  [name: string]: unknown;

  failReads = false;
  failWrites = false;
  private readonly items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new DOMException('Access is denied', 'SecurityError');
    }

    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new DOMException('The quota has been exceeded', 'QuotaExceededError');
    }

    this.items.set(key, value);
  }

  removeItem(key: string): void {
    if (this.failWrites) {
      throw new DOMException('Access is denied', 'SecurityError');
    }

    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
}

const realLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

const replaceLocalStorage = (storage: Storage): void => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
};

const upperCase: IStorageCodec<string> = {
  encode: (value) => value.toUpperCase(),
  decode: (text) => text.toLowerCase(),
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  if (realLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', realLocalStorage);
  }
  localStorage.clear();
  sessionStorage.clear();
});

describe('useStoredState reads', () => {
  test('gives the default value when nothing is stored, and the stored value when there is one', () => {
    const empty = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    expect(empty.result.current.value).toBe('light');

    localStorage.setItem(KEY, JSON.stringify('dark'));
    const stored = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    expect(stored.result.current.value).toBe('dark');
  });

  test('gives the default value for text the codec cannot decode', () => {
    localStorage.setItem(KEY, '{not json');

    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    expect(result.current.value).toBe('light');
  });

  test('gives the default value, and does not crash, when the accessor throws', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const blocked = new SwitchStorage();
    blocked.setItem(KEY, JSON.stringify('dark'));
    blocked.failReads = true;
    replaceLocalStorage(blocked);

    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    expect(result.current.value).toBe('light');
  });

  test('reads the area named by storage, with a custom codec', () => {
    sessionStorage.setItem(KEY, 'DARK');

    const { result } = renderHook(() => {
      return useStoredState({
        key: KEY,
        defaultValue: 'light',
        storage: StorageAreas.SESSION,
        codec: upperCase,
      });
    });

    expect(result.current.value).toBe('dark');
  });

  test('keeps the same object between renders while the stored text is the same', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'dark' }));
    const initial = { mode: 'light' };

    const { result, rerender } = renderHook(() => {
      return useStoredState({ key: KEY, defaultValue: initial });
    });
    const first = result.current.value;
    rerender();

    expect(result.current.value).toBe(first);
  });
});

describe('useStoredState writes', () => {
  test('setValue stores the value and re-renders with it, and accepts an updater', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 1 }));

    act(() => result.current.setValue(5));
    expect(result.current.value).toBe(5);
    expect(localStorage.getItem(KEY)).toBe('5');

    act(() => result.current.setValue((current) => current + 1));
    expect(result.current.value).toBe(6);
  });

  test('remove deletes the key and gives the default value again', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => result.current.remove());

    expect(result.current.value).toBe('light');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test('a write the quota refuses is kept in the hook, so the UI still reacts, and is not stored', () => {
    const quota = new SwitchStorage();
    replaceLocalStorage(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    quota.failWrites = true;

    act(() => result.current.setValue('dark'));
    expect(result.current.value).toBe('dark');
    expect(quota.getItem(KEY)).toBeNull();

    act(() => result.current.setValue((current) => `${current}-2`));
    expect(result.current.value).toBe('dark-2');
  });

  test('a write on a storage that is blocked entirely is kept in the hook and does not throw', () => {
    const blocked = new SwitchStorage();
    blocked.failReads = true;
    blocked.failWrites = true;
    replaceLocalStorage(blocked);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => result.current.setValue('dark'));

    expect(result.current.value).toBe('dark');
  });

  test('a value kept after a refused write gives way to the next change of the storage', () => {
    const quota = new SwitchStorage();
    replaceLocalStorage(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    quota.failWrites = true;
    act(() => result.current.setValue('dark'));

    quota.failWrites = false;
    act(() => {
      quota.setItem(KEY, JSON.stringify('blue'));
      window.dispatchEvent(storageEvent({ key: KEY, storageArea: quota }));
    });

    expect(result.current.value).toBe('blue');
  });

  test('a removal the storage refuses shows the default value in the hook', () => {
    const quota = new SwitchStorage();
    quota.setItem(KEY, JSON.stringify('dark'));
    replaceLocalStorage(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    expect(result.current.value).toBe('dark');
    quota.failWrites = true;

    act(() => result.current.remove());

    expect(result.current.value).toBe('light');
  });
});

describe('useStoredState stays in step', () => {
  test('two hooks on one key in one tab follow each other', () => {
    const first = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    const second = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => first.result.current.setValue('dark'));

    expect(second.result.current.value).toBe('dark');
  });

  test('a write from code outside React reaches the hook', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => {
      BrowserStorage.set({ key: KEY, value: 'dark' });
    });

    expect(result.current.value).toBe('dark');
  });

  test('a storage event from another tab reaches the hook, for its own area and key only', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => {
      localStorage.setItem(KEY, JSON.stringify('dark'));
      window.dispatchEvent(storageEvent({ key: KEY, storageArea: localStorage }));
    });
    expect(result.current.value).toBe('dark');

    act(() => {
      localStorage.setItem(KEY, JSON.stringify('blue'));
      window.dispatchEvent(storageEvent({ key: KEY, storageArea: sessionStorage }));
    });
    expect(result.current.value).toBe('dark');
  });

  test('a clear in another tab gives the default value again', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => {
      localStorage.clear();
      window.dispatchEvent(storageEvent({ key: null, storageArea: localStorage }));
    });

    expect(result.current.value).toBe('light');
  });

  test('follows a change of key, and unsubscribes on unmount', () => {
    localStorage.setItem('@app/store/a', JSON.stringify('from-a'));
    localStorage.setItem('@app/store/b', JSON.stringify('from-b'));
    const { result, rerender, unmount } = renderHook(
      (props: { key: string }) => useStoredState({ key: props.key, defaultValue: '' }),
      { initialProps: { key: '@app/store/a' } },
    );
    expect(result.current.value).toBe('from-a');

    rerender({ key: '@app/store/b' });
    expect(result.current.value).toBe('from-b');

    const removed = spyOn(globalThis, 'removeEventListener');
    unmount();
    expect(removed.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
    removed.mockRestore();
  });
});
