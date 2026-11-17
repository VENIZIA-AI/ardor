import { describe, expect, test } from 'bun:test';
import { RejectionHelper } from '@venizia/dev-configs/testing';
import { BrowserUtility, FileUtility, ValueUtility } from '@/utilities';

describe('boolean utilities', () => {
  test('isDefined rejects null and undefined only', () => {
    expect(ValueUtility.isDefined(null)).toBe(false);
    expect(ValueUtility.isDefined(undefined)).toBe(false);
    expect(ValueUtility.isDefined(0)).toBe(true);
    expect(ValueUtility.isDefined('')).toBe(true);
    expect(ValueUtility.isDefined(false)).toBe(true);
    expect(ValueUtility.isDefined(NaN)).toBe(true);
    expect(ValueUtility.isDefined({})).toBe(true);
    expect(ValueUtility.isDefined([])).toBe(true);
  });

  test('isString accepts string values and rejects non-string values', () => {
    expect(ValueUtility.isString('ARDOR')).toBe(true);
    expect(ValueUtility.isString('')).toBe(true);
    expect(ValueUtility.isString(123)).toBe(false);
    expect(ValueUtility.isString(null)).toBe(false);
    expect(ValueUtility.isString(undefined)).toBe(false);
    expect(ValueUtility.isString({})).toBe(false);
    expect(ValueUtility.isString([])).toBe(false);
  });

  test('isNumber accepts numbers and numeric strings while rejecting NaN and alphabetic strings', () => {
    expect(ValueUtility.isNumber({ value: 123 })).toBe(true);
    expect(ValueUtility.isNumber({ value: 0 })).toBe(true);
    expect(ValueUtility.isNumber({ value: -45.67 })).toBe(true);
    expect(ValueUtility.isNumber({ value: '123' })).toBe(true);
    expect(ValueUtility.isNumber({ value: '0' })).toBe(true);
    expect(ValueUtility.isNumber({ value: '-45.67' })).toBe(true);
    expect(ValueUtility.isNumber({ value: NaN })).toBe(false);
    expect(ValueUtility.isNumber({ value: 'abc' })).toBe(false);
    expect(ValueUtility.isNumber({ value: null })).toBe(false);
    expect(ValueUtility.isNumber({ value: undefined })).toBe(false);
  });

  test('isObject accepts plain objects and rejects arrays and null', () => {
    expect(ValueUtility.isObject({ value: {} })).toBe(true);
    expect(ValueUtility.isObject({ value: { framework: 'ARDOR' } })).toBe(true);
    expect(ValueUtility.isObject({ value: [] })).toBe(false);
    expect(ValueUtility.isObject({ value: ['ARDOR', 'IGNIS'] })).toBe(false);
    expect(ValueUtility.isObject({ value: null })).toBe(false);
    expect(ValueUtility.isObject({ value: undefined })).toBe(false);
    expect(ValueUtility.isObject({ value: 'ARDOR' })).toBe(false);
    expect(ValueUtility.isObject({ value: 42 })).toBe(false);
  });

  test('isValidDate validates dates and timestamp inputs while rejecting invalid dates', () => {
    expect(ValueUtility.isValidDate({ value: new Date() })).toBe(true);
    expect(ValueUtility.isValidDate({ value: '2024-01-01T00:00:00.000Z' })).toBe(true);
    expect(ValueUtility.isValidDate({ value: 1704067200000 })).toBe(true);
    expect(ValueUtility.isValidDate({ value: 'invalid-date-string' })).toBe(false);
  });

  test('isBrowser is false without a window', () => {
    const hadWindow = Reflect.has(globalThis, 'window');
    const originalWindow = Reflect.get(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'window');

    expect(BrowserUtility.isBrowser()).toBe(false);

    if (hadWindow) {
      Reflect.set(globalThis, 'window', originalWindow);
    }
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
      const dataUrl = await FileUtility.toDataUrl({ blob });

      expect(dataUrl.startsWith('data:text/plain')).toBe(true);
      expect(dataUrl.endsWith(`;base64,${btoa('ARDOR test content')}`)).toBe(true);
    });
  });

  test('toDataUrl rejects when the reader fails', async () => {
    await withStubReader({ fail: true, text: '' }, async () => {
      const blob = new Blob(['ARDOR test content'], { type: 'text/plain' });
      const error = await RejectionHelper.rejectionOf({ task: FileUtility.toDataUrl({ blob }) });

      expect((error as Error).message).toBe('read failed');
    });
  });
});
