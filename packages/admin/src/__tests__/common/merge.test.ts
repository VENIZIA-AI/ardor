import { describe, expect, test } from 'bun:test';
import type { StringMap } from 'ra-core';

import { mergeMessages } from '@/common/merge';

const merge = (...sources: object[]) => {
  const target: StringMap = {};
  const skipped = mergeMessages({ target, sources });

  return { target, skipped };
};

describe('mergeMessages', () => {
  test('merges groups recursively, and a later source wins', () => {
    const { target, skipped } = merge(
      { ra: { action: { add: 'Add', save: 'Save' } }, title: 'A' },
      { ra: { action: { add: 'Create' }, page: { list: 'List' } } },
    );

    expect(target).toEqual({
      ra: { action: { add: 'Create', save: 'Save' }, page: { list: 'List' } },
      title: 'A',
    });
    expect(skipped).toEqual([]);
  });

  test('writes into the target and leaves every source as it was', () => {
    const first = { ra: { action: { add: 'Add' } } };
    const second = { ra: { action: { save: 'Save' } } };

    const { target } = merge(first, second);

    expect(first).toEqual({ ra: { action: { add: 'Add' } } });
    expect(second).toEqual({ ra: { action: { save: 'Save' } } });
    expect(target.ra).not.toBe(first.ra);
  });

  test('leaves out what does not fit, naming each dotted key', () => {
    const { target, skipped } = merge(
      { a: 'x', b: { c: 'y' } },
      { a: { d: 'z' }, b: 'gone' },
      { b: { c: ['y'], e: 1, f: null } },
    );

    expect(target).toEqual({ a: 'x', b: { c: 'y' } });
    expect(skipped).toEqual(['a', 'b', 'b.c', 'b.e', 'b.f']);
  });

  test('an undefined value does not overwrite a value that is there', () => {
    const { target, skipped } = merge(
      { a: 'x', b: { c: 'y' } },
      { a: undefined, b: { c: undefined } },
    );

    expect(target).toEqual({ a: 'x', b: { c: 'y' } });
    expect(skipped).toEqual([]);
  });

  test('does not carry a __proto__ key into the result', () => {
    const polluted: object = JSON.parse('{"__proto__": {"injected": "yes"}, "ok": "fine"}');

    const { target } = merge(polluted);

    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
    expect(Reflect.get(target, 'injected')).toBeUndefined();
    expect(target.ok).toBe('fine');
    expect(Reflect.get({}, 'injected')).toBeUndefined();
  });

  test('takes a key a prototype also names as a new key', () => {
    const { target, skipped } = merge({ constructor: 'Builder' });

    expect(Object.hasOwn(target, 'constructor')).toBe(true);
    expect(skipped).toEqual([]);
  });

  test('leaves the target as it is for no sources', () => {
    expect(merge().target).toEqual({});
  });
});
