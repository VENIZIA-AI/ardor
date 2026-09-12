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
  float,
  getNumberValue,
  getUID,
  int,
  keysToCamel,
  toBoolean,
  toCamel,
  toStringDecimal,
} from '@/utilities/parse';
import { parse, stringify } from '@/utilities/url';
import { blobToBase64 } from '@/utilities/file';

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

  test('isNumber loose accepts numeric strings and numbers while rejecting NaN and alphabetic strings', () => {
    expect(isNumber(123)).toBe(true);
    expect(isNumber(0)).toBe(true);
    expect(isNumber(-45.67)).toBe(true);
    expect(isNumber('123')).toBe(true);
    expect(isNumber('0')).toBe(true);
    expect(isNumber('-45.67')).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber('abc')).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
  });

  test('isNumber exact accepts numbers only and rejects numeric strings', () => {
    expect(isNumber(123, true)).toBe(true);
    expect(isNumber(0, true)).toBe(true);
    expect(isNumber(-45.67, true)).toBe(true);
    expect(isNumber('123', true)).toBe(false);
    expect(isNumber('0', true)).toBe(false);
    expect(isNumber('-45.67', true)).toBe(false);
    expect(isNumber(null, true)).toBe(false);
  });

  test('isObject accepts plain objects and rejects arrays and null', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ framework: 'ARDOR' })).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(['ARDOR', 'IGNIS'])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject('ARDOR')).toBe(false);
    expect(isObject(42)).toBe(false);
  });

  test('isValidDate validates dates and timestamp inputs while rejecting invalid dates', () => {
    expect(isValidDate(new Date())).toBe(true);
    expect(isValidDate('2024-01-01T00:00:00.000Z')).toBe(true);
    expect(isValidDate(1704067200000)).toBe(true);
    expect(isValidDate('invalid-date-string')).toBe(false);
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
  test('int strips thousands separators and parses to an integer', () => {
    expect(int('1,234,567')).toBe(1234567);
    expect(int('12,345')).toBe(12345);
    expect(int('42')).toBe(42);
    expect(int(999)).toBe(999);
    expect(int('')).toBe(0);
    expect(int(null)).toBe(0);
    expect(int(undefined)).toBe(0);
  });

  test('float rounds to the given digits', () => {
    expect(float('1,234.567', 2)).toBe(1234.57);
    expect(float('1,234.564', 2)).toBe(1234.56);
    expect(float('10.12345', 3)).toBe(10.123);
    expect(float(10.555, 1)).toBe(10.6);
    expect(float('')).toBe(0);
    expect(float(null)).toBe(0);
    expect(float(undefined)).toBe(0);
  });

  test('toBoolean treats "false", "0", 0, false, null, undefined as false and everything else as true', () => {
    expect(toBoolean('false')).toBe(false);
    expect(toBoolean('0')).toBe(false);
    expect(toBoolean(0)).toBe(false);
    expect(toBoolean(false)).toBe(false);
    expect(toBoolean(null)).toBe(false);
    expect(toBoolean(undefined)).toBe(false);
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('1')).toBe(true);
    expect(toBoolean(1)).toBe(true);
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean('ARDOR')).toBe(true);
    expect(toBoolean({})).toBe(true);
    expect(toBoolean([])).toBe(true);
  });

  test('toStringDecimal formats integers without decimals and floats with two decimals using en-US grouping', () => {
    expect(toStringDecimal(1000)).toBe('1,000');
    expect(toStringDecimal(1000000)).toBe('1,000,000');
    expect(toStringDecimal(1000.5)).toBe('1,000.50');
    expect(toStringDecimal(1234.567)).toBe('1,234.57');
    expect(toStringDecimal(1234.5678, 3)).toBe('1,234.568');
  });

  test('toStringDecimal yields toFixed when localeFormat is false', () => {
    expect(toStringDecimal(1234.5, 2, { localeFormat: false })).toBe('1234.50');
    expect(toStringDecimal(1000, 2, { localeFormat: false })).toBe('1000.00');
    expect(toStringDecimal(1234.5678, 3, { localeFormat: false })).toBe('1234.568');
  });

  test('getNumberValue strips separators and dots', () => {
    expect(getNumberValue('1,234.56')).toBe(123456);
    expect(getNumberValue('1.234.567')).toBe(1234567);
    expect(getNumberValue('1,000', 'int')).toBe(1000);
    expect(getNumberValue('10.50', 'float')).toBe(1050);
    expect(getNumberValue('')).toBe(0);
  });
});

describe('string and object transformation utilities', () => {
  test('toCamel converts kebab and snake keys', () => {
    expect(toCamel('kebab-case-key')).toBe('kebabCaseKey');
    expect(toCamel('snake_case_key')).toBe('snakeCaseKey');
    expect(toCamel('mixed-case_key')).toBe('mixedCaseKey');
    expect(toCamel('alreadyCamel')).toBe('alreadyCamel');
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

    const output = keysToCamel(input);

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

  test('getUID returns an uppercase alphanumeric string', () => {
    const uidFirst = getUID();
    const uidSecond = getUID();

    expect(uidFirst.length).toBeGreaterThan(0);
    expect(uidSecond.length).toBeGreaterThan(0);
    expect(uidFirst).toMatch(/^[A-Z0-9]+$/);
    expect(uidSecond).toMatch(/^[A-Z0-9]+$/);
    expect(uidFirst).not.toBe(uidSecond);
  });
});

describe('URL utilities', () => {
  test('stringify drops undefined and null, keeps numbers and strings, and JSON-encodes objects and arrays', () => {
    const payload = {
      brand: 'ARDOR',
      system: 'IGNIS',
      count: 42,
      emptyValue: null,
      missingValue: undefined,
      metadata: { debug: true, retries: 3 },
      scopes: ['read', 'write'],
    };

    const serialized = stringify(payload);
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

    const serialized = stringify(original);
    const roundTripped = parse(serialized);

    expect(roundTripped).toEqual(original);
  });
});

describe('file utilities', () => {
  // SOURCE BUG: blobToBase64 relies on FileReader which is not defined in Bun test environment
  test.failing('blobToBase64 resolves a data URL for a Blob', async () => {
    const blob = new Blob(['ARDOR test content'], { type: 'text/plain' });
    const dataUrl = await blobToBase64(blob);

    expect(dataUrl).toMatch(/^data:text\/plain;base64,/);
  });
});
