import { describe, expect, test } from 'bun:test';
import { RequestBodyTypes } from '@/common';
import { RequestBodyEncoder } from '@/helpers';

describe('RequestBodyEncoder.encode', () => {
  test('a JSON body passes through as it is, with the JSON content type', () => {
    const body = { name: 'a', nested: { id: 1 } };

    expect(RequestBodyEncoder.encode({ bodyType: undefined, body })).toEqual({
      body,
      contentType: 'application/json',
    });
  });

  test('a urlencoded body is a URLSearchParams with the form content type', () => {
    const { body, contentType } = RequestBodyEncoder.encode({
      bodyType: RequestBodyTypes.FORM_URL_ENCODED,
      body: { name: 'a b', tags: ['x', 'y'], meta: { id: 1 }, on: false, none: 0, empty: '' },
    });

    expect(contentType).toBe('application/x-www-form-urlencoded');
    expect(body).toBeInstanceOf(URLSearchParams);
    expect((body as URLSearchParams).get('name')).toBe('a b');
    expect((body as URLSearchParams).get('tags')).toBe('["x","y"]');
    expect((body as URLSearchParams).get('meta')).toBe('{"id":1}');
    // 0, false and '' are values the caller meant to send.
    expect((body as URLSearchParams).get('on')).toBe('false');
    expect((body as URLSearchParams).get('none')).toBe('0');
    expect((body as URLSearchParams).get('empty')).toBe('');
  });

  test('a urlencoded body skips undefined and null, and writes a Date as ISO-8601', () => {
    const { body } = RequestBodyEncoder.encode({
      bodyType: RequestBodyTypes.FORM_URL_ENCODED,
      body: { a: undefined, b: null, at: new Date('2026-01-02T03:04:05.000Z') },
    });

    expect([...(body as URLSearchParams).keys()]).toEqual(['at']);
    expect((body as URLSearchParams).get('at')).toBe('2026-01-02T03:04:05.000Z');
  });

  test('a urlencoded body refuses a file, naming the key and the way out', () => {
    expect(() =>
      RequestBodyEncoder.encode({
        bodyType: RequestBodyTypes.FORM_URL_ENCODED,
        body: { avatar: new Blob(['x']) },
      }),
    ).toThrow('"avatar" is a file');
  });

  test('a multipart body is a FormData with no content type, so fetch sets the boundary', () => {
    const file = new File(['content'], 'a.txt');
    const { body, contentType } = RequestBodyEncoder.encode({
      bodyType: RequestBodyTypes.FORM_DATA,
      body: { name: 'a', files: [file, file], meta: { id: 1 }, skip: undefined, zero: 0 },
    });

    expect(contentType).toBeUndefined();
    expect(body).toBeInstanceOf(FormData);

    const form = body as FormData;
    expect(form.get('name')).toBe('a');
    expect(form.getAll('files')).toHaveLength(2);
    expect((form.get('files') as File).name).toBe('a.txt');
    expect(form.get('meta')).toBe('{"id":1}');
    expect(form.has('skip')).toBe(false);
    expect(form.get('zero')).toBe('0');
  });

  test('no FileList in the runtime is not an error', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'FileList');
    Reflect.deleteProperty(globalThis, 'FileList');

    try {
      const { body } = RequestBodyEncoder.encode({
        bodyType: RequestBodyTypes.FORM_DATA,
        body: { name: 'a' },
      });
      expect((body as FormData).get('name')).toBe('a');
    } finally {
      if (original) {
        Object.defineProperty(globalThis, 'FileList', original);
      }
    }
  });

  test('the body is typed by the body type, so it can be written without a cast', () => {
    // The shape of an IGNIS `write({ body })`: text or an object, never `unknown`.
    const write = (opts: { body: string | object }) => opts.body;

    const form = RequestBodyEncoder.encode({
      bodyType: RequestBodyTypes.FORM_DATA,
      body: { a: 1 },
    });
    const formBody: FormData = form.body;
    const encoded = RequestBodyEncoder.encode({
      bodyType: RequestBodyTypes.FORM_URL_ENCODED,
      body: { a: 1 },
    });
    const encodedBody: URLSearchParams = encoded.body;
    const encodedType: string = encoded.contentType;
    const sent = RequestBodyEncoder.encode({ bodyType: RequestBodyTypes.JSON, body: { id: 7 } });
    const id: number = sent.body.id;
    const text = RequestBodyEncoder.encode({ body: 'raw' });
    const raw: string = text.body;

    expect(write({ body: formBody })).toBeInstanceOf(FormData);
    expect(write({ body: encodedBody })).toBeInstanceOf(URLSearchParams);
    expect(encodedType).toBe('application/x-www-form-urlencoded');
    expect([id, raw]).toEqual([7, 'raw']);

    // A body type known only as a string cannot say what was built, so it stays `unknown`.
    const anyType: string = RequestBodyTypes.FORM_DATA;
    const wide = RequestBodyEncoder.encode({ bodyType: anyType, body: {} });
    // @ts-expect-error - `unknown` is not `string | object`: a wide body type needs a narrowing
    write({ body: wide.body });
    // @ts-expect-error - a FormData is not a string body
    const notString: string = form.body;

    expect(wide.body).toBeInstanceOf(FormData);
    expect(notString).toBeInstanceOf(FormData);
  });
});
