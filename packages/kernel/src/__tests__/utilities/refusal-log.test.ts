import { describe, expect, spyOn, test } from 'bun:test';

import { LoggerFactory } from '@venizia/ignis-helpers/core';

import { FakeStorage } from '@/testing';
import { BrowserClipboard, BrowserStorage } from '@/utilities';

describe('a refusal the browser utilities absorb', () => {
  test('BrowserStorage logs the error name at debug, never its message', () => {
    const logged = spyOn(LoggerFactory.getLogger(['BrowserStorage']), 'debug').mockImplementation(
      () => undefined,
    );
    const storage = new FakeStorage();
    const restore = storage.install();
    const read = spyOn(storage, 'getItem').mockImplementation(() => {
      throw new TypeError('secret-in-message');
    });

    try {
      expect(BrowserStorage.get({ key: 'k', fallback: 'none' })).toBe('none');
      expect(logged.mock.calls).toEqual([['[safe] The storage refused | error: %s', 'TypeError']]);
    } finally {
      read.mockRestore();
      restore();
      logged.mockRestore();
    }
  });

  test('BrowserClipboard logs the error name at debug, never its message', async () => {
    const logged = spyOn(LoggerFactory.getLogger(['BrowserClipboard']), 'debug').mockImplementation(
      () => undefined,
    );
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: () => Promise.reject(new RangeError('the-copied-text')) } },
    });

    try {
      const isWritten = await BrowserClipboard.writeText({ text: 'x' });

      expect(isWritten).toBe(false);
      expect(logged.mock.calls).toEqual([
        ['[safe] The clipboard refused | error: %s', 'RangeError'],
      ]);
    } finally {
      if (original) {
        Object.defineProperty(globalThis, 'navigator', original);
      }

      logged.mockRestore();
    }
  });
});
