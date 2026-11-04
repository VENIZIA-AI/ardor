import type { IStorageCodec } from '@/common';

export class StorageCodecs {
  /**
   * A string stored as it is, with no quotes: for a key whose data is a bare string, not JSON. With
   * `allowed`, a text outside the list does not decode (`BrowserStorage.get` gives its fallback) and
   * a value outside the list does not encode (`BrowserStorage.set` answers `false`). The error names
   * no value, because a stored text can be a token. Create it once, outside a component.
   */
  static text(opts: { allowed?: ReadonlyArray<string> } = {}): IStorageCodec<string> {
    const { allowed } = opts;
    const check = (text: string): string => {
      if (allowed && !allowed.includes(text)) {
        throw new TypeError('not an allowed value');
      }

      return text;
    };

    return { encode: check, decode: check };
  }
}
