import { getError } from '@venizia/ignis-inversion';

import { RequestBodyTypes } from '@/common';
import { isDefined } from '@/utilities';

/** A request body as it is sent, with the content type to send it under (none: let `fetch` choose). */
export interface IEncodedBody {
  body: unknown;
  contentType?: string;
}

export class RequestBodyEncoder {
  static encode(opts: { bodyType?: string; body: unknown }): IEncodedBody {
    const { bodyType, body } = opts;

    switch (bodyType) {
      case RequestBodyTypes.FORM_URL_ENCODED: {
        const encoded = new URLSearchParams();

        for (const [key, value] of Object.entries((body ?? {}) as Record<string, unknown>)) {
          if (!isDefined(value)) {
            continue;
          }

          encoded.append(
            key,
            RequestBodyEncoder.encodeText({
              key,
              value,
              bodyType: RequestBodyTypes.FORM_URL_ENCODED,
            }),
          );
        }

        return { body: encoded, contentType: 'application/x-www-form-urlencoded' };
      }
      case RequestBodyTypes.FORM_DATA: {
        const formData = new FormData();

        for (const [key, value] of Object.entries((body ?? {}) as Record<string, unknown>)) {
          const values = Array.isArray(value) || RequestBodyEncoder.isFileList(value);
          for (const item of values ? Array.from(value as ArrayLike<unknown>) : [value]) {
            RequestBodyEncoder.appendFormValue({ formData, key, value: item });
          }
        }

        // No content type: `fetch` adds the multipart one, with its boundary.
        return { body: formData };
      }
      default: {
        return { body, contentType: 'application/json' };
      }
    }
  }

  // `FileList` exists only in a DOM; the bare identifier throws in Workers and on Bun.
  private static isFileList(value: unknown): boolean {
    return typeof FileList !== 'undefined' && value instanceof FileList;
  }

  /** A multipart text value: JSON for objects and arrays, ISO-8601 for a `Date`, `String()` otherwise. */
  private static encodeText(opts: { key: string; value: unknown; bodyType: string }): string {
    const { key, value, bodyType } = opts;

    // A urlencoded body carries text only; a file here would be sent as `"{}"` with nothing said.
    if (value instanceof Blob) {
      throw getError({
        message: `[getRequestProps] "${key}" is a file, which a ${bodyType} body cannot carry. Send it with bodyType "${RequestBodyTypes.FORM_DATA}".`,
      });
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /** Skips only `undefined` and `null`: `0`, `false` and `''` are values the caller meant to send. */
  private static appendFormValue(opts: { formData: FormData; key: string; value: unknown }): void {
    const { formData, key, value } = opts;

    if (!isDefined(value)) {
      return;
    }

    if (value instanceof Blob) {
      formData.append(key, value, (value as File).name);
      return;
    }

    formData.append(
      key,
      RequestBodyEncoder.encodeText({ key, value, bodyType: RequestBodyTypes.FORM_DATA }),
    );
  }
}
