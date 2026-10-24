import { isDefined } from './boolean';

/** `undefined` and `null` are dropped, numbers and strings are kept, anything else is JSON-encoded. */
export const toQueryString = (opts: { params: Record<string | symbol, unknown> }): string => {
  const { params } = opts;
  const normalized: Record<string, string> = {};

  for (const key in params) {
    const value = params[key];
    if (!isDefined(value)) {
      continue;
    }

    normalized[key] =
      typeof value === 'number' || typeof value === 'string'
        ? String(value)
        : JSON.stringify(value);
  }

  return new URLSearchParams(normalized).toString();
};
