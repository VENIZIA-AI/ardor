import { describe, expect, test } from 'bun:test';
import { RequestBodyTypes } from '@/common';
import { RequestBodyEncoder } from '@/utilities';

describe('RequestBodyEncoder.encode', () => {
  test('a JSON body passes through as it is, with the JSON content type', () => {
    const body = { name: 'a', nested: { id: 1 } };

    expect(RequestBodyEncoder.encode({ payload: { data: body } })).toEqual({
      body,
      contentType: 'application/json',
    });
  });

  test('a urlencoded body is a URLSearchParams with the form content type', () => {
    const { body, contentType } = RequestBodyEncoder.encode({
      payload: {
        data: { name: 'a b', tags: ['x', 'y'], meta: { id: 1 }, on: false, none: 0, empty: '' },
        type: RequestBodyTypes.FORM_URL_ENCODED,
      },
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
      payload: {
        data: { a: undefined, b: null, at: new Date('2026-01-02T03:04:05.000Z') },
        type: RequestBodyTypes.FORM_URL_ENCODED,
      },
    });

    expect([...(body as URLSearchParams).keys()]).toEqual(['at']);
    expect((body as URLSearchParams).get('at')).toBe('2026-01-02T03:04:05.000Z');
  });

  test('a urlencoded body refuses a file, naming the key and the way out', () => {
    expect(() =>
      RequestBodyEncoder.encode({
        payload: { data: { avatar: new Blob(['x']) }, type: RequestBodyTypes.FORM_URL_ENCODED },
      }),
    ).toThrow('"avatar" is a file');
  });

  test('a multipart body is a FormData with no content type, so fetch sets the boundary', () => {
    const file = new File(['content'], 'a.txt');
    const { body, contentType } = RequestBodyEncoder.encode({
      payload: {
        data: { name: 'a', files: [file, file], meta: { id: 1 }, skip: undefined, zero: 0 },
        type: RequestBodyTypes.FORM_DATA,
      },
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

  test('an array or a string as a form body is read by its indexes, in both form types', () => {
    for (const body of [['a', 'b'], 'ab']) {
      const encoded = RequestBodyEncoder.encode({
        payload: { data: body, type: RequestBodyTypes.FORM_URL_ENCODED },
      });
      const multipart = RequestBodyEncoder.encode({
        payload: { data: body, type: RequestBodyTypes.FORM_DATA },
      });

      expect((encoded.body as URLSearchParams).toString()).toBe('0=a&1=b');
      expect([...(multipart.body as FormData).entries()]).toEqual([
        ['0', 'a'],
        ['1', 'b'],
      ]);
    }
  });

  test('a form body that is a number, a boolean or missing has no entries', () => {
    for (const body of [7, true, null, undefined]) {
      const { body: encoded } = RequestBodyEncoder.encode({
        payload: { data: body, type: RequestBodyTypes.FORM_URL_ENCODED },
      });

      expect((encoded as URLSearchParams).toString()).toBe('');
    }
  });

  test('no FileList in the runtime is not an error', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'FileList');
    Reflect.deleteProperty(globalThis, 'FileList');

    try {
      const { body } = RequestBodyEncoder.encode({
        payload: { data: { name: 'a' }, type: RequestBodyTypes.FORM_DATA },
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
      payload: { data: { a: 1 }, type: RequestBodyTypes.FORM_DATA },
    });
    const formBody: FormData = form.body;
    const encoded = RequestBodyEncoder.encode({
      payload: { data: { a: 1 }, type: RequestBodyTypes.FORM_URL_ENCODED },
    });
    const encodedBody: URLSearchParams = encoded.body;
    const encodedType: string = encoded.contentType;
    const sent = RequestBodyEncoder.encode({
      payload: { data: { id: 7 }, type: RequestBodyTypes.JSON },
    });
    const id: number = sent.body.id;
    const text = RequestBodyEncoder.encode({ payload: { data: 'raw' } });
    const raw: string = text.body;

    expect(write({ body: formBody })).toBeInstanceOf(FormData);
    expect(write({ body: encodedBody })).toBeInstanceOf(URLSearchParams);
    expect(encodedType).toBe('application/x-www-form-urlencoded');
    expect([id, raw]).toEqual([7, 'raw']);

    // A body type known only as a string cannot say what was built, so it stays `unknown`.
    const anyType: string = RequestBodyTypes.FORM_DATA;
    const wide = RequestBodyEncoder.encode({ payload: { data: {}, type: anyType } });
    // @ts-expect-error - `unknown` is not `string | object`: a wide body type needs a narrowing
    write({ body: wide.body });
    // @ts-expect-error - a FormData is not a string body
    const notString: string = form.body;

    expect(wide.body).toBeInstanceOf(FormData);
    expect(notString).toBeInstanceOf(FormData);
  });
});

describe('RequestBodyEncoder.assertPayload', () => {
  const check = (options: object) => () =>
    RequestBodyEncoder.assertPayload({ options, owner: 'Owner' });

  test.each([
    [{ body: { a: 1 } }, 'body was replaced'],
    [{ body: { data: 1 } }, 'body was replaced'],
    [{ body: undefined }, 'body was replaced'],
    [{ bodyType: 'json' }, 'bodyType was replaced'],
    [{ body: 1, bodyType: 'json' }, 'body and bodyType were replaced'],
  ])('refuses the removed keys of %p', (options, message) => {
    expect(check(options)).toThrow(`[Owner] ${message} by payload: { data, type }`);
  });

  test.each([
    [{ name: 'x' }, 'shape (no data)'],
    [{ data: 1, name: 'x' }, 'shape (unknown key name)'],
    [new FormData(), 'shape (no data)'],
    [['a'], 'shape (got an array)'],
    ['text', 'shape (got a string)'],
    [null, 'shape (got null)'],
    [{ data: 1, type: 2 }, 'type'],
  ])('refuses the payload %p', (payload, problem) => {
    expect(check({ payload })).toThrow(`[Owner] payload takes { data, type? }: invalid ${problem}`);
  });

  test.each([
    {},
    { payload: undefined },
    { payload: { data: undefined } },
    { payload: { data: [1], type: RequestBodyTypes.FORM_DATA } },
  ])('accepts %p', (options) => {
    expect(check(options)).not.toThrow();
  });

  test('a type of your own passes, for an override of encodeBody', () => {
    expect(check({ payload: { data: 1, type: 'xml' } })).not.toThrow();
  });

  test('encode refuses the removed keys', () => {
    const options = { payload: { data: 1 }, ...{ bodyType: 'json' } };

    expect(() => RequestBodyEncoder.encode(options)).toThrow(
      '[RequestBodyEncoder] bodyType was replaced',
    );
  });
});
