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

  /** The `IAuthProviderOptions`. */
  static readonly AUTH_PROVIDER_OPTIONS = '@app/application/options/auth';
  /** The `DefaultAuthService`. */
  static readonly DEFAULT_AUTH_SERVICE = '@app/application/service/auth/default';

  /** The `IRestDataProviderOptions`. */
  static readonly REST_DATA_PROVIDER_OPTIONS = '@app/application/options/rest/data';

  /** The options of the i18n provider. */
  static readonly I18N_PROVIDER_OPTIONS = '@app/application/options/i18n';

  /** The `features()` an application mounts, bound by `preConfigure()`. */
  static readonly FEATURES = '@app/application/features';
  /** An `IPermissionProvider`, bound by the application; unbound means every check passes. */
  static readonly PERMISSION_PROVIDER = '@app/application/permission/provider';
}

/** The `localStorage` keys the kernel owns. */
export class LocalStorageKeys {
  /** Everything under this prefix is the session: `DefaultAuthService.cleanUp` removes it all. */
  static readonly PREFIX_AUTH = '@app/auth/';
  /** The data of the signed-in user: sign-out removes everything under it. Preferences that outlive a sign-out go under `@app/prefs/`. */
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

  /** Whether `value` is a session key in `SCHEME_SET`. */
  static isValid(value: string): boolean {
    return this.SCHEME_SET.has(value);
  }
}
