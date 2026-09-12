import { type IdType, LocalStorageKeys } from '@/common';
import { BaseService } from './base';

export class DefaultAuthService extends BaseService {
  constructor() {
    super({ scope: DefaultAuthService.name });
  }

  getUser() {
    const identity = localStorage.getItem(LocalStorageKeys.KEY_AUTH_IDENTITY);
    return JSON.parse(identity?.length ? identity : '{}');
  }

  getRoles() {
    const stored = localStorage.getItem(LocalStorageKeys.KEY_AUTH_PERMISSION);
    const roles = JSON.parse(stored?.length ? stored : '[]');
    return new Set<string>(roles);
  }

  getAuth() {
    try {
      const encryptedToken = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN) ?? '';
      return JSON.parse(encryptedToken);
    } catch (error) {
      this.logger.error('[getAuth] Failed to parse stored auth token | error: %s', error);
      return null;
    }
  }

  saveAuth(opts: {
    userId: number | string;

    username?: string;
    provider?: string;
    referenceId?: IdType;

    token: { value: string; type: string };
  }) {
    const { token, userId, username = '', provider = '', referenceId = '' } = opts;
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify(Object.assign({}, token, { provider })),
    );
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      JSON.stringify({ userId, username, referenceId, provider }),
    );
  }

  cleanUp() {
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith('@app/auth/') && !key.startsWith('@app/oauth2/')) {
        return;
      }

      localStorage.removeItem(key);
    });
  }
}
