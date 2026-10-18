/* eslint-disable @typescript-eslint/naming-convention -- the fixtures are snake_case wire objects on purpose: keysToCamel exists to convert them */
import { describe, expect, test } from 'bun:test';
import {
  isBrowser,
  isDefined,
  isNumber,
  isObject,
  isString,
  isValidDate,
} from '@/utilities/boolean';
import {
  generateUniqueId,
  getNumberValue,
  isFloat,
  isInteger,
  keysToCamelCase,
  NumberParseMethods,
  toBoolean,
  toCamelCase,
  toFloat,
  toInteger,
  toStringDecimal,
} from '@/utilities/parse';
import { parseQueryString, toQueryString } from '@/utilities/url';
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

describe('parse utilities', () => {
  test('toInteger strips thousands separators and parses to an integer', () => {
    expect(toInteger({ value: '1,234,567' })).toBe(1234567);
    expect(toInteger({ value: '12,345' })).toBe(12345);
    expect(toInteger({ value: '42' })).toBe(42);
    expect(toInteger({ value: 999 })).toBe(999);
    expect(toInteger({ value: '' })).toBe(0);
    expect(toInteger({ value: null })).toBe(0);
    expect(toInteger({ value: undefined })).toBe(0);
  });

  test('toFloat rounds to the given digits', () => {
    expect(toFloat({ value: '1,234.567', digits: 2 })).toBe(1234.57);
    expect(toFloat({ value: '1,234.564', digits: 2 })).toBe(1234.56);
    expect(toFloat({ value: '10.12345', digits: 3 })).toBe(10.123);
    expect(toFloat({ value: 10.555, digits: 1 })).toBe(10.6);
    expect(toFloat({ value: '' })).toBe(0);
    expect(toFloat({ value: null })).toBe(0);
    expect(toFloat({ value: undefined })).toBe(0);
  });

  test('isInteger and isFloat tell a whole number from a fraction', () => {
    expect(isInteger({ value: 4 })).toBe(true);
    expect(isInteger({ value: '4' })).toBe(true);
    expect(isInteger({ value: 4.5 })).toBe(false);
    expect(isFloat({ value: 4.5 })).toBe(true);
    expect(isFloat({ value: 4 })).toBe(false);
    expect(isFloat({ value: NaN })).toBe(false);
  });

  test('toBoolean treats "false", "0", 0, false, null, undefined as false and everything else as true', () => {
    expect(toBoolean({ value: 'false' })).toBe(false);
    expect(toBoolean({ value: '0' })).toBe(false);
    expect(toBoolean({ value: 0 })).toBe(false);
    expect(toBoolean({ value: false })).toBe(false);
    expect(toBoolean({ value: null })).toBe(false);
    expect(toBoolean({ value: undefined })).toBe(false);
    expect(toBoolean({ value: 'true' })).toBe(true);
    expect(toBoolean({ value: '1' })).toBe(true);
    expect(toBoolean({ value: 1 })).toBe(true);
    expect(toBoolean({ value: true })).toBe(true);
    expect(toBoolean({ value: 'ARDOR' })).toBe(true);
    expect(toBoolean({ value: {} })).toBe(true);
    expect(toBoolean({ value: [] })).toBe(true);
  });

  test('toStringDecimal formats integers without decimals and floats with two decimals using en-US grouping', () => {
    expect(toStringDecimal({ value: 1000 })).toBe('1,000');
    expect(toStringDecimal({ value: 1000000 })).toBe('1,000,000');
    expect(toStringDecimal({ value: 1000.5 })).toBe('1,000.50');
    expect(toStringDecimal({ value: 1234.567 })).toBe('1,234.57');
    expect(toStringDecimal({ value: 1234.5678, digits: 3 })).toBe('1,234.568');
  });

  test('toStringDecimal yields toFixed when localeFormat is false', () => {
    expect(toStringDecimal({ value: 1234.5, localeFormat: false })).toBe('1234.50');
    expect(toStringDecimal({ value: 1000, localeFormat: false })).toBe('1000.00');
    expect(toStringDecimal({ value: 1234.5678, digits: 3, localeFormat: false })).toBe('1234.568');
  });

  test('getNumberValue strips separators and dots, and reads a float when asked', () => {
    expect(getNumberValue({ input: '1,234.56' })).toBe(123456);
    expect(getNumberValue({ input: '1.234.567' })).toBe(1234567);
    expect(getNumberValue({ input: '1,000', method: NumberParseMethods.INT })).toBe(1000);
    expect(getNumberValue({ input: '10.50', method: NumberParseMethods.FLOAT })).toBe(1050);
    expect(getNumberValue({ input: '' })).toBe(0);
  });

  test('NumberParseMethods accepts exactly the two declared methods', () => {
    expect(NumberParseMethods.SCHEME_SET.size).toBe(2);
    expect(NumberParseMethods.isValid('int')).toBe(true);
    expect(NumberParseMethods.isValid('float')).toBe(true);
    expect(NumberParseMethods.isValid('double')).toBe(false);
  });
});

describe('string and object transformation utilities', () => {
  test('toCamelCase converts kebab and snake keys', () => {
    expect(toCamelCase({ value: 'kebab-case-key' })).toBe('kebabCaseKey');
    expect(toCamelCase({ value: 'snake_case_key' })).toBe('snakeCaseKey');
    expect(toCamelCase({ value: 'mixed-case_key' })).toBe('mixedCaseKey');
    expect(toCamelCase({ value: 'alreadyCamel' })).toBe('alreadyCamel');
  });

  test('keysToCamel converts nested objects but leaves arrays untouched', () => {
    const input = {
      ardor_framework: 'ARDOR',
      ignis_engine: {
        engine_version: 2,
        nested_settings: {
          cache_size: 1024,
        },
      },
      raw_array_items: ['first_item', 'second_item', { inner_key: 'value' }],
    };

    const output = keysToCamelCase({ value: input });

    expect(output).toEqual({
      ardorFramework: 'ARDOR',
      ignisEngine: {
        engineVersion: 2,
        nestedSettings: {
          cacheSize: 1024,
        },
      },
      rawArrayItems: ['first_item', 'second_item', { inner_key: 'value' }],
    });
  });

  test('generateUniqueId returns an uppercase alphanumeric string', () => {
    const uidFirst = generateUniqueId();
    const uidSecond = generateUniqueId();

    expect(uidFirst.length).toBeGreaterThan(0);
    expect(uidSecond.length).toBeGreaterThan(0);
    expect(uidFirst).toMatch(/^[A-Z0-9]+$/);
    expect(uidSecond).toMatch(/^[A-Z0-9]+$/);
    expect(uidFirst).not.toBe(uidSecond);
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

  test('parse round-trips a query string into an object', () => {
    const original = {
      framework: 'ARDOR',
      system: 'IGNIS',
      version: '1',
    };

    const serialized = toQueryString({ params: original });
    const roundTripped = parseQueryString({ search: serialized });

    expect(roundTripped).toEqual(original);
  });
});

describe('file utilities', () => {
  // SOURCE BUG: toDataUrl relies on FileReader which is not defined in Bun test environment
  test.failing('toDataUrl resolves a data URL for a Blob', async () => {
    const blob = new Blob(['ARDOR test content'], { type: 'text/plain' });
    const dataUrl = await toDataUrl({ blob });

    expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
  });
});
