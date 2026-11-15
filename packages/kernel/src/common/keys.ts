import { getError } from '@venizia/ignis-inversion';

/** The container keys the kernel binds and reads. */
export class CoreBindings {
  /** The application itself, bound by `preConfigure`. */
  static readonly APPLICATION_INSTANCE = '@app/application/instance';
  /** The `IApplicationInfo`, bound by `preConfigure`. */
  static readonly APPLICATION_INFO = '@app/application/info';

  /** The auth provider. */
  static readonly DEFAULT_AUTH_PROVIDER = '@app/application/auth/default';
  /** The i18n provider. */
  static readonly DEFAULT_I18N_PROVIDER = '@app/application/i18n/default';
  /** The REST data provider. */
  static readonly DEFAULT_REST_DATA_PROVIDER = '@app/application/data/rest/default';

  /** The `TAuthProviderOptions`: `{ use: true }` turns sign-in on; unbound means `{ use: false }`. */
  static readonly AUTH_PROVIDER_OPTIONS = '@app/application/options/auth';
  /** The `DefaultAuthService`. */
  static readonly DEFAULT_AUTH_SERVICE = '@app/application/service/auth/default';

  /** The `IRestDataProviderOptions`. */
  static readonly REST_DATA_PROVIDER_OPTIONS = '@app/application/options/rest/data';

  /** The options of the i18n provider; unbound means English only. */
  static readonly I18N_PROVIDER_OPTIONS = '@app/application/options/i18n';

  /** The `features()` an application mounts, bound by `preConfigure()`. */
  static readonly FEATURES = '@app/application/features';
  /** An `IPermissionProvider`, bound by the application; unbound means every check passes. */
  static readonly PERMISSION_PROVIDER = '@app/application/permission/provider';
}

/** The session keys and the store prefix of one application, from `LocalStorageKeys.scoped`. */
export interface IScopedKeys {
  /**
   * The prefix of this application's session keys: `DefaultAuthService.cleanUp` removes them. Without
   * an application `id` it is also the start of every scoped session, and `cleanUp` skips those.
   */
  authPrefix: string;
  /**
   * The data of this application's signed-in user; sign-out removes every key that starts with it.
   * Without an application `id` it is `@app/store/`, the start of every scoped store prefix, so an
   * application without an `id` removes the data of the applications with one: every application on
   * an origin sets an `id`.
   */
  storePrefix: string;
  token: string;
  identity: string;
  permission: string;
}

/** The `localStorage` keys the kernel owns. */
export class LocalStorageKeys {
  /**
   * The session keys of an application with no `id`: `DefaultAuthService.cleanUp` removes them, and
   * skips the keys of applications with an `id`, which are `@app/auth/<id>/...`.
   */
  static readonly PREFIX_AUTH = '@app/auth/';
  /**
   * The data of the signed-in user: sign-out removes every key that starts with the store prefix of
   * the application. This one is the start of every scoped store prefix (`@app/store/<id>/`), so
   * applications that share an origin must all set an `id`. Preferences that outlive a sign-out go
   * under `@app/prefs/`.
   */
  static readonly PREFIX_STORE = '@app/store/';

  /** The stored `IAuthTokenRecord`, as JSON. */
  static readonly KEY_AUTH_TOKEN = '@app/auth/token';
  /** The stored identity (`userId`, `username`, `referenceId`, `provider`), as JSON. */
  static readonly KEY_AUTH_IDENTITY = '@app/auth/identity';
  /** The stored roles, as a JSON array of names. */
  static readonly KEY_AUTH_PERMISSION = '@app/auth/permission';

  /** The three session keys. */
  static readonly SCHEME_SET = new Set([
    this.KEY_AUTH_TOKEN,
    this.KEY_AUTH_IDENTITY,
    this.KEY_AUTH_PERMISSION,
  ]);

  /**
   * The keys of one application. With no `id` they are the constants above, so an application that is
   * alone on its origin changes nothing. With an `id` (`IApplicationInfo.id`) the session sits under
   * `@app/auth/<id>/` and the store under `@app/store/<id>/`, so two applications on one origin share
   * no session and no sign-out sweeps the other's data. The `id` is letters, digits, `.`, `_` and `-`,
   * and is not made of dots only. Applications on one origin must ALL set an `id`: the store prefix
   * without one is a prefix of every scoped store prefix, so its sign-out removes their data too.
   */
  static scoped(opts: { id?: string } = {}): IScopedKeys {
    const { id } = opts;

    if (id !== undefined && !(typeof id === 'string' && /^(?!\.+$)[A-Za-z0-9._-]+$/.test(id))) {
      throw getError({
        message:
          "[LocalStorageKeys.scoped] IApplicationInfo.id is letters, digits, '.', '_' and '-', and not dots only",
      });
    }

    const scope = id === undefined ? '' : `${id}/`;

    return {
      authPrefix: `${this.PREFIX_AUTH}${scope}`,
      storePrefix: `${this.PREFIX_STORE}${scope}`,
      token: `${this.PREFIX_AUTH}${scope}token`,
      identity: `${this.PREFIX_AUTH}${scope}identity`,
      permission: `${this.PREFIX_AUTH}${scope}permission`,
    };
  }

  /** Whether `value` is a session key in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}
