/**
 * The name `config.js` writes the runtime config under: `window.__APP_CONFIG__`, a record of strings.
 * The preset image writes it at container start, from the environment variables that start with `VITE_`.
 */
export const RUNTIME_CONFIG_GLOBAL = '__APP_CONFIG__';

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

/**
 * One value of the app's config: the runtime one (`window.__APP_CONFIG__`, written when the container
 * starts), else the build-time one (`buildTimeEnv`, which the app passes as `import.meta.env`; this
 * package never reads `import.meta`), else `defaultValue`. Only a non-empty string counts at either
 * level, and a missing global is not an error, so the same call works in dev, in a test and in the image.
 */
export const getRuntimeConfig = (opts: {
  key: string;
  buildTimeEnv?: Record<string, unknown>;
  defaultValue?: string;
}): string | undefined => {
  const { key, buildTimeEnv, defaultValue } = opts;

  return (
    readString({ source: Reflect.get(globalThis, RUNTIME_CONFIG_GLOBAL), key }) ??
    readString({ source: buildTimeEnv, key }) ??
    defaultValue
  );
};
