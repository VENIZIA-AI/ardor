import { describe, expect, test } from 'bun:test';

import { StorageAreas } from '@/common';
import {
  FakeClipboard,
  FakeIntersectionObserver,
  FakeMatchMedia,
  FakeResizeObserver,
  FakeStorage,
} from '@/testing';

const targetOf = (): Element => {
  const target: unknown = { tagName: 'DIV' };

  return target as Element;
};

describe('FakeResizeObserver', () => {
  test('install swaps the global observer and the returned function puts the previous one back', () => {
    const previous = Reflect.get(globalThis, 'ResizeObserver');

    const restore = FakeResizeObserver.install();
    expect(Reflect.get(globalThis, 'ResizeObserver')).toBe(FakeResizeObserver);

    restore();
    expect(Reflect.get(globalThis, 'ResizeObserver')).toBe(previous);
  });

  test('flush calls an observer of the element once, with the size in every box', () => {
    const restore = FakeResizeObserver.install();
    const element = targetOf();
    const received: Array<ResizeObserverEntry> = [];
    new ResizeObserver((entries) => received.push(...entries)).observe(element);

    FakeResizeObserver.flush({ element, width: 120, height: 40 });

    expect(received).toHaveLength(1);
    const [entry] = received;
    expect(entry?.target).toBe(element);
    expect(entry?.contentRect.width).toBe(120);
    expect(entry?.contentRect.height).toBe(40);
    expect(entry?.borderBoxSize[0]).toEqual({ inlineSize: 120, blockSize: 40 });
    expect(entry?.contentBoxSize[0]).toEqual({ inlineSize: 120, blockSize: 40 });
    restore();
  });

  test('flush skips an element nobody observes, one that was unobserved and a disconnected observer', () => {
    const restore = FakeResizeObserver.install();
    const watched = targetOf();
    const other = targetOf();
    const calls: Array<string> = [];
    const first = new ResizeObserver(() => calls.push('first'));
    const second = new ResizeObserver(() => calls.push('second'));
    first.observe(watched);
    first.unobserve(watched);
    second.observe(watched);
    second.disconnect();

    FakeResizeObserver.flush({ element: watched, width: 1, height: 1 });
    FakeResizeObserver.flush({ element: other, width: 1, height: 1 });

    expect(calls).toEqual([]);
    restore();
  });

  test('flush reaches every observer of the same element', () => {
    const restore = FakeResizeObserver.install();
    const element = targetOf();
    const calls: Array<string> = [];
    new ResizeObserver(() => calls.push('a')).observe(element);
    new ResizeObserver(() => calls.push('b')).observe(element);

    FakeResizeObserver.flush({ element, width: 5, height: 5 });

    expect(calls).toEqual(['a', 'b']);
    restore();
  });

  test('observing an element again records nothing more, as the real observer ignores it', () => {
    const restore = FakeResizeObserver.install();
    const element = targetOf();
    const calls: Array<string> = [];
    const observer = new ResizeObserver(() => calls.push('a'));

    observer.observe(element, { box: 'border-box' });
    observer.observe(element);
    observer.unobserve(element);
    FakeResizeObserver.flush({ element, width: 1, height: 1 });

    expect(calls).toEqual([]);
    expect(FakeResizeObserver.all[0]?.options).toEqual([{ box: 'border-box' }]);
    restore();
  });

  test('install forgets the observers of an earlier install', () => {
    const restoreFirst = FakeResizeObserver.install();
    const element = targetOf();
    const calls: Array<string> = [];
    new ResizeObserver(() => calls.push('stale')).observe(element);
    restoreFirst();

    const restore = FakeResizeObserver.install();
    FakeResizeObserver.flush({ element, width: 5, height: 5 });

    expect(calls).toEqual([]);
    expect(FakeResizeObserver.all).toEqual([]);
    restore();
  });

  test('all, targets, options, unobserved and isDisconnected can be read', () => {
    const restore = FakeResizeObserver.install();
    const first = targetOf();
    const second = targetOf();

    const callback = () => {};

    const observer = new ResizeObserver(callback);

    observer.observe(first, { box: 'border-box' });
    observer.observe(second);
    observer.unobserve(first);

    const [fake] = FakeResizeObserver.all;
    expect(FakeResizeObserver.all).toHaveLength(1);
    expect(fake?.callback).toBe(callback);
    expect(fake?.targets).toEqual([second]);
    expect(fake?.options).toEqual([{ box: 'border-box' }, undefined]);
    expect(fake?.unobserved).toEqual([first]);
    expect(fake?.isDisconnected).toBe(false);

    observer.disconnect();
    expect(fake?.isDisconnected).toBe(true);
    expect(fake?.targets).toEqual([]);
    restore();
  });
});

describe('FakeIntersectionObserver', () => {
  test('install swaps the global observer and the returned function puts the previous one back', () => {
    const previous = Reflect.get(globalThis, 'IntersectionObserver');

    const restore = FakeIntersectionObserver.install();
    expect(Reflect.get(globalThis, 'IntersectionObserver')).toBe(FakeIntersectionObserver);

    restore();
    expect(Reflect.get(globalThis, 'IntersectionObserver')).toBe(previous);
  });

  test('records the observers, their options and their elements', () => {
    const restore = FakeIntersectionObserver.install();
    const first = targetOf();
    const second = targetOf();
    const observer = new IntersectionObserver(() => {}, { rootMargin: '10px', threshold: 0.5 });

    observer.observe(first);
    observer.observe(second);
    observer.unobserve(first);

    const [fake] = FakeIntersectionObserver.all;
    expect(fake?.options).toEqual({ rootMargin: '10px', threshold: 0.5 });
    expect(fake?.targets).toEqual([second]);
    expect(observer.takeRecords()).toEqual([]);

    observer.disconnect();
    expect(fake?.isDisconnected).toBe(true);
    expect(fake?.targets).toEqual([]);
    restore();
  });

  test('flush delivers one entry to each observer of the element, with the ratio 1, 0 or the given one', () => {
    const restore = FakeIntersectionObserver.install();
    const element = targetOf();
    const other = targetOf();
    const received: Array<IntersectionObserverEntry> = [];
    new IntersectionObserver((entries) => received.push(...entries)).observe(element);
    new IntersectionObserver((entries) => received.push(...entries)).observe(other);

    FakeIntersectionObserver.flush({ element, isIntersecting: true });
    FakeIntersectionObserver.flush({ element, isIntersecting: false });
    FakeIntersectionObserver.flush({ element, isIntersecting: true, ratio: 0.4 });

    expect(
      received.map((entry) => [entry.target, entry.isIntersecting, entry.intersectionRatio]),
    ).toEqual([
      [element, true, 1],
      [element, false, 0],
      [element, true, 0.4],
    ]);
    restore();
  });

  test('install forgets the observers of an earlier install', () => {
    const restoreFirst = FakeIntersectionObserver.install();
    new IntersectionObserver(() => {});
    restoreFirst();

    const restore = FakeIntersectionObserver.install();

    expect(FakeIntersectionObserver.all).toEqual([]);
    restore();
  });
});

describe('FakeMatchMedia', () => {
  test('install answers a list per query, false until set, and the returned function puts the previous matchMedia back', () => {
    const previous = Reflect.get(globalThis, 'matchMedia');
    const restore = FakeMatchMedia.install();
    const matchMedia = Reflect.get(globalThis, 'matchMedia');

    const list = matchMedia('(min-width: 600px)');

    expect(list.matches).toBe(false);
    expect(list.media).toBe('(min-width: 600px)');
    expect(matchMedia('(min-width: 600px)')).toBe(list);
    expect([...FakeMatchMedia.queries.keys()]).toEqual(['(min-width: 600px)']);

    restore();
    expect(Reflect.get(globalThis, 'matchMedia')).toBe(previous);
  });

  test('set changes the answer and tells the listeners of that query only', () => {
    const restore = FakeMatchMedia.install();
    const matchMedia = Reflect.get(globalThis, 'matchMedia');
    const seen: Array<string> = [];
    matchMedia('(a)').addEventListener('change', () => seen.push('a'));
    matchMedia('(b)').addEventListener('change', () => seen.push('b'));

    FakeMatchMedia.set({ query: '(a)', matches: true });

    expect(matchMedia('(a)').matches).toBe(true);
    expect(matchMedia('(b)').matches).toBe(false);
    expect(seen).toEqual(['a']);
    restore();
  });

  test('set before anyone asks makes the list with that answer; install forgets the queries', () => {
    const restore = FakeMatchMedia.install();

    FakeMatchMedia.set({ query: '(early)', matches: true });
    expect(Reflect.get(globalThis, 'matchMedia')('(early)').matches).toBe(true);

    restore();
    const again = FakeMatchMedia.install();
    expect(FakeMatchMedia.queries.size).toBe(0);
    again();
  });
});

describe('FakeStorage', () => {
  test('stores strings as own keys, like the real one, and counts what it accepted', () => {
    const storage = new FakeStorage();

    storage.setItem('a', '1');
    storage.setItem('b', 2 as unknown as string);

    expect(storage.getItem('a')).toBe('1');
    expect(storage.getItem('b')).toBe('2');
    expect(storage.getItem('missing')).toBeNull();
    expect(Object.keys(storage)).toEqual(['a', 'b']);
    expect(storage.length).toBe(2);
    expect(storage.key(1)).toBe('b');
    expect(storage.key(5)).toBeNull();
    expect(storage.writes).toEqual(['1', '2']);

    storage.removeItem('a');
    expect(Object.keys(storage)).toEqual(['b']);

    storage.clear();
    expect(storage.length).toBe(0);
  });

  test('a key named like a member of the fake is refused, whatever the member, and other names are stored', () => {
    const storage = new FakeStorage();

    for (const key of [
      'getItem',
      'setItem',
      'removeItem',
      'clear',
      'key',
      'length',
      'install',
      'writes',
      'failReads',
      'failWrites',
    ]) {
      expect(() => storage.setItem(key, 'x')).toThrow(TypeError);
    }

    storage.setItem('hasOwnProperty', 'y');
    storage.setItem('toString', 'z');
    storage.failWrites = true;
    expect(storage.getItem('hasOwnProperty')).toBe('y');
    expect(() => storage.setItem('c', '1')).toThrow(
      expect.objectContaining({ name: 'QuotaExceededError' }),
    );
    expect(storage.writes).toEqual(['y', 'z']);
  });

  test('failWrites makes setItem throw QuotaExceededError and removeItem throw SecurityError, and writes can resume', () => {
    const storage = new FakeStorage();
    storage.setItem('a', '1');
    storage.failWrites = true;

    expect(() => storage.setItem('b', '2')).toThrow(
      expect.objectContaining({ name: 'QuotaExceededError' }),
    );
    expect(() => storage.removeItem('a')).toThrow(
      expect.objectContaining({ name: 'SecurityError' }),
    );
    expect(() => storage.clear()).toThrow(expect.objectContaining({ name: 'QuotaExceededError' }));
    expect(storage.getItem('a')).toBe('1');
    expect(storage.writes).toEqual(['1']);

    storage.failWrites = false;
    storage.setItem('b', '2');
    expect(storage.getItem('b')).toBe('2');
  });

  test('failReads makes every read throw SecurityError', () => {
    const storage = new FakeStorage();
    storage.setItem('a', '1');
    storage.failReads = true;

    expect(() => storage.getItem('a')).toThrow(expect.objectContaining({ name: 'SecurityError' }));
    expect(() => storage.key(0)).toThrow(expect.objectContaining({ name: 'SecurityError' }));
    expect(() => storage.length).toThrow(expect.objectContaining({ name: 'SecurityError' }));
  });

  test('install makes it the localStorage or the sessionStorage, and restores the previous one', () => {
    const storage = new FakeStorage();
    const previous = Reflect.get(globalThis, 'localStorage');

    const restore = storage.install();
    expect(Reflect.get(globalThis, 'localStorage')).toBe(storage);

    const restoreSession = storage.install(StorageAreas.SESSION);
    expect(Reflect.get(globalThis, 'sessionStorage')).toBe(storage);

    restore();
    restoreSession();
    expect(Reflect.get(globalThis, 'localStorage')).toBe(previous);
    expect(Reflect.get(globalThis, 'sessionStorage')).not.toBe(storage);
  });
});

describe('FakeClipboard', () => {
  test('keeps the written text, answers it back, and installs on navigator.clipboard', async () => {
    const clipboard = new FakeClipboard();
    const restore = clipboard.install();

    await globalThis.navigator.clipboard.writeText('one');
    await globalThis.navigator.clipboard.writeText('two');

    expect(clipboard.written).toEqual(['one', 'two']);
    const result = await globalThis.navigator.clipboard.readText();
    expect(result).toBe('two');

    restore();
    expect(globalThis.navigator.clipboard).not.toBe(clipboard);
  });

  test('isDenied makes both methods reject with NotAllowedError and keeps nothing', async () => {
    const clipboard = new FakeClipboard();
    clipboard.isDenied = true;

    const outcomes = await Promise.allSettled([clipboard.writeText('x'), clipboard.readText()]);

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'rejected']);
    expect(
      outcomes.map((outcome) => (outcome.status === 'rejected' ? outcome.reason.name : '')),
    ).toEqual(['NotAllowedError', 'NotAllowedError']);
    expect(clipboard.written).toEqual([]);
  });
});
