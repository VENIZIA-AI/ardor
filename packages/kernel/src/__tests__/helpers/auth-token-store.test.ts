import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { DefaultAuthService } from '@/base/services/auth';
import { DefaultNetworkRequestService } from '@/base/services/network-request';
import { LocalStorageKeys } from '@/common';
import { AuthTokenStore } from '@/helpers/auth-token-store';
import { Logger } from '@/helpers';

const logger = () => Logger.getInstance({ scope: 'AuthTokenStore' });

describe('AuthTokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('read answers undefined when nothing, or an empty string, is stored', () => {
    expect(AuthTokenStore.read()).toBeUndefined();

    localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, '');
    expect(AuthTokenStore.read()).toBeUndefined();
  });

  test('write stores value, type and provider, and read gives them back', () => {
    AuthTokenStore.write({ token: { value: 'tok', type: 'Bearer' }, provider: 'oidc' });

    expect(JSON.parse(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN) ?? '')).toEqual({
      value: 'tok',
      type: 'Bearer',
      provider: 'oidc',
    });
    expect(AuthTokenStore.read()).toEqual({ value: 'tok', type: 'Bearer', provider: 'oidc' });
  });

  test('read ignores text that is not JSON, and logs the error name, never the text', () => {
    const warn = spyOn(logger(), 'warn').mockImplementation(() => {});
    try {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, 'eyJhbGciOiJIUzI1NiJ9.secretpart');

      expect(AuthTokenStore.read()).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);

      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain('SyntaxError');
      expect(logged).not.toContain('secretpart');
      expect(logged).not.toContain('eyJhbGci');
    } finally {
      warn.mockRestore();
    }
  });

  describe('without a localStorage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    });

    afterEach(() => {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    });

    test('read answers undefined, and write throws a clear error', () => {
      expect(AuthTokenStore.read()).toBeUndefined();
      expect(() =>
        AuthTokenStore.write({ token: { value: 'tok', type: 'Bearer' }, provider: '' }),
      ).toThrow('localStorage is not available');
    });
  });

  test('the auth service and the network service read the token through the store', () => {
    const read = spyOn(AuthTokenStore, 'read');
    try {
      localStorage.setItem(
        LocalStorageKeys.KEY_AUTH_TOKEN,
        JSON.stringify({ value: 'shared', type: 'Bearer' }),
      );

      expect(new DefaultAuthService().getAuth()).toEqual({ value: 'shared', type: 'Bearer' });
      expect(DefaultNetworkRequestService.readAuthTokenFromStorage()).toEqual({
        value: 'shared',
        type: 'Bearer',
      });
      expect(read).toHaveBeenCalledTimes(2);
    } finally {
      read.mockRestore();
    }
  });

  test('saveAuth writes the token through the store', () => {
    const write = spyOn(AuthTokenStore, 'write');
    try {
      new DefaultAuthService().saveAuth({
        userId: 1,
        provider: 'oidc',
        token: { value: 'tok', type: 'Bearer' },
      });

      expect(write).toHaveBeenCalledWith({
        token: { value: 'tok', type: 'Bearer' },
        provider: 'oidc',
      });
    } finally {
      write.mockRestore();
    }
  });
});
