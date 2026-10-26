import { getError } from '@venizia/ignis-inversion';

/**
 * The name `config.js` writes the runtime config under: `window.__APP_CONFIG__`, a record of strings.
 * The preset image writes it at container start, from the environment variables that start with `VITE_`.
 */
export const RUNTIME_CONFIG_GLOBAL = '__APP_CONFIG__';

/** The `normalized.code` of the error `getRuntimeConfig` throws for a required value that is not set; the key is in its `extra.key`. */
export const RUNTIME_CONFIG_REQUIRED_CODE = 'ardor.runtime_config.required';

const readString = (opts: { source: unknown; key: string }): string | undefined => {
  const { source, key } = opts;

  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return undefined;
  }

  // Own keys only: `toString` and `constructor` are not config values.
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return undefined;
  }

  const value: unknown = Reflect.get(source, key);

  return typeof value === 'string' && value !== '' ? value : undefined;
};

interface IRuntimeConfigOptions {
  key: string;
  buildTimeEnv?: Record<string, unknown>;
  defaultValue?: string;
}

/**
 * One config value: the runtime one (`window.__APP_CONFIG__`), else the build-time one
 * (`buildTimeEnv`, passed by the app as `import.meta.env`), else `defaultValue`. Only a non-empty
 * string counts, and a missing global is not an error.
 *
 * With `required: true` the result is a `string`: when all three are absent it throws, naming the
 * key and never a value. The error is an `ApplicationError` with `normalized.code` equal to
 * `RUNTIME_CONFIG_REQUIRED_CODE` and the key in `extra.key`, so a caller tells it from another error
 * without reading the message. Without `required`, the result is `string | undefined`.
 */
export const getRuntimeConfig: {
  (opts: IRuntimeConfigOptions & { required: true }): string;
  (opts: IRuntimeConfigOptions & { required?: boolean }): string | undefined;
} = (opts: IRuntimeConfigOptions & { required?: boolean }): string => {
  const { key, buildTimeEnv, defaultValue, required } = opts;

  const value =
    readString({ source: Reflect.get(globalThis, RUNTIME_CONFIG_GLOBAL), key }) ??
    readString({ source: buildTimeEnv, key }) ??
    defaultValue;

  if (required && value === undefined) {
    throw getError({
      messageCode: RUNTIME_CONFIG_REQUIRED_CODE,
      extra: { key },
      message: `[getRuntimeConfig] '${key}' is required and not set | Write it to config.js (a VITE_ variable of the container, listed in APP_REQUIRED_ENV), or pass it in buildTimeEnv or defaultValue`,
    });
  }

  return value as string;
};
