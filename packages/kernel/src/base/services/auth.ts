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
    // Nothing stored is not an error: it is every visitor who has not signed in.
    const stored = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
    if (stored === null) {
      return null;
    }

    try {
      return JSON.parse(stored);
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

    /**
     * The user's roles, where `getRoles` reads them. Left alone when absent, so a token refresh
     * that saves only the new token keeps the roles; `[]` says the user has none.
     */
    roles?: ReadonlyArray<string>;
  }) {
    const { token, userId, username = '', provider = '', referenceId = '', roles } = opts;
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify(Object.assign({}, token, { provider })),
    );
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      JSON.stringify({ userId, username, referenceId, provider }),
    );

    if (roles) {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_PERMISSION, JSON.stringify(roles));
    }
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
