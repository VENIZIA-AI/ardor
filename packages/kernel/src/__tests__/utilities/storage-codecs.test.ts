import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { BrowserStorage } from '@/utilities/browser-storage';
import { StorageCodecs } from '@/utilities/storage-codecs';

class StorageStub implements Storage {
  [name: string]: unknown;

  get length(): number {
    return Object.keys(this).length;
  }

  getItem(key: string): string | null {
    const value = Object.getOwnPropertyDescriptor(this, key)?.value;
    return typeof value === 'string' ? value : null;
  }

  setItem(key: string, value: string): void {
    this[key] = value;
  }

  removeItem(key: string): void {
    delete this[key];
  }

  clear(): void {
    for (const key of Object.keys(this)) {
      delete this[key];
    }
  }

  key(index: number): string | null {
    return Object.keys(this)[index] ?? null;
  }
}

const KEY = '@app/store/theme';

const originalLocal = globalThis.localStorage;

const installLocal = (storage: Storage | undefined) => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
};

beforeEach(() => {
  installLocal(new StorageStub());
});

afterEach(() => {
  installLocal(originalLocal);
});

describe('StorageCodecs.text', () => {
  test('stores a string as it is, with no quotes, and reads it back', () => {
    const codec = StorageCodecs.text();

    expect(BrowserStorage.set({ key: KEY, value: 'dark', codec })).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(BrowserStorage.get({ key: KEY, fallback: 'light', codec })).toBe('dark');
  });

  test('reads text that was written as a bare string by other code', () => {
    localStorage.setItem(KEY, 'dark');

    expect(BrowserStorage.get({ key: KEY, fallback: 'light', codec: StorageCodecs.text() })).toBe(
      'dark',
    );
    expect(BrowserStorage.get({ key: KEY, fallback: 'light' })).toBe('light');
  });

  test('an empty stored string is a value, not "no data"', () => {
    localStorage.setItem(KEY, '');

    expect(BrowserStorage.get({ key: KEY, fallback: 'light', codec: StorageCodecs.text() })).toBe(
      '',
    );
  });

  test('gives the fallback for a key that is not there', () => {
    expect(BrowserStorage.get({ key: KEY, fallback: 'light', codec: StorageCodecs.text() })).toBe(
      'light',
    );
  });
});

describe('StorageCodecs.text with allowed', () => {
  const codec = StorageCodecs.text({ allowed: ['light', 'dark'] });

  test('reads a stored value from the list', () => {
    localStorage.setItem(KEY, 'dark');

    expect(BrowserStorage.get({ key: KEY, fallback: 'light', codec })).toBe('dark');
  });

  test('gives the fallback for a stored value outside the list', () => {
    localStorage.setItem(KEY, 'sepia');

    expect(BrowserStorage.get({ key: KEY, fallback: 'light', codec })).toBe('light');
  });

  test('refuses to write a value outside the list, and leaves the storage as it was', () => {
    localStorage.setItem(KEY, 'dark');

    expect(BrowserStorage.set({ key: KEY, value: 'sepia', codec })).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('dark');
    expect(BrowserStorage.set({ key: KEY, value: 'light', codec })).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('light');
  });
});
