export class ValueUtility {
  /** Positional on purpose: a type predicate narrows its own parameter. */
  static isDefined<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== undefined && value !== null;
  }

  /** Positional on purpose: a type predicate narrows its own parameter. */
  static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /** A number, or a string that reads as a finite number. */
  static isNumber(opts: { value: unknown }): boolean {
    const { value } = opts;

    if (typeof value !== 'string' && typeof value !== 'number') {
      return false;
    }

    return !Number.isNaN(Number.parseFloat(String(value))) && Number.isFinite(Number(value));
  }

  static isObject(opts: { value: unknown }): boolean {
    const { value } = opts;
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  static isValidDate(opts: { value: string | number | Date }): boolean {
    const date = new Date(opts.value);
    return !Number.isNaN(date.valueOf());
  }
}

/** @deprecated Use `ValueUtility.isDefined`. Removed in 0.5. */
export const isDefined = ValueUtility.isDefined;

/** @deprecated Use `ValueUtility.isString`. Removed in 0.5. */
export const isString = ValueUtility.isString;

/** @deprecated Use `ValueUtility.isNumber`. Removed in 0.5. */
export const isNumber = ValueUtility.isNumber;

/** @deprecated Use `ValueUtility.isObject`. Removed in 0.5. */
export const isObject = ValueUtility.isObject;

/** @deprecated Use `ValueUtility.isValidDate`. Removed in 0.5. */
export const isValidDate = ValueUtility.isValidDate;
