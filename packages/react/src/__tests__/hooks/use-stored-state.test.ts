import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';

import {
  BrowserStorage,
  type IStorageCodec,
  StorageAreas,
  StorageCodecs,
} from '@venizia/ardor-kernel';
import { FakeStorage } from '@venizia/ardor-kernel/testing';
import { useStoredState } from '@/hooks/use-stored-state';

const KEY = '@app/store/theme';

const storageEvent = (opts: { key: string | null; storageArea: Storage }): Event => {
  return new StorageEvent('storage', opts);
};

const restores: Array<() => void> = [];

const installFake = (storage: FakeStorage): void => {
  restores.push(storage.install());
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

  while (restores.length > 0) {
    restores.pop()?.();
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
    const blocked = new FakeStorage();
    blocked.setItem(KEY, JSON.stringify('dark'));
    blocked.failReads = true;
    installFake(blocked);

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

describe('useStoredState with StorageCodecs.text', () => {
  const THEME = StorageCodecs.text({ allowed: ['light', 'dark'] });

  test('reads a bare string that the JSON default cannot read, and stores one without quotes', () => {
    localStorage.setItem(KEY, 'dark');

    const json = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    expect(json.result.current.value).toBe('light');

    const { result } = renderHook(() => {
      return useStoredState({ key: KEY, defaultValue: 'light', codec: THEME });
    });
    expect(result.current.value).toBe('dark');

    act(() => result.current.setValue('light'));

    expect(localStorage.getItem(KEY)).toBe('light');
    expect(result.current.value).toBe('light');
  });

  test('gives the default value for a stored text outside the allowed list', () => {
    localStorage.setItem(KEY, 'sepia');

    const { result } = renderHook(() => {
      return useStoredState({ key: KEY, defaultValue: 'light', codec: THEME });
    });

    expect(result.current.value).toBe('light');
  });

  test('does not store a value outside the allowed list, and the hook keeps it like a refused write', () => {
    localStorage.setItem(KEY, 'dark');

    const { result } = renderHook(() => {
      return useStoredState({ key: KEY, defaultValue: 'light', codec: THEME });
    });
    // @ts-expect-error a value outside allowed is a compile error
    act(() => result.current.setValue('sepia'));

    const shown: string = result.current.value;

    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(shown).toBe('sepia');
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

  test('two updaters in one tick compose, like a functional setState', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));

    act(() => {
      result.current.setValue((current) => current + 1);
      result.current.setValue((current) => current + 1);
    });

    expect(result.current.value).toBe(2);
    expect(localStorage.getItem(KEY)).toBe('2');
  });

  test('an updater on a hook that has not rendered since another hook wrote sees that write', () => {
    const first = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));
    const second = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));

    act(() => {
      first.result.current.setValue((current) => current + 1);
      second.result.current.setValue((current) => current + 1);
    });

    expect(localStorage.getItem(KEY)).toBe('2');
    expect(first.result.current.value).toBe(2);
    expect(second.result.current.value).toBe(2);
  });

  test('an updater sees a write made outside React in the same tick', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));

    act(() => {
      BrowserStorage.set({ key: KEY, value: 10 });
      result.current.setValue((current) => current + 1);
    });

    expect(result.current.value).toBe(11);
  });

  test('a plain value after an updater in the same tick wins, and an updater after it builds on it', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));

    act(() => {
      result.current.setValue((current) => current + 1);
      result.current.setValue(10);
      result.current.setValue((current) => current + 1);
    });

    expect(result.current.value).toBe(11);
  });

  test('updaters in one tick compose on a storage that refuses the writes', () => {
    const quota = new FakeStorage();
    installFake(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));
    quota.failWrites = true;

    act(() => {
      result.current.setValue((current) => current + 1);
      result.current.setValue((current) => current + 1);
    });

    expect(result.current.value).toBe(2);
    expect(quota.getItem(KEY)).toBeNull();
  });

  test('after a refused write, an updater builds on the kept value, not on a write the hook was not told about', () => {
    const quota = new FakeStorage();
    installFake(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));
    quota.failWrites = true;
    act(() => result.current.setValue(5));
    expect(result.current.value).toBe(5);

    quota.failWrites = false;
    quota.setItem(KEY, JSON.stringify(100));
    act(() => result.current.setValue((current) => current + 1));

    expect(result.current.value).toBe(6);
    expect(quota.getItem(KEY)).toBe('6');
  });

  test('after a refused write, a write the hook is told about, by an event or by BrowserStorage, wins over the kept value', () => {
    const quota = new FakeStorage();
    installFake(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));
    quota.failWrites = true;
    act(() => result.current.setValue(5));

    quota.failWrites = false;
    act(() => {
      BrowserStorage.set({ key: KEY, value: 100 });
    });
    act(() => result.current.setValue((current) => current + 1));

    expect(result.current.value).toBe(101);
  });

  test('an updater after a refused removal starts again from the default value', () => {
    const quota = new FakeStorage();
    quota.setItem(KEY, JSON.stringify(5));
    installFake(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));
    quota.failWrites = true;

    act(() => {
      result.current.remove();
      result.current.setValue((current) => current + 1);
    });

    expect(result.current.value).toBe(1);
  });

  test('setValue keeps its identity when the value changes', () => {
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));
    const before = result.current.setValue;

    act(() => result.current.setValue(3));

    expect(result.current.setValue).toBe(before);
  });

  test('remove deletes the key and gives the default value again', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => result.current.remove());

    expect(result.current.value).toBe('light');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test('a write the quota refuses is kept in the hook, so the UI still reacts, and is not stored', () => {
    const quota = new FakeStorage();
    installFake(quota);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));
    quota.failWrites = true;

    act(() => result.current.setValue('dark'));
    expect(result.current.value).toBe('dark');
    expect(quota.getItem(KEY)).toBeNull();

    act(() => result.current.setValue((current) => `${current}-2`));
    expect(result.current.value).toBe('dark-2');
  });

  test('a write on a storage that is blocked entirely is kept in the hook and does not throw', () => {
    const blocked = new FakeStorage();
    blocked.failReads = true;
    blocked.failWrites = true;
    installFake(blocked);
    const { result } = renderHook(() => useStoredState({ key: KEY, defaultValue: 'light' }));

    act(() => result.current.setValue('dark'));

    expect(result.current.value).toBe('dark');
  });

  test('a value kept after a refused write gives way to the next change of the storage', () => {
    const quota = new FakeStorage();
    installFake(quota);
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
    const quota = new FakeStorage();
    quota.setItem(KEY, JSON.stringify('dark'));
    installFake(quota);
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

describe('useStoredState writeDelayMs', () => {
  const DELAY = 200;

  const advance = (milliseconds: number) => {
    act(() => {
      jest.advanceTimersByTime(milliseconds);
    });
  };

  const delayed = () => {
    const storage = new FakeStorage();
    installFake(storage);
    const view = renderHook(() => {
      return useStoredState({ key: KEY, defaultValue: 0, writeDelayMs: DELAY });
    });

    return { storage, ...view };
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('setValue changes the value at once and writes the last one once, after the delay', () => {
    const { result, storage } = delayed();

    act(() => {
      result.current.setValue(1);
      result.current.setValue(2);
      result.current.setValue(3);
    });
    expect(result.current.value).toBe(3);
    expect(storage.writes).toEqual([]);

    advance(DELAY);

    expect(storage.writes).toEqual(['3']);
    expect(result.current.value).toBe(3);
  });

  test('every setValue restarts the delay', () => {
    const { result, storage } = delayed();

    act(() => result.current.setValue(1));
    advance(150);
    act(() => result.current.setValue(2));
    advance(150);
    expect(storage.writes).toEqual([]);

    advance(50);
    expect(storage.writes).toEqual(['2']);
  });

  test('updaters inside the delay build on the pending value', () => {
    const { result, storage } = delayed();

    act(() => {
      result.current.setValue((current) => current + 1);
      result.current.setValue((current) => current + 1);
    });
    advance(DELAY);

    expect(result.current.value).toBe(2);
    expect(storage.writes).toEqual(['2']);
  });

  test('remove inside the delay cancels the write and removes the key', () => {
    const { result, storage } = delayed();
    storage.setItem(KEY, JSON.stringify(9));
    storage.writes.length = 0;

    act(() => result.current.setValue(5));
    act(() => result.current.remove());
    advance(DELAY);

    expect(storage.writes).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
    expect(result.current.value).toBe(0);
  });

  test('unmount inside the delay writes the pending value', () => {
    const { result, storage, unmount } = delayed();
    act(() => result.current.setValue(7));

    unmount();

    expect(storage.writes).toEqual(['7']);
    advance(DELAY);
    expect(storage.writes).toEqual(['7']);
  });

  test('a changed key writes the pending value to the old key and starts from the new one', () => {
    const storage = new FakeStorage();
    storage.setItem('@app/store/b', JSON.stringify(40));
    installFake(storage);
    const { result, rerender } = renderHook(
      (props: { key: string }) => {
        return useStoredState({ key: props.key, defaultValue: 0, writeDelayMs: DELAY });
      },
      { initialProps: { key: '@app/store/a' } },
    );
    act(() => result.current.setValue(5));

    rerender({ key: '@app/store/b' });

    expect(storage.getItem('@app/store/a')).toBe('5');
    expect(result.current.value).toBe(40);
    advance(DELAY);
    expect(storage.getItem('@app/store/b')).toBe('40');
  });

  test('a write from other code inside the delay wins: the pending write is cancelled', () => {
    const { result, storage } = delayed();
    act(() => result.current.setValue(5));

    act(() => {
      BrowserStorage.set({ key: KEY, value: 99 });
    });
    advance(DELAY);

    expect(storage.writes).toEqual(['99']);
    expect(result.current.value).toBe(99);
  });

  test('a storage event from another tab inside the delay cancels the pending write too', () => {
    const { result, storage } = delayed();
    act(() => result.current.setValue(5));

    act(() => {
      storage.setItem(KEY, JSON.stringify(60));
      window.dispatchEvent(storageEvent({ key: KEY, storageArea: storage }));
    });
    advance(DELAY);

    expect(storage.writes).toEqual(['60']);
    expect(result.current.value).toBe(60);
  });

  test('the hook own write is not a foreign one: a later change after it is still written', () => {
    const { result, storage } = delayed();
    act(() => result.current.setValue(1));
    advance(DELAY);

    act(() => result.current.setValue(2));
    advance(DELAY);

    expect(storage.writes).toEqual(['1', '2']);
    expect(result.current.value).toBe(2);
  });

  test('a delayed write the storage refuses is kept in the hook', () => {
    const { result, storage } = delayed();
    act(() => result.current.setValue(5));
    storage.failWrites = true;

    advance(DELAY);

    expect(storage.getItem(KEY)).toBeNull();
    expect(result.current.value).toBe(5);
  });

  test('a removal the storage refuses inside the delay does not write the pending value later', () => {
    const { result, storage } = delayed();
    storage.setItem(KEY, JSON.stringify(9));
    storage.writes.length = 0;
    act(() => result.current.setValue(5));
    storage.failWrites = true;

    act(() => result.current.remove());
    storage.failWrites = false;
    advance(DELAY);

    expect(storage.writes).toEqual([]);
    expect(storage.getItem(KEY)).toBe('9');
    expect(result.current.value).toBe(0);
  });

  test('a value kept after a refused removal is not written when the hook unmounts', () => {
    const { result, storage, unmount } = delayed();
    storage.setItem(KEY, JSON.stringify(9));
    storage.writes.length = 0;
    storage.failWrites = true;
    act(() => result.current.remove());
    storage.failWrites = false;

    unmount();

    expect(storage.writes).toEqual([]);
    expect(storage.getItem(KEY)).toBe('9');
  });

  test('a delayed write the storage refuses is not tried again when the hook unmounts', () => {
    const { result, storage, unmount } = delayed();
    act(() => result.current.setValue(5));
    storage.failWrites = true;
    advance(DELAY);
    storage.failWrites = false;

    unmount();

    expect(storage.writes).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
  });

  describe('when the page is hidden or closed', () => {
    const hide = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => state === 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    afterEach(() => {
      Reflect.deleteProperty(document, 'visibilityState');
      Reflect.deleteProperty(document, 'hidden');
    });

    test('pagehide writes the pending value once, and the delay does not write it again', () => {
      const { result, storage } = delayed();
      act(() => result.current.setValue(8));

      window.dispatchEvent(new Event('pagehide'));

      expect(storage.writes).toEqual(['8']);
      advance(DELAY);
      expect(storage.writes).toEqual(['8']);
    });

    test('visibilitychange to hidden writes the pending value, to visible does not', () => {
      const { result, storage } = delayed();
      act(() => result.current.setValue(8));

      hide('visible');
      expect(storage.writes).toEqual([]);

      hide('hidden');
      expect(storage.writes).toEqual(['8']);
    });

    test('with no pending write, nothing is written', () => {
      const { result, storage } = delayed();

      window.dispatchEvent(new Event('pagehide'));
      hide('hidden');
      expect(storage.writes).toEqual([]);

      act(() => result.current.setValue(8));
      advance(DELAY);
      storage.writes.length = 0;
      window.dispatchEvent(new Event('pagehide'));
      expect(storage.writes).toEqual([]);
    });

    test('a hook without a delay adds no listener, and unmount removes them', () => {
      const added = spyOn(window, 'addEventListener');
      const removed = spyOn(window, 'removeEventListener');
      renderHook(() => useStoredState({ key: KEY, defaultValue: 0 })).unmount();
      expect(added.mock.calls.filter(([type]) => type === 'pagehide')).toHaveLength(0);

      removed.mockClear();
      renderHook(() =>
        useStoredState({ key: KEY, defaultValue: 0, writeDelayMs: DELAY }),
      ).unmount();
      expect(added.mock.calls.filter(([type]) => type === 'pagehide')).toHaveLength(1);
      expect(removed.mock.calls.filter(([type]) => type === 'pagehide')).toHaveLength(1);
      added.mockRestore();
      removed.mockRestore();
    });
  });

  test('a sweep of the prefix drops a pending write for a key that was not stored yet', () => {
    const { result, storage, unmount } = delayed();
    act(() => result.current.setValue(5));

    act(() => {
      BrowserStorage.removeWhere({ prefix: '@app/store/' });
    });
    advance(DELAY);
    unmount();

    expect(storage.writes).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
  });

  test('a delay that is not a number writes at once', () => {
    const storage = new FakeStorage();
    installFake(storage);
    const { result } = renderHook(() => {
      return useStoredState({ key: KEY, defaultValue: 0, writeDelayMs: Number.NaN });
    });

    act(() => result.current.setValue(1));

    expect(storage.writes).toEqual(['1']);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a delay of 0, or none, writes at once and sets no timer', () => {
    const storage = new FakeStorage();
    installFake(storage);
    const none = renderHook(() => useStoredState({ key: KEY, defaultValue: 0 }));
    const zero = renderHook(() => {
      return useStoredState({ key: KEY, defaultValue: 0, writeDelayMs: 0 });
    });

    act(() => none.result.current.setValue(1));
    expect(storage.writes).toEqual(['1']);
    act(() => zero.result.current.setValue(2));
    expect(storage.writes).toEqual(['1', '2']);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('useStoredState with a null key', () => {
  test('starts from the default value and neither reads, writes nor watches storage', () => {
    const storage = new FakeStorage();
    installFake(storage);
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const getItem = spyOn(Storage.prototype, 'getItem');
    const setItem = spyOn(Storage.prototype, 'setItem');
    const subscribe = spyOn(BrowserStorage, 'subscribe');
    const writesBefore = storage.writes.length;

    const { result } = renderHook(() => useStoredState({ key: null, defaultValue: 'light' }));
    act(() => {
      result.current.setValue('dark');
    });

    expect(result.current.value).toBe('dark');
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(storage.writes).toHaveLength(writesBefore);
    getItem.mockRestore();
    setItem.mockRestore();
    subscribe.mockRestore();
  });

  test('the default value is the value before any setValue, even when a key holds something', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));

    const { result } = renderHook(() => useStoredState({ key: null, defaultValue: 'light' }));

    expect(result.current.value).toBe('light');
  });

  test('setValue with an updater works on the value in memory, as useState does', () => {
    const { result } = renderHook(() => useStoredState({ key: null, defaultValue: 1 }));

    act(() => {
      result.current.setValue((current) => current + 1);
      result.current.setValue((current) => current + 1);
    });

    expect(result.current.value).toBe(3);
    expect(localStorage.length).toBe(0);
  });

  test('remove returns the default value and touches no storage', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const { result } = renderHook(() => useStoredState({ key: null, defaultValue: 'light' }));
    act(() => {
      result.current.setValue('blue');
    });

    act(() => {
      result.current.remove();
    });

    expect(result.current.value).toBe('light');
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('dark'));
  });

  test('a storage event for any key renders nothing', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;

      return useStoredState({ key: null, defaultValue: 'light' });
    });
    const before = renders;

    act(() => {
      localStorage.setItem(KEY, JSON.stringify('dark'));
      window.dispatchEvent(storageEvent({ key: KEY, storageArea: localStorage }));
    });

    expect(renders).toBe(before);
  });

  test('from null to a key it reads that key and drops the value held in memory', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const { result, rerender } = renderHook(
      (props: { key: string | null }) => useStoredState({ key: props.key, defaultValue: 'light' }),
      { initialProps: { key: null as string | null } },
    );
    act(() => {
      result.current.setValue('blue');
    });
    expect(result.current.value).toBe('blue');

    rerender({ key: KEY });

    expect(result.current.value).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('dark'));
  });

  test('from null to a key that holds nothing it gives the default value and then writes there', () => {
    const { result, rerender } = renderHook(
      (props: { key: string | null }) => useStoredState({ key: props.key, defaultValue: 'light' }),
      { initialProps: { key: null as string | null } },
    );
    act(() => {
      result.current.setValue('blue');
    });

    rerender({ key: KEY });
    expect(result.current.value).toBe('light');

    act(() => {
      result.current.setValue('green');
    });
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('green'));
  });

  test('from a key to null the stored value is left alone and the value is the default again', () => {
    localStorage.setItem(KEY, JSON.stringify('dark'));
    const { result, rerender } = renderHook(
      (props: { key: string | null }) => useStoredState({ key: props.key, defaultValue: 'light' }),
      { initialProps: { key: KEY as string | null } },
    );
    expect(result.current.value).toBe('dark');

    rerender({ key: null });
    expect(result.current.value).toBe('light');

    act(() => {
      result.current.setValue('blue');
    });
    expect(result.current.value).toBe('blue');
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('dark'));
  });

  test('a memory value does not come back when the key goes null again', () => {
    const { result, rerender } = renderHook(
      (props: { key: string | null }) => useStoredState({ key: props.key, defaultValue: 'light' }),
      { initialProps: { key: null as string | null } },
    );
    act(() => {
      result.current.setValue('blue');
    });

    rerender({ key: KEY });
    rerender({ key: null });

    expect(result.current.value).toBe('light');
  });

  describe('with a write delay', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('a pending write for the old key is still written to that key when the key turns null', () => {
      const { result, rerender } = renderHook(
        (props: { key: string | null }) => {
          return useStoredState({ key: props.key, defaultValue: 0, writeDelayMs: 200 });
        },
        { initialProps: { key: KEY as string | null } },
      );
      act(() => {
        result.current.setValue(7);
      });
      expect(localStorage.getItem(KEY)).toBeNull();

      rerender({ key: null });

      expect(localStorage.getItem(KEY)).toBe('7');
      expect(result.current.value).toBe(0);
    });

    test('under a null key setValue sets no timer and writes nothing, however long it waits', () => {
      const { result } = renderHook(() => {
        return useStoredState({ key: null, defaultValue: 0, writeDelayMs: 200 });
      });
      act(() => {
        result.current.setValue(5);
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.value).toBe(5);
      expect(localStorage.length).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  test('the server snapshot and a host with no key both give the default value', () => {
    const { result } = renderHook(() => useStoredState({ key: null, defaultValue: { a: 1 } }));

    expect(result.current.value).toEqual({ a: 1 });
  });
});
