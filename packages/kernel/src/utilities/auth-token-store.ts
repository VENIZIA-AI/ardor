import { LoggerFactory } from '@venizia/ignis-helpers/core';
import { getError } from '@venizia/ignis-inversion';

import { type IAuthTokenRecord, type IdType, LocalStorageKeys } from '@/common';

/**
 * The one place that reads and writes the stored auth token, with the browser guard.
 */
export class AuthTokenStore {
  private static readonly logger = LoggerFactory.getLogger(['AuthTokenStore']);

  /** The stored token (under `key`, `LocalStorageKeys.KEY_AUTH_TOKEN` by default), or `undefined` when none is stored, it is unusable, or there is no `localStorage`. */
  static read(opts: { key?: string } = {}): IAuthTokenRecord | undefined {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }

    const stored = localStorage.getItem(opts.key ?? LocalStorageKeys.KEY_AUTH_TOKEN);

    if (!stored?.length) {
      return undefined;
    }

    try {
      const token = JSON.parse(stored);

      return typeof token === 'object' && token !== null ? token : undefined;
    } catch (error) {
      // The name only: the message of a JSON parse error quotes the text it could not parse, the token.
      AuthTokenStore.logger.warn(
        '[read] The stored auth token is not valid JSON, ignoring it | error: %s',
        error instanceof Error ? error.name : typeof error,
      );

      return undefined;
    }
  }

  /**
   * Stores the token with its `provider`, and the `userId` it was issued to when given, under `key`
   * (`LocalStorageKeys.KEY_AUTH_TOKEN` by default). Throws when `localStorage` is not available.
   */
  static write(opts: {
    token: { value: string; type: string };
    provider: string;
    userId?: IdType;
    key?: string;
  }): void {
    // Not a silent skip: a sign-in that is not kept would look like it worked.
    if (typeof localStorage === 'undefined') {
      throw getError({ message: '[write] localStorage is not available' });
    }

    const { token, provider, userId } = opts;
    localStorage.setItem(
      opts.key ?? LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify(
        Object.assign({}, token, { provider }, userId === undefined ? {} : { userId }),
      ),
    );
  }
}
