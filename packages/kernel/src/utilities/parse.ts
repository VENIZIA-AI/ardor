import round from 'lodash/round.js';

import { type AnyType, type TConstValue } from '@/common';

export class NumberParseMethods {
  static readonly INT = 'int';
  static readonly FLOAT = 'float';

  static readonly SCHEME_SET = new Set([this.INT, this.FLOAT]);

  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}

export type TNumberParseMethod = TConstValue<typeof NumberParseMethods>;

export const INTL_0_DIGITS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export const INTL_2_DIGITS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export const generateUniqueId = (): string => Math.random().toString(36).slice(2).toUpperCase();

export const toCamelCase = (opts: { value: string }): string => {
  return opts.value.replace(/([-_][a-z])/gi, (match: string) => {
    return match.toUpperCase().replace('-', '').replace('_', '');
  });
};

/** Nested objects are converted; an array is kept as it is. */
export const keysToCamelCase = (opts: { value: object }): Record<string, AnyType> => {
  const converted: Record<string, AnyType> = {};

  for (const [key, child] of Object.entries(opts.value)) {
    const isNestedObject = typeof child === 'object' && child !== null && !Array.isArray(child);

    converted[toCamelCase({ value: key })] = isNestedObject
      ? keysToCamelCase({ value: child })
      : child;
  }

  return converted;
};

export const isInteger = (opts: { value: unknown }): boolean => {
  const { value } = opts;

  if (Number.isNaN(value)) {
    return false;
  }

  return Number.isInteger(value) || Math.floor(Number(value)) === value || Number(value) % 1 === 0;
};

export const isFloat = (opts: { value: unknown }): boolean => {
  const { value } = opts;

  if (Number.isNaN(value)) {
    return false;
  }

  return value === Number(value) && value !== Math.trunc(Number(value));
};

/** Thousands separators are stripped; anything that is not a number reads as `0`. */
export const toInteger = (opts: { value: unknown }): number => {
  const { value } = opts;

  if (!value || Number.isNaN(value)) {
    return 0;
  }

  return Number.parseInt(String(value).replace(/,/g, ''), 10);
};

/** Thousands separators are stripped; anything that is not a number reads as `0`. */
export const toFloat = (opts: { value: unknown; digits?: number }): number => {
  const { value, digits = 2 } = opts;

  if (!value || Number.isNaN(value)) {
    return 0;
  }

  return round(Number.parseFloat(String(value).replace(/,/g, '')), digits);
};

export const toBoolean = (opts: { value: unknown }): boolean => {
  const { value } = opts;

  return (
    value !== 'false' &&
    value !== '0' &&
    value !== false &&
    value !== 0 &&
    value !== null &&
    value !== undefined
  );
};

export const toStringDecimal = (opts: {
  value: unknown;
  digits?: number;
  localeFormat?: boolean;
}): string | number => {
  const { value, digits = 2, localeFormat = true } = opts;

  if (Number.isNaN(value)) {
    return 0;
  }

  const number = isInteger({ value }) ? toInteger({ value }) : toFloat({ value, digits });

  if (!localeFormat) {
    return number.toFixed(digits);
  }

  if (Number.isInteger(number)) {
    return INTL_0_DIGITS_FORMATTER.format(number);
  }

  if (digits === 2) {
    return INTL_2_DIGITS_FORMATTER.format(number);
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(number);
};

/** Thousands separators and dots are stripped before parsing, so `'1.234'` reads as `1234`. */
export const getNumberValue = (opts: { input: string; method?: TNumberParseMethod }): number => {
  const { input, method = NumberParseMethods.INT } = opts;

  if (!input) {
    return 0;
  }

  const raw = typeof input === 'string' ? input.replace(/,|\./gi, '') : input;

  switch (method) {
    case NumberParseMethods.FLOAT: {
      return toFloat({ value: raw });
    }
    default: {
      return toInteger({ value: raw });
    }
  }
};
