import { describe, expect, test } from 'bun:test';
import {
  isBrowser,
  isDefined,
  isNumber,
  isObject,
  isString,
  isValidDate,
} from '@/utilities/boolean';
import { toQueryString } from '@/utilities/url';
import { rejectionOf } from '@/__tests__/rejection';
import { toDataUrl } from '@/utilities/file';

describe('boolean utilities', () => {
  test('isDefined rejects null and undefined only', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
    expect(isDefined(0)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined(NaN)).toBe(true);
    expect(isDefined({})).toBe(true);
    expect(isDefined([])).toBe(true);
  });

  test('isString accepts string values and rejects non-string values', () => {
    expect(isString('ARDOR')).toBe(true);
    expect(isString('')).toBe(true);
    expect(isString(123)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString({})).toBe(false);
    expect(isString([])).toBe(false);
  });

  test('isNumber accepts numbers and numeric strings while rejecting NaN and alphabetic strings', () => {
    expect(isNumber({ value: 123 })).toBe(true);
    expect(isNumber({ value: 0 })).toBe(true);
    expect(isNumber({ value: -45.67 })).toBe(true);
    expect(isNumber({ value: '123' })).toBe(true);
    expect(isNumber({ value: '0' })).toBe(true);
    expect(isNumber({ value: '-45.67' })).toBe(true);
    expect(isNumber({ value: NaN })).toBe(false);
    expect(isNumber({ value: 'abc' })).toBe(false);
    expect(isNumber({ value: null })).toBe(false);
    expect(isNumber({ value: undefined })).toBe(false);
  });

  test('isObject accepts plain objects and rejects arrays and null', () => {
    expect(isObject({ value: {} })).toBe(true);
    expect(isObject({ value: { framework: 'ARDOR' } })).toBe(true);
    expect(isObject({ value: [] })).toBe(false);
    expect(isObject({ value: ['ARDOR', 'IGNIS'] })).toBe(false);
    expect(isObject({ value: null })).toBe(false);
    expect(isObject({ value: undefined })).toBe(false);
    expect(isObject({ value: 'ARDOR' })).toBe(false);
    expect(isObject({ value: 42 })).toBe(false);
  });

  test('isValidDate validates dates and timestamp inputs while rejecting invalid dates', () => {
    expect(isValidDate({ value: new Date() })).toBe(true);
    expect(isValidDate({ value: '2024-01-01T00:00:00.000Z' })).toBe(true);
    expect(isValidDate({ value: 1704067200000 })).toBe(true);
    expect(isValidDate({ value: 'invalid-date-string' })).toBe(false);
  });

  test('isBrowser is false without a window', () => {
    const hadWindow = Reflect.has(globalThis, 'window');
    const originalWindow = Reflect.get(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'window');

    expect(isBrowser()).toBe(false);

    if (hadWindow) {
      Reflect.set(globalThis, 'window', originalWindow);
    }
  });
});

describe('URL utilities', () => {
  test('toQueryString drops undefined and null, keeps numbers and strings, and JSON-encodes objects and arrays', () => {
    const payload = {
      brand: 'ARDOR',
      system: 'IGNIS',
      count: 42,
      emptyValue: null,
      missingValue: undefined,
      metadata: { debug: true, retries: 3 },
      scopes: ['read', 'write'],
    };

    const serialized = toQueryString({ params: payload });
    const parsed = new URLSearchParams(serialized);

    expect(parsed.get('brand')).toBe('ARDOR');
    expect(parsed.get('system')).toBe('IGNIS');
    expect(parsed.get('count')).toBe('42');
    expect(parsed.has('emptyValue')).toBe(false);
    expect(parsed.has('missingValue')).toBe(false);
    expect(parsed.get('metadata')).toBe(JSON.stringify({ debug: true, retries: 3 }));
    expect(parsed.get('scopes')).toBe(JSON.stringify(['read', 'write']));
  });
});

describe('file utilities', () => {
  // Bun has no FileReader, so a stub stands in: it reports a result (or an error) on the next tick,
  // like the browser's. The suite also removes Promise.withResolvers (ES2024), which a Chrome 101
  // WebView lacks, to prove toDataUrl does not need it.
  type TStubReaderOptions = { fail?: boolean; text: string };

  const withStubReader = async (
    opts: TStubReaderOptions,
    run: () => Promise<void>,
  ): Promise<void> => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const originalReader = globals.FileReader;
    const originalWithResolvers = (Promise as unknown as Record<string, unknown>).withResolvers;

    class StubFileReader {
      result: string | null = null;
      onloadend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;

      readAsDataURL(blob: Blob) {
        queueMicrotask(() => {
          if (opts.fail) {
            this.onerror?.(new Error('read failed'));
            return;
          }
          this.result = `data:${blob.type};base64,${Buffer.from(opts.text).toString('base64')}`;
          this.onloadend?.();
        });
      }
    }

    globals.FileReader = StubFileReader;
    delete (Promise as unknown as Record<string, unknown>).withResolvers;

    try {
      await run();
    } finally {
      globals.FileReader = originalReader;
      (Promise as unknown as Record<string, unknown>).withResolvers = originalWithResolvers;
    }
  };

  test('toDataUrl resolves a data URL for a Blob, without Promise.withResolvers', async () => {
    await withStubReader({ text: 'ARDOR test content' }, async () => {
      expect(typeof (Promise as unknown as Record<string, unknown>).withResolvers).toBe(
        'undefined',
      );

      const blob = new Blob(['ARDOR test content'], { type: 'text/plain' });
      const dataUrl = await toDataUrl({ blob });

      expect(dataUrl.startsWith('data:text/plain')).toBe(true);
      expect(dataUrl.endsWith(`;base64,${btoa('ARDOR test content')}`)).toBe(true);
    });
  });

  test('toDataUrl rejects when the reader fails', async () => {
    await withStubReader({ fail: true, text: '' }, async () => {
      const blob = new Blob(['ARDOR test content'], { type: 'text/plain' });
      const error = await rejectionOf(toDataUrl({ blob }));

      expect((error as Error).message).toBe('read failed');
    });
  });
});
