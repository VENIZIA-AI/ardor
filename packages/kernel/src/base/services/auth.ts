import { getError } from '@venizia/ignis-inversion';

import { type AnyType, type IdType, LocalStorageKeys } from '@/common';
import { BaseService } from './base';

export class DefaultAuthService extends BaseService {
  constructor() {
    super({ scope: DefaultAuthService.name });
  }

  /** What is stored under the key, or `null` when nothing is, also outside a browser. */
  private readStored(opts: { key: string }): string | null {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(opts.key);
  }

  /**
   * The stored value parsed, or `undefined` when nothing usable is stored. Only the error NAME is
   * logged: the message of a JSON parse error quotes the text it could not parse, which can be a token.
   */
  private parseStored(opts: { key: string; method: string }): unknown {
    const stored = this.readStored({ key: opts.key });
    if (!stored?.length) {
      return undefined;
    }

    try {
      return JSON.parse(stored);
    } catch (error) {
      this.logger.warn(
        '[%s] %s is not valid JSON, read as empty | error: %s',
        opts.method,
        opts.key,
        error instanceof Error ? error.name : typeof error,
      );
      return undefined;
    }
  }

  getUser(): AnyType {
    const identity = this.parseStored({
      key: LocalStorageKeys.KEY_AUTH_IDENTITY,
      method: 'getUser',
    });
    const isRecord = typeof identity === 'object' && identity !== null && !Array.isArray(identity);

    return isRecord ? identity : {};
  }

  getRoles() {
    const stored = this.parseStored({
      key: LocalStorageKeys.KEY_AUTH_PERMISSION,
      method: 'getRoles',
    });
    const roles = Array.isArray(stored) ? stored.filter(role => typeof role === 'string') : [];

    return new Set<string>(roles);
  }

  getAuth() {
    // Nothing stored is not an error: it is every visitor who has not signed in.
    const stored = this.readStored({ key: LocalStorageKeys.KEY_AUTH_TOKEN });
    if (stored === null) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch (error) {
      this.logger.error(
        '[getAuth] The stored token is not valid JSON | error: %s',
        error instanceof Error ? error.name : typeof error,
      );
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
    // Not a silent skip: a sign-in that is not kept would look like it worked.
    if (typeof localStorage === 'undefined') {
      throw getError({
        message: '[saveAuth] localStorage is not available',
      });
    }

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
    if (typeof localStorage === 'undefined') {
      return;
    }

    Object.keys(localStorage).forEach(key => {
      if (
        !key.startsWith(LocalStorageKeys.PREFIX_AUTH) &&
        !key.startsWith(LocalStorageKeys.PREFIX_OAUTH2)
      ) {
        return;
      }

      localStorage.removeItem(key);
    });
  }
}
