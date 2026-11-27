import { RecordUtility } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';

import { RequestBodyTypes } from '@/common';
import { ValueUtility } from './value';

/** A request body as it is sent, with the content type to send it under (none: let `fetch` choose). */
export interface IEncodedBody {
  body: unknown;
  contentType?: string;
}

/** The body types that go through as they are, under the JSON content type. */
type TPassThroughBodyType =
  | typeof RequestBodyTypes.JSON
  | typeof RequestBodyTypes.NONE
  | typeof RequestBodyTypes.BINARY;

/**
 * Turns a request body into what `fetch` sends, by `RequestBodyTypes`.
 */
export class RequestBodyEncoder {
  /**
   * Throws for options that carry `body` or `bodyType`, which `payload` replaced, and for a
   * `payload` that is not `{ data, type? }`: either one would send something else than the caller
   * meant. At run time any text `type` passes, for an `encodeBody` override that reads one;
   * `IRequestPayload` types only the `RequestBodyTypes` values.
   */
  static assertPayload(opts: {
    options: object;
    /** The class that was given the options, named in the message. */
    owner: string;
  }): void {
    const { options, owner } = opts;
    const removed = ['body', 'bodyType'].filter((key) => key in options);

    if (removed.length) {
      const verb = removed.length > 1 ? 'were' : 'was';

      throw getError({
        message: `[${owner}] ${removed.join(' and ')} ${verb} replaced by payload: { data, type }`,
      });
    }

    const payload = 'payload' in options ? options.payload : undefined;
    const invalid = RequestBodyEncoder.findInvalidPayload({ payload });

    if (invalid) {
      throw getError({ message: `[${owner}] payload takes { data, type? }: invalid ${invalid}` });
    }
  }

  /**
   * The body as it is sent and the content type to send it under. The overloads give the type of what
   * is built: a `FormData` for `form-data` (no content type: `fetch` adds the multipart one), a
   * `URLSearchParams` for `x-www-form-urlencoded`, and the data you passed for `json`, `none`,
   * `binary` or no type. A `payload.type` known only as a `string` answers `IEncodedBody`.
   */
  static encode(opts: { payload: { data: unknown; type: typeof RequestBodyTypes.FORM_DATA } }): {
    body: FormData;
    contentType?: undefined;
  };
  static encode(opts: {
    payload: { data: unknown; type: typeof RequestBodyTypes.FORM_URL_ENCODED };
  }): {
    body: URLSearchParams;
    contentType: string;
  };
  static encode<TData>(opts: { payload: { data: TData; type?: TPassThroughBodyType } }): {
    body: TData;
    contentType: string;
  };
  static encode(opts: { payload?: { data: unknown; type?: string } }): IEncodedBody;
  static encode(opts: { payload?: { data: unknown; type?: string } }): IEncodedBody {
    RequestBodyEncoder.assertPayload({ options: opts, owner: RequestBodyEncoder.name });

    const body = opts.payload?.data;
    const bodyType = opts.payload?.type;

    switch (bodyType) {
      case RequestBodyTypes.FORM_URL_ENCODED: {
        const encoded = new URLSearchParams();

        for (const [key, value] of RequestBodyEncoder.entriesOf({ body })) {
          if (!ValueUtility.isDefined(value)) {
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

        for (const [key, value] of RequestBodyEncoder.entriesOf({ body })) {
          const items: unknown[] =
            Array.isArray(value) || RequestBodyEncoder.isFileList(value)
              ? Array.from(value)
              : [value];

          for (const item of items) {
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

  /** What is wrong with a `payload`: its shape or its type; `undefined` when nothing is. */
  private static findInvalidPayload(opts: { payload: unknown }): string | undefined {
    const { payload } = opts;

    if (payload === undefined) {
      return undefined;
    }

    if (Array.isArray(payload)) {
      return 'shape (got an array)';
    }

    if (payload === null) {
      return 'shape (got null)';
    }

    if (typeof payload !== 'object') {
      return `shape (got a ${typeof payload})`;
    }

    if (!('data' in payload)) {
      return 'shape (no data)';
    }

    const { data: _data, type, ...rest }: { data: unknown; type?: unknown } = payload;
    const unknownKeys = Object.keys(rest);

    if (unknownKeys.length) {
      return `shape (unknown key ${unknownKeys.join(', ')})`;
    }

    return type === undefined || typeof type === 'string' ? undefined : 'type';
  }

  /** The fields of a form body: those of an object, or the indexes of an array or a string. */
  private static entriesOf(opts: { body: unknown }): Array<[string, unknown]> {
    const { body } = opts;

    if (RecordUtility.isRecord(body)) {
      return Object.entries(body);
    }

    return typeof body === 'string' ? Object.entries(body) : [];
  }

  // `FileList` exists only in a DOM; the bare identifier throws in Workers and on Bun.
  private static isFileList(value: unknown): value is FileList {
    return typeof FileList !== 'undefined' && value instanceof FileList;
  }

  /** A multipart text value: JSON for objects and arrays, ISO-8601 for a `Date`, `String()` otherwise. */
  private static encodeText(opts: { key: string; value: unknown; bodyType: string }): string {
    const { key, value, bodyType } = opts;

    // A urlencoded body carries text only; a file here would be sent as `"{}"` with nothing said.
    if (value instanceof Blob) {
      throw getError({
        message: `[getRequestProps] "${key}" is a file, which a ${bodyType} body cannot carry. Send it with payload.type "${RequestBodyTypes.FORM_DATA}".`,
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

    if (!ValueUtility.isDefined(value)) {
      return;
    }

    if (value instanceof Blob) {
      const name = 'name' in value && typeof value.name === 'string' ? value.name : undefined;
      formData.append(key, value, name);

      return;
    }

    formData.append(
      key,
      RequestBodyEncoder.encodeText({ key, value, bodyType: RequestBodyTypes.FORM_DATA }),
    );
  }
}
