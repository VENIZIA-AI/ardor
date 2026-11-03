import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';

import { BrowserStorage, type IStorageCodec, StorageAreas } from '@venizia/ardor-kernel';
import { useStoredState } from '@/hooks/use-stored-state';

const KEY = '@app/store/theme';

const storageEvent = (opts: { key: string | null; storageArea: Storage }): Event => {
  return new StorageEvent('storage', opts);
};

class FailingStorage implements Storage {
  [name: string]: unknown;

  get length(): number {
    return 0;
  }

  getItem(_key: string): string | null {
    throw new DOMException('Access is denied', 'SecurityError');
  }

  setItem(_key: string, _value: string): void {
    throw new DOMException('The quota has been exceeded', 'QuotaExceededError');
  }

  removeItem(_key: string): void {
    throw new DOMException('Access is denied', 'SecurityError');
  }

  clear(): void {}

  key(_index: number): string | null {
    return null;
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
    replaceLocalStorage(new FailingStorage());

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

  test('a write the storage refuses keeps the last value and does not throw', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    replaceLocalStorage(new FailingStorage());

    act(() => result.current.setValue('dark'));

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

    const add = spyOn(globalThis, 'removeEventListener');
    unmount();
    expect(add.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
    add.mockRestore();
  });
});
