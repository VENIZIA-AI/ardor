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

  test('saveAuth stores roles where getRoles reads them, and leaves them alone when none are given', () => {
    const service = new DefaultAuthService();
    const session = { userId: 'user-001', token: { value: 'tok', type: 'Bearer' } };

    service.saveAuth({ ...session, roles: ['admin', 'editor'] });
    expect(service.getRoles()).toEqual(new Set(['admin', 'editor']));

    // A refresh saves the new token and says nothing of roles: they stay.
    service.saveAuth(session);
    expect(service.getRoles()).toEqual(new Set(['admin', 'editor']));

    // An empty list is an answer: the user has no roles.
    service.saveAuth({ ...session, roles: [] });
    expect(service.getRoles()).toEqual(new Set());

    service.saveAuth({ ...session, roles: ['admin'] });
    service.cleanUp();
    expect(service.getRoles()).toEqual(new Set());
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

  // Nothing stored is the normal state of every visitor who has not signed in: no error to log.
  test('getAuth returns null without logging when no token is stored', () => {
    const service = new DefaultAuthService();
    const loggerSpy = spyOn(service['logger'], 'error').mockImplementation(() => {});
    try {
      expect(localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)).toBeNull();

      expect(service.getAuth()).toBeNull();
      expect(loggerSpy).not.toHaveBeenCalled();
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

describe('corrupt storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('getUser reads corrupt identity as an empty object and never logs the stored text', () => {
    const service = new DefaultAuthService();
    const spies = (['warn', 'error'] as const).map(level =>
      spyOn(service['logger'], level).mockImplementation(() => {}),
    );
    try {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_IDENTITY, 'username-secretpart{');

      expect(service.getUser()).toEqual({});
      expect(JSON.stringify(spies.flatMap(spy => spy.mock.calls))).not.toContain('secretpart');
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });

  test('getRoles reads corrupt permissions as an empty set', () => {
    const service = new DefaultAuthService();
    const loggerSpy = spyOn(service['logger'], 'warn').mockImplementation(() => {});
    try {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_PERMISSION, 'admin,editor{');

      expect(service.getRoles()).toEqual(new Set());
    } finally {
      loggerSpy.mockRestore();
    }
  });

  test('getRoles reads a stored value that is not a list as no roles, and keeps only strings', () => {
    const service = new DefaultAuthService();

    localStorage.setItem(LocalStorageKeys.KEY_AUTH_PERMISSION, '"admin"');
    expect(service.getRoles()).toEqual(new Set());

    localStorage.setItem(LocalStorageKeys.KEY_AUTH_PERMISSION, '{"admin":true}');
    expect(service.getRoles()).toEqual(new Set());

    localStorage.setItem(LocalStorageKeys.KEY_AUTH_PERMISSION, '["admin", 1, null, "editor"]');
    expect(service.getRoles()).toEqual(new Set(['admin', 'editor']));
  });

  test('getAuth logs the error name, never the stored token text', () => {
    const service = new DefaultAuthService();
    const loggerSpy = spyOn(service['logger'], 'error').mockImplementation(() => {});
    try {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_TOKEN, 'eyJhbGciOiJIUzI1NiJ9.secretpart');

      expect(service.getAuth()).toBeNull();
      expect(loggerSpy).toHaveBeenCalledTimes(1);

      const logged = JSON.stringify(loggerSpy.mock.calls);
      expect(logged).toContain('SyntaxError');
      expect(logged).not.toContain('secretpart');
      expect(logged).not.toContain('eyJhbGci');
    } finally {
      loggerSpy.mockRestore();
    }
  });
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

  test('the readers answer what a visitor who has not signed in gets', () => {
    const service = new DefaultAuthService();

    expect(service.getUser()).toEqual({});
    expect(service.getRoles()).toEqual(new Set());
    expect(service.getAuth()).toBeNull();
  });

  test('cleanUp has nothing to clear and does not throw', () => {
    expect(() => new DefaultAuthService().cleanUp()).not.toThrow();
  });

  test('saveAuth throws a clear error, because it would otherwise lose a sign-in silently', () => {
    const service = new DefaultAuthService();

    expect(() =>
      service.saveAuth({ userId: 1, token: { value: 'token', type: 'Bearer' } }),
    ).toThrow('localStorage is not available');
  });
});

describe('LocalStorageKeys prefixes', () => {
  test('name the two prefixes cleanUp removes', () => {
    expect(LocalStorageKeys.PREFIX_AUTH).toBe('@app/auth/');
    expect(LocalStorageKeys.PREFIX_OAUTH2).toBe('@app/oauth2/');
    expect(LocalStorageKeys.KEY_AUTH_TOKEN.startsWith(LocalStorageKeys.PREFIX_AUTH)).toBe(true);
  });
});
