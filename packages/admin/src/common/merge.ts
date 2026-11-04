const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * A new object with the sources merged in order: a later source wins, plain objects merge
 * recursively, anything else (an array, a string) replaces, and an `undefined` never overwrites. The
 * sources are not changed. For message bundles and other JSON; `__proto__` is dropped.
 */
export const deepMerge = (opts: { sources: ReadonlyArray<object> }): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};

  for (const source of opts.sources) {
    for (const [key, value] of Object.entries(source)) {
      if (key === '__proto__' || value === undefined) {
        continue;
      }

      const current = merged[key];
      merged[key] = isRecord(value)
        ? deepMerge({ sources: [isRecord(current) ? current : {}, value] })
        : value;
    }
  }

  return merged;
};
