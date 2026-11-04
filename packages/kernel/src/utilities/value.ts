/** Checks of a value's kind. */
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

  /** A non-null object that is not an array. */
  static isObject(opts: { value: unknown }): boolean {
    const { value } = opts;

    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** Whether `new Date(value)` is a valid date; takes a string, a number or a `Date`. */
  static isValidDate(opts: { value: string | number | Date }): boolean {
    const date = new Date(opts.value);

    return !Number.isNaN(date.valueOf());
  }
}
