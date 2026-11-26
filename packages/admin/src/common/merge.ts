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

const overlay = (opts: {
  target: object;
  source: object;
  prefix: string;
  skipped: Set<string>;
}): void => {
  const { target, source, prefix, skipped } = opts;

  for (const [key, value] of Object.entries(source)) {
    if (key === '__proto__' || value === undefined) {
      continue;
    }

    const path = `${prefix}${key}`;
    const current: unknown = Object.hasOwn(target, key) ? Reflect.get(target, key) : undefined;

    if (typeof value === 'string' && (current === undefined || typeof current === 'string')) {
      Reflect.set(target, key, value);
      continue;
    }

    if (RecordUtility.isPlainRecord(value)) {
      const group = current === undefined ? {} : current;

      if (RecordUtility.isPlainRecord(group)) {
        Reflect.set(target, key, group);
        overlay({ target: group, source: value, prefix: `${path}.`, skipped });
        continue;
      }
    }

    skipped.add(path);
  }
};

/**
 * A copy of `base` with the sources merged over it, as `deepMerge` orders them, keeping its shape: a
 * message is only replaced by a message and a group only merged with a group, and a new key holds a
 * message or a group of them. What does not fit is left out and listed by its dotted key. This is what
 * makes the result still a `TBase`.
 */
export const mergeShaped = <TBase extends object>(opts: {
  base: TBase;
  sources: ReadonlyArray<object>;
}): { merged: TBase; skipped: Array<string> } => {
  const merged = structuredClone(opts.base);
  const skipped = new Set<string>();

  for (const source of opts.sources) {
    overlay({ target: merged, source, prefix: '', skipped });
  }

  return { merged, skipped: [...skipped] };
};
