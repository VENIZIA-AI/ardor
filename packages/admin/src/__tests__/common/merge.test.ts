import { describe, expect, test } from 'bun:test';

import { deepMerge } from '@/common/merge';

describe('deepMerge', () => {
  test('merges plain objects recursively, and a later source wins', () => {
    const merged = deepMerge({
      sources: [
        { ra: { action: { add: 'Add', save: 'Save' } }, title: 'A' },
        { ra: { action: { add: 'Create' }, page: { list: 'List' } } },
      ],
    });

    expect(merged).toEqual({
      ra: { action: { add: 'Create', save: 'Save' }, page: { list: 'List' } },
      title: 'A',
    });
  });

  test('returns a new object and leaves every source as it was', () => {
    const first = { ra: { action: { add: 'Add' } } };
    const second = { ra: { action: { save: 'Save' } } };

    const merged = deepMerge({ sources: [first, second] });

    expect(merged).not.toBe(first);
    expect(first).toEqual({ ra: { action: { add: 'Add' } } });
    expect(second).toEqual({ ra: { action: { save: 'Save' } } });
    expect(merged.ra).not.toBe(first.ra);
  });

  test('replaces an array or a string by the later value, and an object by a string', () => {
    expect(
      deepMerge({
        sources: [
          { a: [1, 2], b: 'x', c: { d: 1 } },
          { a: [3], b: 'y', c: 'z' },
        ],
      }),
    ).toEqual({
      a: [3],
      b: 'y',
      c: 'z',
    });
  });

  test('an undefined value does not overwrite a value that is there', () => {
    expect(
      deepMerge({
        sources: [
          { a: 'x', b: { c: 'y' } },
          { a: undefined, b: { c: undefined } },
        ],
      }),
    ).toEqual({
      a: 'x',
      b: { c: 'y' },
    });
  });

  test('does not carry a __proto__ key into the result', () => {
    const polluted: object = JSON.parse('{"__proto__": {"injected": "yes"}, "ok": "fine"}');

    const merged = deepMerge({ sources: [polluted] });

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Reflect.get(merged, 'injected')).toBeUndefined();
    expect(merged.ok).toBe('fine');
    expect(Reflect.get({}, 'injected')).toBeUndefined();
  });

  test('answers an empty object for no sources', () => {
    expect(deepMerge({ sources: [] })).toEqual({});
  });
});
