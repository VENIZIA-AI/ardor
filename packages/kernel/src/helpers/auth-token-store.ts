import { getError } from '@venizia/ignis-inversion';

import { type IAuthTokenRecord, LocalStorageKeys } from '@/common';
import { Logger } from './logger';

/** The one place that reads and writes the stored auth token, with the browser guard. */
export class AuthTokenStore {
  /** The stored token, or `undefined` when none is stored, it is unusable, or there is no `localStorage`. */
  static read(): IAuthTokenRecord | undefined {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }

    const stored = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
    if (!stored?.length) {
      return undefined;
    }

    try {
      const token = JSON.parse(stored);
      return typeof token === 'object' && token !== null ? token : undefined;
    } catch (error) {
      // The name only: the message of a JSON parse error quotes the text it could not parse, the token.
      Logger.getInstance({ scope: AuthTokenStore.name }).warn(
        '[read] The stored auth token is not valid JSON, ignoring it | error: %s',
        error instanceof Error ? error.name : typeof error,
      );
      return undefined;
    }
  }

  static write(opts: { token: { value: string; type: string }; provider: string }): void {
    // Not a silent skip: a sign-in that is not kept would look like it worked.
    if (typeof localStorage === 'undefined') {
      throw getError({ message: '[write] localStorage is not available' });
    }

    const { token, provider } = opts;
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify(Object.assign({}, token, { provider })),
    );
  }
}
