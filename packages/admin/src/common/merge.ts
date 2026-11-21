import { RecordUtility } from '@venizia/ignis-helpers/core';

/**
 * A new object with the sources merged in order: a later source wins, plain objects merge
 * recursively, anything else (an array, a string) replaces, and an `undefined` never overwrites. The
 * sources are not changed. For JSON-like values only (message bundles): a `Date` becomes `{}`, an
 * array is shared with its source by reference, and `__proto__` is dropped.
 */
export const deepMerge = (opts: { sources: ReadonlyArray<object> }): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};

  for (const source of opts.sources) {
    for (const [key, value] of Object.entries(source)) {
      if (key === '__proto__' || value === undefined) {
        continue;
      }

      const current = merged[key];
      merged[key] = RecordUtility.isPlainRecord(value)
        ? deepMerge({ sources: [RecordUtility.isPlainRecord(current) ? current : {}, value] })
        : value;
    }
  }

  return merged;
};
