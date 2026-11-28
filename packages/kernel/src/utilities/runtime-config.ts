import { getError } from '@venizia/ignis-inversion';
import type { TNullable } from '@venizia/ignis-helpers/common';
import { RecordUtility } from '@venizia/ignis-helpers/core';

/**
 * The name `config.js` writes the runtime config under: `window.__APP_CONFIG__`, a record of strings.
 * The preset image writes it at container start, from the environment variables that start with `VITE_`.
 */
export const RUNTIME_CONFIG_GLOBAL = '__APP_CONFIG__';

/**
 * The `normalized.code` of the error `RuntimeConfig.getRequired` throws for a value that is not set; the key is in its `extra.key`.
 */
export const RUNTIME_CONFIG_REQUIRED_CODE = 'ardor.runtime_config.required';

/**
 * The `normalized.code` of the error a `transform` of `RuntimeConfig` causes by throwing, or by answering `undefined` or `null` to `getRequired`; the key is in its `extra.key`, the value is never in the error.
 */
export const RUNTIME_CONFIG_INVALID_CODE = 'ardor.runtime_config.invalid';

const readString = (opts: { source: unknown; key: string }): string | undefined => {
  const { source, key } = opts;

  // `read` takes own keys only: `toString` and `constructor` are not config values.
  const value = Array.isArray(source)
    ? undefined
    : RecordUtility.read({ value: source, path: [key] });

  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

interface IRuntimeConfigReadOptions {
  /** The name looked up in `window.__APP_CONFIG__` and in `buildTimeEnv`. */
  key: string;
  /** The build-time source, normally `import.meta.env`. */
  buildTimeEnv?: Record<string, unknown>;
}

const readValue = (opts: IRuntimeConfigReadOptions): string | undefined => {
  const { key, buildTimeEnv } = opts;

  return (
    readString({ source: Reflect.get(globalThis, RUNTIME_CONFIG_GLOBAL), key }) ??
    readString({ source: buildTimeEnv, key })
  );
};

const applyTransform = <TInput, TValue>(opts: {
  key: string;
  raw: TInput;
  transform: (raw: TInput) => TValue;
}): TValue => {
  const { key, raw, transform } = opts;

  try {
    return transform(raw);
  } catch {
    throw getError({
      messageCode: RUNTIME_CONFIG_INVALID_CODE,
      extra: { key },
      message: `[RuntimeConfig] '${key}' is not valid | The transform threw on the value; fix the value in config.js or in the build-time env`,
    });
  }
};

/**
 * Reads configuration a deployment can change without a rebuild.
 */
export class RuntimeConfig {
  /**
   * One config value: the runtime one (`window.__APP_CONFIG__`), else the build-time one
   * (`buildTimeEnv`, passed by the app as `import.meta.env`), else `defaultValue`. A value that is
   * empty or only spaces counts as unset, in both sources, and a missing global is not an error.
   *
   * With `transform` the result is what it makes of the value (a number, a boolean). It is handed
   * `undefined` when the value is unset, and `defaultValue` applies when it answers `undefined` or
   * `null`. A `transform` that throws raises an `ApplicationError` with `normalized.code` equal to
   * `RUNTIME_CONFIG_INVALID_CODE` and the key in `extra.key`, never the value.
   */
  static get(
    opts: IRuntimeConfigReadOptions & { defaultValue: string; transform?: undefined },
  ): string;
  static get(
    opts: IRuntimeConfigReadOptions & { defaultValue?: undefined; transform?: undefined },
  ): string | undefined;
  /**
   * A `transform` that may answer `undefined` or `null` needs the `defaultValue` that then applies. One
   * that throws raises an `ApplicationError` of `RUNTIME_CONFIG_INVALID_CODE`.
   */
  static get<TValue>(
    opts: IRuntimeConfigReadOptions & {
      transform: (raw: string | undefined) => TNullable<TValue>;
      defaultValue: TValue;
    },
  ): TValue;
  /**
   * A `transform` that always answers a value needs no `defaultValue`. One that throws raises an
   * `ApplicationError` of `RUNTIME_CONFIG_INVALID_CODE`.
   */
  static get<TValue>(
    opts: IRuntimeConfigReadOptions & {
      transform: (raw: string | undefined) => TValue;
      defaultValue?: TValue;
    },
  ): TValue;
  static get(
    opts: IRuntimeConfigReadOptions & {
      defaultValue?: unknown;
      transform?: (raw: string | undefined) => unknown;
    },
  ): unknown {
    const { key, defaultValue, transform } = opts;
    const raw = readValue(opts);

    if (transform === undefined) {
      return raw ?? defaultValue;
    }

    return applyTransform({ key, raw, transform }) ?? defaultValue;
  }

  /**
   * One config value the app cannot run without, read as `get` reads it. When it is unset it throws,
   * naming the key and never a value: an `ApplicationError` with `normalized.code` equal to
   * `RUNTIME_CONFIG_REQUIRED_CODE` and the key in `extra.key`, so a caller tells it from another
   * error without reading the message. It has no `defaultValue`.
   *
   * With `transform` the result is what it makes of the value, which it is handed as a `string`. A
   * `transform` that throws, or answers `undefined` or `null`, raises the error of
   * `RUNTIME_CONFIG_INVALID_CODE`, with the key in `extra.key` and never the value.
   */
  static getRequired(opts: IRuntimeConfigReadOptions & { transform?: undefined }): string;
  static getRequired<TValue>(
    opts: IRuntimeConfigReadOptions & {
      transform: (raw: string) => TNullable<TValue>;
    },
  ): TValue;
  static getRequired(
    opts: IRuntimeConfigReadOptions & { transform?: (raw: string) => unknown },
  ): unknown {
    const { key, transform } = opts;
    const raw = readValue(opts);

    if (raw === undefined) {
      throw getError({
        messageCode: RUNTIME_CONFIG_REQUIRED_CODE,
        extra: { key },
        message: `[RuntimeConfig.getRequired] '${key}' is required and not set | Write it to config.js (a VITE_ variable of the container, listed in APP_REQUIRED_ENV), or pass it in buildTimeEnv`,
      });
    }

    if (transform === undefined) {
      return raw;
    }

    const value = applyTransform({ key, raw, transform });

    if (value === undefined || value === null) {
      throw getError({
        messageCode: RUNTIME_CONFIG_INVALID_CODE,
        extra: { key },
        message: `[RuntimeConfig.getRequired] '${key}' is not valid | The transform answered nothing for the value; fix the value in config.js or in the build-time env`,
      });
    }

    return value;
  }
}
