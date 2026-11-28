import { afterEach, describe, expect, test } from 'bun:test';
import { isApplicationError } from '@venizia/ignis-inversion';
import {
  RUNTIME_CONFIG_GLOBAL,
  RUNTIME_CONFIG_INVALID_CODE,
  RUNTIME_CONFIG_REQUIRED_CODE,
  RuntimeConfig,
} from '@/utilities/runtime-config';

const setRuntimeConfig = (value: unknown) => {
  Reflect.set(globalThis, RUNTIME_CONFIG_GLOBAL, value);
};

describe('RuntimeConfig.get', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, RUNTIME_CONFIG_GLOBAL);
  });

  test('the global is named __APP_CONFIG__, the name config.js writes', () => {
    expect(RUNTIME_CONFIG_GLOBAL).toBe('__APP_CONFIG__');
  });

  test('a runtime value wins over the build-time one and the default', () => {
    setRuntimeConfig({ VITE_API_URL: 'https://api.example.com' });

    expect(
      RuntimeConfig.get({
        key: 'VITE_API_URL',
        buildTimeEnv: { VITE_API_URL: '/dev-api' },
        defaultValue: '/api',
      }),
    ).toBe('https://api.example.com');
  });

  test('without a runtime value it falls back to the build-time env, then to the default', () => {
    expect(
      RuntimeConfig.get({
        key: 'VITE_API_URL',
        buildTimeEnv: { VITE_API_URL: '/dev-api' },
        defaultValue: '/api',
      }),
    ).toBe('/dev-api');
    expect(RuntimeConfig.get({ key: 'VITE_API_URL', buildTimeEnv: {}, defaultValue: '/api' })).toBe(
      '/api',
    );
    expect(RuntimeConfig.get({ key: 'VITE_API_URL', defaultValue: '/api' })).toBe('/api');
    expect(RuntimeConfig.get({ key: 'VITE_API_URL' })).toBeUndefined();
  });

  test('an empty runtime value falls through, as an unset one does', () => {
    setRuntimeConfig({ VITE_API_URL: '' });

    expect(
      RuntimeConfig.get({ key: 'VITE_API_URL', buildTimeEnv: { VITE_API_URL: '/dev-api' } }),
    ).toBe('/dev-api');
  });

  test('a value that is not a string is ignored, at runtime and at build time', () => {
    setRuntimeConfig({ VITE_FLAG: true, VITE_COUNT: 3, VITE_NESTED: { a: 1 } });

    for (const key of ['VITE_FLAG', 'VITE_COUNT', 'VITE_NESTED']) {
      expect(RuntimeConfig.get({ key, defaultValue: 'fallback' })).toBe('fallback');
    }

    expect(
      RuntimeConfig.get({ key: 'DEV', buildTimeEnv: { DEV: true }, defaultValue: 'fallback' }),
    ).toBe('fallback');
  });

  test('a missing, null or non-object global does not throw', () => {
    const keyedArray = Object.assign([], { VITE_API_URL: 'https://api.test' });

    for (const value of [undefined, null, 'text', 7, [], keyedArray]) {
      setRuntimeConfig(value);

      expect(RuntimeConfig.get({ key: 'VITE_API_URL', defaultValue: 'fallback' })).toBe('fallback');
    }
  });

  test('a key inherited from Object.prototype is not a config value', () => {
    setRuntimeConfig({});

    expect(RuntimeConfig.get({ key: 'toString' })).toBeUndefined();
    expect(RuntimeConfig.get({ key: 'constructor', buildTimeEnv: {} })).toBeUndefined();
  });

  test.each(['   ', '\t\n', ' '])(
    'a blank runtime value (%j) is unset, so the next source applies',
    (blank) => {
      setRuntimeConfig({ VITE_API_URL: blank });

      expect(
        RuntimeConfig.get({ key: 'VITE_API_URL', buildTimeEnv: { VITE_API_URL: '/dev-api' } }),
      ).toBe('/dev-api');
      expect(RuntimeConfig.get({ key: 'VITE_API_URL', defaultValue: '/api' })).toBe('/api');
      expect(RuntimeConfig.get({ key: 'VITE_API_URL' })).toBeUndefined();
    },
  );

  test('a blank build-time value is unset, so the default applies', () => {
    expect(
      RuntimeConfig.get({
        key: 'VITE_API_URL',
        buildTimeEnv: { VITE_API_URL: '   ' },
        defaultValue: '/api',
      }),
    ).toBe('/api');
  });

  test('a value with spaces around text is a value and is returned as written', () => {
    setRuntimeConfig({ VITE_API_URL: ' /api ' });

    expect(RuntimeConfig.get({ key: 'VITE_API_URL' })).toBe(' /api ');
  });

  test('a defaultValue types the result as a string', () => {
    const withDefault: string = RuntimeConfig.get({ key: 'VITE_API_URL', defaultValue: '/api' });
    expect(withDefault).toBe('/api');

    // @ts-expect-error - without a defaultValue the value may be undefined
    const without: string = RuntimeConfig.get({ key: 'VITE_API_URL' });
    expect(without).toBeUndefined();
  });

  test('the removed required option is a compile error', () => {
    // @ts-expect-error - get has no required option: use getRequired
    expect(() => RuntimeConfig.get({ key: 'VITE_API_URL', required: true })).not.toThrow();
  });

  describe('transform', () => {
    const toPort = (raw: string | undefined): number | undefined => {
      const port = Number(raw);

      return raw !== undefined && Number.isInteger(port) ? port : undefined;
    };

    test('turns the value into a typed one', () => {
      setRuntimeConfig({ VITE_PORT: '8080', VITE_DEBUG: 'true' });

      const port: number | undefined = RuntimeConfig.get({ key: 'VITE_PORT', transform: toPort });
      const debug: boolean = RuntimeConfig.get({
        key: 'VITE_DEBUG',
        transform: (raw) => raw === 'true',
      });

      expect(port).toBe(8080);
      expect(debug).toBe(true);
    });

    test('is handed undefined when the value is unset or blank', () => {
      setRuntimeConfig({ VITE_PORT: '  ' });
      const seen: Array<string | undefined> = [];

      RuntimeConfig.get({
        key: 'VITE_PORT',
        transform: (raw) => {
          seen.push(raw);

          return 1;
        },
      });

      expect(seen).toEqual([undefined]);
    });

    test('a defaultValue of the transformed type applies when the transform answers undefined or null', () => {
      setRuntimeConfig({ VITE_PORT: 'abc' });

      const port: number = RuntimeConfig.get({
        key: 'VITE_PORT',
        transform: toPort,
        defaultValue: 3000,
      });
      const unset: number = RuntimeConfig.get({
        key: 'VITE_OTHER',
        transform: () => null,
        defaultValue: 4000,
      });

      expect(port).toBe(3000);
      expect(unset).toBe(4000);
    });

    test('a transform that throws is an invalid value, told by its code, with the key and not the value', () => {
      setRuntimeConfig({ VITE_PORT: 'secret-text' });
      let thrown: unknown;

      try {
        RuntimeConfig.get({
          key: 'VITE_PORT',
          transform: (raw) => {
            throw new SyntaxError(`cannot read ${raw}`);
          },
        });
      } catch (error) {
        thrown = error;
      }

      expect(isApplicationError(thrown)).toBe(true);

      if (!isApplicationError(thrown)) {
        return;
      }

      expect(thrown.normalized.code).toBe(RUNTIME_CONFIG_INVALID_CODE);
      expect(thrown.extra?.key).toBe('VITE_PORT');
      expect(thrown.message).toContain('VITE_PORT');
      expect(thrown.message).not.toContain('secret-text');
    });
  });
});

describe('RuntimeConfig.getRequired', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, RUNTIME_CONFIG_GLOBAL);
  });

  const thrownBy = (task: () => unknown): unknown => {
    try {
      task();
    } catch (error) {
      return error;
    }

    return undefined;
  };

  test('is a string, by the runtime value or the build-time value', () => {
    setRuntimeConfig({ VITE_API_URL: 'https://api.example.com' });
    expect(RuntimeConfig.getRequired({ key: 'VITE_API_URL' })).toBe('https://api.example.com');

    setRuntimeConfig({});
    expect(
      RuntimeConfig.getRequired({
        key: 'VITE_API_URL',
        buildTimeEnv: { VITE_API_URL: '/dev-api' },
      }),
    ).toBe('/dev-api');
  });

  test('has no defaultValue, at compile time', () => {
    // @ts-expect-error - a required value has no default
    const attempt = () => RuntimeConfig.getRequired({ key: 'VITE_API_URL', defaultValue: '/api' });

    expect(RUNTIME_CONFIG_REQUIRED_CODE).toBe('ardor.runtime_config.required');
    expect(isApplicationError(thrownBy(attempt))).toBe(true);
  });

  test('throws when neither source has a value, naming the key', () => {
    expect(() => RuntimeConfig.getRequired({ key: 'VITE_API_URL' })).toThrow("'VITE_API_URL'");
  });

  test('the error is told by its code and carries the key, whatever the message says', () => {
    const thrown = thrownBy(() => RuntimeConfig.getRequired({ key: 'VITE_API_URL' }));

    expect(isApplicationError(thrown)).toBe(true);

    if (!isApplicationError(thrown)) {
      return;
    }

    expect(thrown.normalized.code).toBe(RUNTIME_CONFIG_REQUIRED_CODE);
    expect(thrown.extra?.key).toBe('VITE_API_URL');
  });

  test('an empty, blank or non-string value is unset, and the message holds the key but no value', () => {
    setRuntimeConfig({ VITE_API_URL: '   ', VITE_TOKEN_HINT: 424242 });

    expect(() =>
      RuntimeConfig.getRequired({ key: 'VITE_API_URL', buildTimeEnv: { VITE_API_URL: '' } }),
    ).toThrow("'VITE_API_URL'");

    const thrown = thrownBy(() => RuntimeConfig.getRequired({ key: 'VITE_TOKEN_HINT' }));
    const message = thrown instanceof Error ? thrown.message : '';

    expect(message).toContain('VITE_TOKEN_HINT');
    expect(message).not.toContain('424242');
  });

  describe('transform', () => {
    const toPort = (raw: string): number | undefined => {
      const port = Number(raw);

      return Number.isInteger(port) ? port : undefined;
    };

    test('gives the transformed, typed value', () => {
      setRuntimeConfig({ VITE_PORT: '8080' });

      const port: number = RuntimeConfig.getRequired({ key: 'VITE_PORT', transform: toPort });

      expect(port).toBe(8080);
    });

    test('is handed the value, never undefined, and an unset key still throws the required error', () => {
      const thrown = thrownBy(() =>
        RuntimeConfig.getRequired({ key: 'VITE_PORT', transform: toPort }),
      );

      expect(isApplicationError(thrown)).toBe(true);

      if (!isApplicationError(thrown)) {
        return;
      }

      expect(thrown.normalized.code).toBe(RUNTIME_CONFIG_REQUIRED_CODE);
    });

    test.each([
      { name: 'undefined', transform: (): number | undefined => undefined },
      { name: 'null', transform: (): number | null => null },
      {
        name: 'a throw',
        transform: (): number => {
          throw new RangeError('out of range');
        },
      },
    ])(
      'a transform that answers $name is an invalid value, told by its code, with the key and not the value',
      ({ transform }) => {
        setRuntimeConfig({ VITE_PORT: 'secret-text' });

        const thrown = thrownBy(() => RuntimeConfig.getRequired({ key: 'VITE_PORT', transform }));

        expect(isApplicationError(thrown)).toBe(true);

        if (!isApplicationError(thrown)) {
          return;
        }

        expect(RUNTIME_CONFIG_INVALID_CODE).toBe('ardor.runtime_config.invalid');
        expect(thrown.normalized.code).toBe(RUNTIME_CONFIG_INVALID_CODE);
        expect(thrown.extra?.key).toBe('VITE_PORT');
        expect(thrown.message).toContain('VITE_PORT');
        expect(thrown.message).not.toContain('secret-text');
      },
    );
  });
});
