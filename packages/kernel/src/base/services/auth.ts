import { RecordUtility } from '@venizia/ignis-helpers/core';
import { getError, inject } from '@venizia/ignis-inversion';

import {
  CoreBindings,
  type IApplicationInfo,
  type IAuthTokenRecord,
  type IAuthUser,
  type IdType,
  type IScopedKeys,
  LocalStorageKeys,
  StorageAreas,
} from '@/common';
import { AuthTokenStore } from '@/helpers';
import { BrowserStorage, StorageCodecs } from '@/utilities';
import { BaseService } from './base';

/** What a subscriber of `DefaultAuthService` is told: `isExternal` is a change another tab of the application made. */
export interface IAuthChange {
  isExternal: boolean;
}

/**
 * Keeps the signed-in session (token, identity, roles) in `localStorage`, everything under
 * `keys.authPrefix`: `LocalStorageKeys.PREFIX_AUTH`, or `@app/auth/<id>/` when the application has an `id`.
 */
export class DefaultAuthService extends BaseService {
  private readonly listeners = new Set<(change: IAuthChange) => void>();
  private stopExternalSync?: () => void;
  private snapshot = '';
  /** The keys of this application's session and store: the application's `id` scopes them. */
  readonly keys: IScopedKeys;

  /** A subclass with its own constructor passes `info` on to `super(info)`; otherwise its keys are the unscoped ones. */
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INFO, isOptional: true }) info?: IApplicationInfo,
  ) {
    super({ scope: DefaultAuthService.name });
    this.keys = LocalStorageKeys.scoped({ id: info?.id });
  }

  /**
   * `listener` runs after every `saveAuth` and `cleanUp`, so after any change of the session this service makes,
   * and after a sign-in, sign-out or user switch in another tab of the browser: the first
   * subscriber starts listening to the `storage` event of the token and identity keys, the last one to leave stops. The
   * listener also runs when a page comes back from the back-forward cache or a tab becomes visible and the
   * session changed meanwhile. A change of another tab calls the listener once, when the stored token and
   * identity belong to one user, and writes nothing; a service never subscribed to listens to nothing, and
   * outside a browser nothing is listened to.
   */
  subscribe(opts: { listener: (change: IAuthChange) => void }): () => void {
    this.listeners.add(opts.listener);
    this.startExternalSync();

    return () => {
      this.listeners.delete(opts.listener);

      if (this.listeners.size === 0) {
        this.stopExternalSync?.();
      }
    };
  }

  /** What is stored for the session now, as one text: two reads of it are equal when nothing of the session changed. */
  private readSnapshot(): string {
    return [this.keys.token, this.keys.identity, this.keys.permission]
      .map((key) => {
        return BrowserStorage.get({
          key,
          fallback: null,
          storage: StorageAreas.LOCAL,
          codec: StorageCodecs.text(),
        });
      })
      .join('\u0000');
  }

  private startExternalSync(): void {
    if (this.stopExternalSync) {
      return;
    }

    this.snapshot = this.readSnapshot();

    // A write of this tab announced itself; an event it caused must not announce it again. A token that belongs
    // to another user than the stored identity is a pair still being written by another tab, or a view of
    // storage that is ahead of the event: the event of the token that completes the pair announces it.
    const announce = () => {
      if (
        this.isSessionWhole({ token: AuthTokenStore.read({ key: this.keys.token }) }) &&
        this.readSnapshot() !== this.snapshot
      ) {
        this.notify({ isExternal: true });
      }
    };

    // `saveAuth` writes the token last and `cleanUp` removes it first, so the token key completes a session. The
    // identity key is heard too: a tab on older code writes the token first, and its identity comes after. Half a
    // pair is never announced, so hearing both is safe.
    const stops = [this.keys.token, this.keys.identity]
      .map((key) => {
        return BrowserStorage.subscribe({
          key,
          storage: StorageAreas.LOCAL,
          listener: ({ isExternal }) => {
            if (isExternal) {
              announce();
            }
          },
        });
      })
      .concat(this.onPageReturn({ listener: announce }));

    this.stopExternalSync = () => {
      for (const stop of stops) {
        stop();
      }

      this.stopExternalSync = undefined;
    };
  }

  /**
   * Runs `listener` when the page comes back from the back-forward cache (`pageshow`, persisted) or its tab
   * becomes visible: no `storage` event reaches a page in either state. Returns how to stop; does nothing
   * without a window.
   */
  private onPageReturn(opts: { listener: () => void }): () => void {
    if (typeof globalThis.addEventListener !== 'function') {
      return () => {};
    }

    const onShow = (event: Event) => {
      if (Reflect.get(event, 'persisted') === true) {
        opts.listener();
      }
    };

    const onVisible = () => {
      if (globalThis.document?.visibilityState === 'visible') {
        opts.listener();
      }
    };

    globalThis.addEventListener('pageshow', onShow);
    globalThis.document?.addEventListener('visibilitychange', onVisible);

    return () => {
      globalThis.removeEventListener('pageshow', onShow);
      globalThis.document?.removeEventListener('visibilitychange', onVisible);
    };
  }

  /**
   * Whether the stored `token` and the stored identity belong to one user. A token stored without a `userId`
   * (before `saveAuth` wrote it) counts as whole; so does a session with no token.
   */
  private isSessionWhole(opts: { token: IAuthTokenRecord | undefined }): boolean {
    const { token } = opts;

    if (token?.userId === undefined) {
      return true;
    }

    const { userId } = this.getUser();

    return userId !== undefined && String(userId) === String(token.userId);
  }

  private notify(change: IAuthChange): void {
    if (this.stopExternalSync) {
      this.snapshot = this.readSnapshot();
    }

    for (const listener of this.listeners) {
      try {
        listener(change);
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
  getUser(): IAuthUser {
    const identity = this.parseStored({
      key: this.keys.identity,
      method: 'getUser',
    });

    return this.isAuthUser(identity) ? identity : {};
  }

  /** A stored identity is data from the browser: an object whose known fields, when present, have their type. */
  private isAuthUser(value: unknown): value is IAuthUser {
    if (!RecordUtility.isPlainRecord(value)) {
      return false;
    }

    const userId = 'userId' in value ? value.userId : undefined;
    const username = 'username' in value ? value.username : undefined;
    const referenceId = 'referenceId' in value ? value.referenceId : undefined;
    const provider = 'provider' in value ? value.provider : undefined;
    const isId = (field: unknown) =>
      field === undefined || ['string', 'number'].includes(typeof field);
    const isText = (field: unknown) => field === undefined || typeof field === 'string';

    return isId(userId) && isText(username) && isId(referenceId) && isText(provider);
  }

  /**
   * The stored roles; empty when nothing usable is stored, also outside a browser. They are data in
   * the browser, so whoever controls the browser can change them: use them to show or hide interface,
   * never to decide what a user may do. The backend must check every permission on every request.
   */
  getRoles() {
    const stored = this.parseStored({
      key: this.keys.permission,
      method: 'getRoles',
    });
    const roles = Array.isArray(stored) ? stored.filter((role) => typeof role === 'string') : [];

    return new Set<string>(roles);
  }

  /**
   * Whether another tab is in the middle of a user switch: a token is stored, but it belongs to another user
   * than the stored identity. `getAuth` answers `null` meanwhile, which is not a sign-out: someone is signing in.
   */
  isSwitching(): boolean {
    const token = AuthTokenStore.read({ key: this.keys.token });

    return token !== undefined && !this.isSessionWhole({ token });
  }

  /**
   * The stored token, `null` for every visitor who has not signed in, and while the stored token belongs to
   * another user than the stored identity (another tab is switching users and has not finished writing).
   */
  getAuth(): IAuthTokenRecord | null {
    const token = AuthTokenStore.read({ key: this.keys.token });

    return token && this.isSessionWhole({ token }) ? token : null;
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
    // The identity and the roles first and the token last: another tab that reads between the writes sees another user's identity with the old token, never the old user's with the new token, and it acts on the token's event only, when the session is whole.
    localStorage.setItem(
      this.keys.identity,
      JSON.stringify({ userId, username, referenceId, provider }),
    );

    if (roles) {
      localStorage.setItem(this.keys.permission, JSON.stringify(roles));
    }

    AuthTokenStore.write({ token, provider, userId, key: this.keys.token });

    this.notify({ isExternal: false });
  }

  /**
   * Whether `key` is a key of this service's session. Without an application `id` the prefix is
   * `LocalStorageKeys.PREFIX_AUTH`, which is also the start of every scoped session, so a key with a
   * `/` after the prefix belongs to an application that has an `id`.
   */
  private isSessionKey(opts: { key: string }): boolean {
    const { key } = opts;

    if (!key.startsWith(this.keys.authPrefix)) {
      return false;
    }

    return (
      this.keys.authPrefix !== LocalStorageKeys.PREFIX_AUTH ||
      !key.slice(this.keys.authPrefix.length).includes('/')
    );
  }

  /**
   * Removes the session keys under `keys.authPrefix`, then notifies the subscribers; does nothing
   * outside a browser. A service without an application `id` leaves the sessions of applications with
   * an `id` alone.
   */
  cleanUp() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const sessionKeys = Object.keys(localStorage).filter((key) => this.isSessionKey({ key }));

    // The token first: another tab acts on its event, and then finds no session, not an identity without a token.
    const ordered = [
      ...sessionKeys.filter((key) => key === this.keys.token),
      ...sessionKeys.filter((key) => key !== this.keys.token),
    ];

    for (const key of ordered) {
      localStorage.removeItem(key);
    }

    this.notify({ isExternal: false });
  }
}
