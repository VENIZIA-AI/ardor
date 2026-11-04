import { afterEach, describe, expect, test } from 'bun:test';

import { Clipboard } from '@/utilities/clipboard';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

const installNavigator = (value: unknown) => {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
};

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  } else {
    Reflect.deleteProperty(globalThis, 'navigator');
  }
});

describe('Clipboard.writeText', () => {
  test('puts the text on the clipboard and answers true', async () => {
    const written: Array<string> = [];
    installNavigator({
      clipboard: {
        writeText: (text: string) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });

    const isWritten = await Clipboard.writeText({ text: 'hello' });

    expect(isWritten).toBe(true);
    expect(written).toEqual(['hello']);
  });

  test('answers false, and never throws, for every refusal', async () => {
    const refusals: Array<unknown> = [
      undefined,
      {},
      { clipboard: undefined },
      {
        clipboard: {
          writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
        },
      },
      {
        clipboard: {
          writeText: () => {
            throw new TypeError('document is not focused');
          },
        },
      },
    ];

    for (const navigator of refusals) {
      installNavigator(navigator);

      const isWritten = await Clipboard.writeText({ text: 'hello' });

      expect(isWritten).toBe(false);
    }
  });
});

describe('Clipboard.readText', () => {
  test('answers the text on the clipboard, an empty string included', async () => {
    installNavigator({ clipboard: { readText: () => Promise.resolve('pasted') } });
    const pasted = await Clipboard.readText();

    installNavigator({ clipboard: { readText: () => Promise.resolve('') } });
    const empty = await Clipboard.readText();

    expect(pasted).toBe('pasted');
    expect(empty).toBe('');
  });

  test('answers undefined, and never throws, for every refusal', async () => {
    const refusals: Array<unknown> = [
      undefined,
      {},
      { clipboard: undefined },
      {
        clipboard: {
          readText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
        },
      },
      {
        clipboard: {
          readText: () => {
            throw new TypeError('document is not focused');
          },
        },
      },
    ];

    for (const navigator of refusals) {
      installNavigator(navigator);

      const text = await Clipboard.readText();

      expect(text).toBeUndefined();
    }
  });
});
