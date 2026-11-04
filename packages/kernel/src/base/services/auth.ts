import { getError } from '@venizia/ignis-inversion';

import { type AnyType, type IAuthTokenRecord, type IdType, LocalStorageKeys } from '@/common';
import { AuthTokenStore } from '@/helpers';
import { BaseService } from './base';

/** Keeps the signed-in session (token, identity, roles) in `localStorage`; everything under `LocalStorageKeys.PREFIX_AUTH`. */
export class DefaultAuthService extends BaseService {
  private readonly listeners = new Set<() => void>();

  constructor() {
    super({ scope: DefaultAuthService.name });
  }

  /** `listener` runs after every `saveAuth` and `cleanUp`, so after any change of the session this service makes. */
  subscribe(opts: { listener: () => void }): () => void {
    this.listeners.add(opts.listener);

    return () => {
      this.listeners.delete(opts.listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        this.logger.error('[notify] A listener failed | error: %o', error);
      }
    }
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

  /** The stored identity; `{}` when nothing usable is stored, also outside a browser. */
  getUser(): AnyType {
    const identity = this.parseStored({
      key: LocalStorageKeys.KEY_AUTH_IDENTITY,
      method: 'getUser',
    });
    const isRecord = typeof identity === 'object' && identity !== null && !Array.isArray(identity);

    return isRecord ? identity : {};
  }

  /** The stored roles; empty when nothing usable is stored, also outside a browser. */
  getRoles() {
    const stored = this.parseStored({
      key: LocalStorageKeys.KEY_AUTH_PERMISSION,
      method: 'getRoles',
    });
    const roles = Array.isArray(stored) ? stored.filter((role) => typeof role === 'string') : [];

    return new Set<string>(roles);
  }

  /** The stored token, `null` for every visitor who has not signed in. */
  getAuth(): IAuthTokenRecord | null {
    return AuthTokenStore.read() ?? null;
  }

  /**
   * Stores the token and identity, then notifies the subscribers. Throws when `localStorage` is
   * not available. Roles are stored only when `roles` is given.
   */
  saveAuth(opts: {
    userId: number | string;

    /** @default '' */
    username?: string;
    /** @default '' */
    provider?: string;
    /** @default '' */
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
    AuthTokenStore.write({ token, provider });
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_IDENTITY,
      JSON.stringify({ userId, username, referenceId, provider }),
    );

    if (roles) {
      localStorage.setItem(LocalStorageKeys.KEY_AUTH_PERMISSION, JSON.stringify(roles));
    }

    this.notify();
  }

  /** Removes every key under `LocalStorageKeys.PREFIX_AUTH`, then notifies the subscribers; does nothing outside a browser. */
  cleanUp() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(LocalStorageKeys.PREFIX_AUTH)) {
        return;
      }

      localStorage.removeItem(key);
    });

    this.notify();
  }
}
