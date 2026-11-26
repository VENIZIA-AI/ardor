import { RecordUtility } from '@venizia/ignis-helpers/core';
import type { StringMap } from 'ra-core';

/** One source over one group: what fits is written into `target`, the rest is named in `skipped`. */
const overlay = (opts: {
  target: StringMap;
  source: object;
  prefix: string;
  skipped: Array<string>;
}): void => {
  const { target, source, prefix, skipped } = opts;

  for (const [key, value] of Object.entries(source)) {
    if (key === '__proto__' || value === undefined) {
      continue;
    }

    const path = `${prefix}${key}`;
    const current = Object.hasOwn(target, key) ? target[key] : undefined;

    if (typeof value === 'string' && (current === undefined || typeof current === 'string')) {
      target[key] = value;
      continue;
    }

    if (RecordUtility.isPlainRecord(value) && typeof current !== 'string') {
      const group: StringMap = current ?? {};
      target[key] = group;
      overlay({ target: group, source: value, prefix: `${path}.`, skipped });
      continue;
    }

    skipped.push(path);
  }
};

/**
 * Merges the sources into `target` in order, a later one winning, and answers the dotted keys it left
 * out. A message only replaces a message and a group only merges with a group, so what `target`
 * already holds keeps its shape; a new key takes a message or a group of them. An array, a number or
 * `null` is left out, an `undefined` never overwrites and `__proto__` is dropped. The sources are not
 * changed.
 */
export const mergeMessages = (opts: {
  target: StringMap;
  sources: ReadonlyArray<object>;
}): Array<string> => {
  const skipped: Array<string> = [];

  for (const source of opts.sources) {
    overlay({ target: opts.target, source, prefix: '', skipped });
  }

  return skipped;
};
