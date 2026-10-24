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
});
