import { getError } from '@venizia/ignis-inversion';

import type { IStorageCodec } from '@/common';

export class StorageCodecs {
  /** A bare string, not JSON. Create once; outside `allowed`, decode and encode throw. */
  static text<TText extends string = string>(
    opts: { allowed?: ReadonlyArray<TText> } = {},
  ): IStorageCodec<TText> {
    const { allowed } = opts;
    const isAllowed = (text: string): text is TText => {
      return !allowed || allowed.some((item) => item === text);
    };
    const check = (text: string): TText => {
      if (!isAllowed(text)) {
        throw getError({ message: '[StorageCodecs.text] The text is not in the allowed list' });
      }

      return text;
    };

    return { encode: check, decode: check };
  }
}
