import { afterEach, describe, expect, test } from 'bun:test';
import { getRuntimeConfig, RUNTIME_CONFIG_GLOBAL } from '@/utilities/runtime-config';

const setRuntimeConfig = (value: unknown) => {
  Reflect.set(globalThis, RUNTIME_CONFIG_GLOBAL, value);
};

describe('getRuntimeConfig', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, RUNTIME_CONFIG_GLOBAL);
  });

  test('the global is named __APP_CONFIG__, the name config.js writes', () => {
    expect(RUNTIME_CONFIG_GLOBAL).toBe('__APP_CONFIG__');
  });

  test('a runtime value wins over the build-time one and the default', () => {
    setRuntimeConfig({ VITE_API_URL: 'https://api.example.com' });

    expect(
      getRuntimeConfig({
        key: 'VITE_API_URL',
        buildTimeEnv: { VITE_API_URL: '/dev-api' },
        defaultValue: '/api',
      }),
    ).toBe('https://api.example.com');
  });

  test('without a runtime value it falls back to the build-time env, then to the default', () => {
    expect(
      getRuntimeConfig({
        key: 'VITE_API_URL',
        buildTimeEnv: { VITE_API_URL: '/dev-api' },
        defaultValue: '/api',
      }),
    ).toBe('/dev-api');
    expect(getRuntimeConfig({ key: 'VITE_API_URL', buildTimeEnv: {}, defaultValue: '/api' })).toBe(
      '/api',
    );
    expect(getRuntimeConfig({ key: 'VITE_API_URL', defaultValue: '/api' })).toBe('/api');
    expect(getRuntimeConfig({ key: 'VITE_API_URL' })).toBeUndefined();
  });

  test('an empty runtime value falls through, as an unset one does', () => {
    setRuntimeConfig({ VITE_API_URL: '' });

    expect(
      getRuntimeConfig({ key: 'VITE_API_URL', buildTimeEnv: { VITE_API_URL: '/dev-api' } }),
    ).toBe('/dev-api');
  });

  test('a value that is not a string is ignored, at runtime and at build time', () => {
    setRuntimeConfig({ VITE_FLAG: true, VITE_COUNT: 3, VITE_NESTED: { a: 1 } });

    for (const key of ['VITE_FLAG', 'VITE_COUNT', 'VITE_NESTED']) {
      expect(getRuntimeConfig({ key, defaultValue: 'fallback' })).toBe('fallback');
    }

    expect(
      getRuntimeConfig({ key: 'DEV', buildTimeEnv: { DEV: true }, defaultValue: 'fallback' }),
    ).toBe('fallback');
  });

  test('a missing, null or non-object global does not throw', () => {
    for (const value of [undefined, null, 'text', 7, []]) {
      setRuntimeConfig(value);

      expect(getRuntimeConfig({ key: 'VITE_API_URL', defaultValue: 'fallback' })).toBe('fallback');
    }
  });

  test('a key inherited from Object.prototype is not a config value', () => {
    setRuntimeConfig({});

    expect(getRuntimeConfig({ key: 'toString' })).toBeUndefined();
    expect(getRuntimeConfig({ key: 'constructor', buildTimeEnv: {} })).toBeUndefined();
  });

  describe('required', () => {
    test('is a string, by the runtime value, the build-time value or the default', () => {
      setRuntimeConfig({ VITE_API_URL: 'https://api.example.com' });
      expect(getRuntimeConfig({ key: 'VITE_API_URL', required: true })).toBe(
        'https://api.example.com',
      );

      setRuntimeConfig({});
      expect(
        getRuntimeConfig({
          key: 'VITE_API_URL',
          buildTimeEnv: { VITE_API_URL: '/dev-api' },
          required: true,
        }),
      ).toBe('/dev-api');
      expect(getRuntimeConfig({ key: 'VITE_API_URL', defaultValue: '/api', required: true })).toBe(
        '/api',
      );
    });

    test('throws when the runtime value, the build-time value and the default are all absent', () => {
      expect(() => getRuntimeConfig({ key: 'VITE_API_URL', required: true })).toThrow(
        "'VITE_API_URL'",
      );
    });

    test('an empty or non-string value is absent, and the message holds the key but no value', () => {
      setRuntimeConfig({ VITE_API_URL: '', VITE_TOKEN_HINT: 424242 });

      expect(() =>
        getRuntimeConfig({
          key: 'VITE_API_URL',
          buildTimeEnv: { VITE_API_URL: '' },
          required: true,
        }),
      ).toThrow("'VITE_API_URL'");

      let message = '';
      try {
        getRuntimeConfig({ key: 'VITE_TOKEN_HINT', required: true });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain('VITE_TOKEN_HINT');
      expect(message).not.toContain('424242');
    });

    test('required: false or unset keeps returning undefined', () => {
      expect(getRuntimeConfig({ key: 'VITE_API_URL', required: false })).toBeUndefined();
      expect(getRuntimeConfig({ key: 'VITE_API_URL' })).toBeUndefined();
    });

    test('the type narrows: string with required: true, string | undefined without', () => {
      setRuntimeConfig({ VITE_API_URL: '/api' });

      const narrowed: string = getRuntimeConfig({ key: 'VITE_API_URL', required: true });
      expect(narrowed).toBe('/api');

      // @ts-expect-error - without `required: true` the value may be undefined
      const widened: string = getRuntimeConfig({ key: 'VITE_API_URL' });
      expect(widened).toBe('/api');

      // @ts-expect-error - a `required` known only as boolean may be false, so it may be undefined
      const flag: string = getRuntimeConfig({ key: 'VITE_API_URL', required: Boolean('x') });
      expect(flag).toBe('/api');
    });
  });
});
