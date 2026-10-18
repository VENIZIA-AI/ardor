/** A type guard keeps one positional argument: an options object would lose the narrowing. */
export const isDefined = <TValue>(value: TValue | null | undefined): value is TValue => {
  return value !== undefined && value !== null;
};

export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

/** A number, or a string that reads as a finite number. */
export const isNumber = (opts: { value: unknown }): boolean => {
  const { value } = opts;

  if (typeof value !== 'string' && typeof value !== 'number') {
    return false;
  }

  return !Number.isNaN(Number.parseFloat(String(value))) && Number.isFinite(Number(value));
};

export const isObject = (opts: { value: unknown }): boolean => {
  const { value } = opts;
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

export const isValidDate = (opts: { value: string | number | Date }): boolean => {
  const date = new Date(opts.value);
  return !Number.isNaN(date.valueOf());
};

export const isEditableTarget = (opts: { target: EventTarget | null }): boolean => {
  const { target } = opts;

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
};
