// Kernel tests run without a DOM. Real `localStorage` exposes stored keys as own enumerable
// properties - `DefaultAuthService.cleanUp()` enumerates them - so the stub does the same, with the
// Storage methods kept non-enumerable.
const createStorage = (): Storage => {
  const store: Record<string, string> = {};
  const storage = store as unknown as Storage;
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => (key in store ? store[key]! : null), enumerable: false },
    setItem: {
      value: (key: string, value: string) => {
        store[key] = String(value);
      },
      enumerable: false,
    },
    removeItem: {
      value: (key: string) => {
        delete store[key];
      },
      enumerable: false,
    },
    clear: {
      value: () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
      enumerable: false,
    },
    key: { value: (index: number) => Object.keys(store)[index] ?? null, enumerable: false },
    length: { get: () => Object.keys(store).length, enumerable: false },
  });
  return storage;
};

Object.defineProperty(globalThis, 'localStorage', {
  value: createStorage(),
  configurable: true,
  writable: true,
});

if (typeof navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US' },
    configurable: true,
  });
}

export {};
