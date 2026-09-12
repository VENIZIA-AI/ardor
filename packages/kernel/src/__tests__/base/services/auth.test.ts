import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { DefaultAuthService } from '@/base/services/auth';
import { LocalStorageKeys } from '@/common';

describe('saveAuth and credential retrieval', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('saveAuth stores token with provider merged and stores identity under expected keys', () => {
    const service = new DefaultAuthService();

    service.saveAuth({
      userId: 'user-001',
      username: 'jdoe',
      provider: 'oidc',
      referenceId: 'ref-987',
      token: { value: 'tok-secret-value', type: 'Bearer' },
    });

    const storedToken = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
    const storedIdentity = localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY);

    expect(JSON.parse(storedToken ?? '{}')).toEqual({
      value: 'tok-secret-value',
      type: 'Bearer',
      provider: 'oidc',
    });

    expect(JSON.parse(storedIdentity ?? '{}')).toEqual({
      userId: 'user-001',
      username: 'jdoe',
      referenceId: 'ref-987',
      provider: 'oidc',
    });
  });

  test('getAuth reads back the stored token payload', () => {
    const service = new DefaultAuthService();

    service.saveAuth({
      userId: 42,
      username: 'alice',
      provider: 'github',
      referenceId: 'ref-42',
      token: { value: 'github-access-token', type: 'Bearer' },
    });

    expect(service.getAuth()).toEqual({
      value: 'github-access-token',
      type: 'Bearer',
      provider: 'github',
    });
  });

  test('getUser reads back the stored identity payload', () => {
    const service = new DefaultAuthService();

    service.saveAuth({
      userId: 'usr-99',
      username: 'bob',
      provider: 'credentials',
      referenceId: 'ref-bob',
      token: { value: 'cred-token', type: 'Bearer' },
    });

    expect(service.getUser()).toEqual({
      userId: 'usr-99',
      username: 'bob',
      referenceId: 'ref-bob',
      provider: 'credentials',
    });
  });

  test('saveAuth applies default empty strings when optional identity parameters are omitted', () => {
    const service = new DefaultAuthService();

    service.saveAuth({
      userId: 'usr-defaults',
      token: { value: 'token-only', type: 'Bearer' },
    });

    expect(service.getUser()).toEqual({
      userId: 'usr-defaults',
      username: '',
      referenceId: '',
      provider: '',
    });

    expect(service.getAuth()).toEqual({
      value: 'token-only',
      type: 'Bearer',
      provider: '',
    });
  });

  test('getRoles reads permissions from local storage and returns them as a Set', () => {
    const service = new DefaultAuthService();
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_PERMISSION,
      JSON.stringify(['admin', 'editor', 'billing']),
    );

    const roles = service.getRoles();

    expect(roles instanceof Set).toBe(true);
    expect(roles.size).toBe(3);
    expect(roles.has('admin')).toBe(true);
    expect(roles.has('editor')).toBe(true);
    expect(roles.has('billing')).toBe(true);
  });
});

describe('getUser and getRoles fallback behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('getUser returns an empty object and getRoles returns an empty Set when storage is empty', () => {
    const service = new DefaultAuthService();

    expect(service.getUser()).toEqual({});

    const roles = service.getRoles();
    expect(roles instanceof Set).toBe(true);
    expect(roles.size).toBe(0);
  });

  test('getUser returns an empty object and getRoles returns an empty Set without throwing when storage contains empty strings', () => {
    const service = new DefaultAuthService();
    localStorage.setItem(LocalStorageKeys.KEY_AUTH_IDENTITY, '');
    localStorage.setItem(LocalStorageKeys.KEY_AUTH_PERMISSION, '');

    expect(service.getUser()).toEqual({});

    const roles = service.getRoles();
    expect(roles instanceof Set).toBe(true);
    expect(roles.size).toBe(0);
  });
});

describe('getAuth error handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('getAuth returns null and logs error when stored token is not valid JSON', () => {
    const service = new DefaultAuthService();
    const loggerSpy = spyOn(service['logger'], 'error').mockImplementation(() => {});
    try {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, '{malformed-json');

      const result = service.getAuth();

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    } finally {
      loggerSpy.mockRestore();
    }
  });

  test('getAuth returns null and logs error when stored token is empty string', () => {
    const service = new DefaultAuthService();
    const loggerSpy = spyOn(service['logger'], 'error').mockImplementation(() => {});
    try {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, '');

      const result = service.getAuth();

      expect(result).toBeNull();
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    } finally {
      loggerSpy.mockRestore();
    }
  });
});

describe('cleanUp selective removal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('cleanUp removes only keys starting with @app/auth/ and @app/oauth2/, leaving other keys intact', () => {
    const service = new DefaultAuthService();

    localStorage.setItem('@app/auth/token', 'token-val');
    localStorage.setItem('@app/auth/identity', 'identity-val');
    localStorage.setItem('@app/auth/permission', 'perm-val');
    localStorage.setItem('@app/oauth2/state', 'state-val');
    localStorage.setItem('@app/oauth2/pkce_verifier', 'verifier-val');
    localStorage.setItem('@app/settings/theme', 'dark');
    localStorage.setItem('@app/application/instance', 'inst-001');
    localStorage.setItem('unprefixed_key', 'preserve-me');

    service.cleanUp();

    expect(localStorage.getItem('@app/auth/token')).toBeNull();
    expect(localStorage.getItem('@app/auth/identity')).toBeNull();
    expect(localStorage.getItem('@app/auth/permission')).toBeNull();
    expect(localStorage.getItem('@app/oauth2/state')).toBeNull();
    expect(localStorage.getItem('@app/oauth2/pkce_verifier')).toBeNull();

    expect(localStorage.getItem('@app/settings/theme')).toBe('dark');
    expect(localStorage.getItem('@app/application/instance')).toBe('inst-001');
    expect(localStorage.getItem('unprefixed_key')).toBe('preserve-me');
  });

  test('cleanUp does not mutate storage when no matching keys exist', () => {
    const service = new DefaultAuthService();

    localStorage.setItem('app_cache', 'val-1');
    localStorage.setItem('@app/i18n/locale', 'en-US');

    service.cleanUp();

    expect(localStorage.getItem('app_cache')).toBe('val-1');
    expect(localStorage.getItem('@app/i18n/locale')).toBe('en-US');
  });
});
