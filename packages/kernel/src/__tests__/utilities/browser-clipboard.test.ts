import { afterEach, describe, expect, test } from 'bun:test';

import { FakeClipboard } from '@/testing';
import { BrowserClipboard } from '@/utilities/browser-clipboard';

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

describe('BrowserClipboard.writeText', () => {
  test('puts the text on the clipboard and answers true', async () => {
    const clipboard = new FakeClipboard();
    installNavigator({ clipboard });

    const isWritten = await BrowserClipboard.writeText({ text: 'hello' });

    expect(isWritten).toBe(true);
    expect(clipboard.written).toEqual(['hello']);
  });

  test('answers false, and never throws, for every refusal', async () => {
    const refusals: Array<unknown> = [
      undefined,
      {},
      { clipboard: undefined },
      { clipboard: Object.assign(new FakeClipboard(), { isDenied: true }) },
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

      const isWritten = await BrowserClipboard.writeText({ text: 'hello' });

      expect(isWritten).toBe(false);
    }
  });
});

describe('BrowserClipboard.readText', () => {
  test('answers the text on the clipboard, an empty string included', async () => {
    const clipboard = new FakeClipboard();
    installNavigator({ clipboard });
    clipboard.text = 'pasted';
    const pasted = await BrowserClipboard.readText();

    clipboard.text = '';
    const empty = await BrowserClipboard.readText();

    expect(pasted).toBe('pasted');
    expect(empty).toBe('');
  });

  test('answers undefined, and never throws, for every refusal', async () => {
    const refusals: Array<unknown> = [
      undefined,
      {},
      { clipboard: undefined },
      { clipboard: Object.assign(new FakeClipboard(), { isDenied: true }) },
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

      const text = await BrowserClipboard.readText();

      expect(text).toBeUndefined();
    }
  });
});
