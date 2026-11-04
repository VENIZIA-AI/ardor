import { type Container, getError, inject } from '@venizia/ignis-inversion';
import { removeDoubleSlashes } from 'ra-core';

import {
  type AnyType,
  BaseProvider,
  CoreBindings,
  type DefaultAuthService,
  type IAuthProviderOptions,
  type IAuthTokenRecord,
  type ISignInSession,
  type IPermissionProvider,
  RequestMethods,
  type TStringConstValue,
} from '@venizia/ardor-kernel';
import type { IAuthProvider, IAuthRejection, IDataProvider } from '@/common';

/** What the login form hands to `login`: the user name and the password, and whatever else the form holds. */
export interface ILoginParams {
  username?: string;
  password?: string;
  [field: string]: unknown;
}

/** Why `onSessionCleared` was called. */
export class SessionClearReasons {
  /** `logout` ran. */
  static readonly LOGOUT = 'logout';
  /** `checkError` met a 401. */
  static readonly UNAUTHORIZED = 'unauthorized';
  /** The session was cleared by code that is not this provider, such as the network service's `onAuthFailure`. */
  static readonly EXTERNAL = 'external';
  /** `checkAuth` rejected: no token is stored, or the server answered with no data. */
  static readonly REJECTED = 'rejected';
}

/** One of the `SessionClearReasons` values. */
export type TSessionClearReason = TStringConstValue<typeof SessionClearReasons>;

/** The status of a failure: react-admin's `HttpError` has `status`, the data provider's `ApplicationError` has `statusCode`. */
const readStatus = (error: unknown): unknown => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };

  return status ?? statusCode;
};

/**
 * The options hold data (`paths`); behaviour is in the protected hooks around `login` and the page
 * paths, each taking one `opts` object, which a subclass overrides.
 *
 * The session hooks `onSessionStarted` and `onSessionCleared` are for what lives next to the session
 * (a socket, a per-user cache). Each fires once per change of the session this provider sees, and a
 * hook that throws, or does not settle in `sessionHookTimeout`, is logged and does not stop the call
 * that fired it. A hook does not call this provider's methods: they wait behind it. Build one provider
 * per auth service: a second one listening to the same service calls every hook again.
 *
 * @example
 * ```ts
 * import { type BaseArdorApplication, configuration, CoreBindings, DefaultAuthProvider, inject, provide } from '@venizia/ardor';
 *
 * class AppAuthProvider extends DefaultAuthProvider {
 *   protected override get afterLoginPath() {
 *     return '/products';
 *   }
 * }
 *
 * @configuration()
 * export class AuthConfiguration {
 *   constructor(@inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: BaseArdorApplication) {}
 *
 *   @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
 *   authProvider() {
 *     return this.application.instantiate(AppAuthProvider).value(this.application);
 *   }
 * }
 * ```
 */
export class DefaultAuthProvider<
  TResource extends string = string,
> extends BaseProvider<IAuthProvider> {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
    protected restDataProvider: IDataProvider<TResource>,
    @inject({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
    protected authProviderOptions: IAuthProviderOptions,
    @inject({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
    protected authService: DefaultAuthService,
    @inject({ key: CoreBindings.PERMISSION_PROVIDER, isOptional: true })
    protected permissionProvider?: IPermissionProvider,
  ) {
    super({ scope: DefaultAuthProvider.name });

    this.stopSync = this.authService.subscribe({ listener: () => this.syncSession() });
  }

  /** Stops listening to the auth service. Call it when you discard a provider that you built yourself. */
  dispose(): void {
    this.stopSync();
  }

  private readonly stopSync: () => void;

  /** The session last announced to `onSessionStarted`: `undefined` when none is, or after it was cleared. */
  private announcedSession?: string;

  /** The reason of the `cleanUp` this provider is running, for the listener of the service. */
  private clearing?: TSessionClearReason;

  /** The hook calls run one after the other, so a slow `onSessionStarted` ends before a later `onSessionCleared`. */
  private hookQueue: Promise<void> = Promise.resolve();

  // --- Paths -----------------------------------------------------------------------------------

  /** Where `login` posts: `paths.signIn`, else the IGNIS auth controller's route. */
  protected get signInPath(): string {
    return this.authProviderOptions.paths?.signIn ?? '/auth/sign-in';
  }

  /** Where the admin goes once `login` resolves: `paths.afterLogin`, else `/`. */
  protected get afterLoginPath(): string {
    return this.authProviderOptions.paths?.afterLogin ?? '/';
  }

  /** The route of the login page, which `checkAuth` and a `401` redirect to. */
  protected get loginPagePath(): string {
    return '/login';
  }

  /** The route a `403` redirects to; the application mounts it. */
  protected get unauthorizedPagePath(): string {
    return '/unauthorized';
  }

  /** How long, in milliseconds, `login`, `logout` and the checks wait for a session hook before they log it and carry on. */
  protected get sessionHookTimeout(): number {
    return 10_000;
  }

  /**
   * What `checkAuth` rejects with when the session is not valid (`reason` is `rejected`), and the 401
   * branch of `checkError` (`unauthorized`). The default redirects to `loginPagePath`. A guest app with no
   * login page returns `{ redirectTo: false, message: false }` for `rejected` and
   * `{ logoutUser: false, message: false }` for `unauthorized`; the 401 then keeps the stored session.
   */
  protected unauthenticatedRejection(_opts: { reason: TSessionClearReason }): IAuthRejection {
    return { redirectTo: this.loginPagePath };
  }

  // --- Sign-in hooks ---------------------------------------------------------------------------

  /**
   * The body of the sign-in request: the IGNIS sign-in body, made from `params.username` and
   * `params.password`. Override it when the API wants another shape; `opts.params` as it is posts
   * the login form unchanged.
   */
  protected buildSignInBody(opts: { params: ILoginParams }): unknown {
    return {
      identifier: { scheme: 'username', value: opts.params?.username },
      credential: { scheme: 'basic', value: opts.params?.password },
    };
  }

  /**
   * Reads `{ userId, roles?, token: { value, type } }` or `{ token: '<jwt>' }` (the user id is then a
   * claim of the token: `userId`, else `sub`). No token or no user id throws: storing `undefined`
   * would pass `login` and fail every check after it.
   */
  protected readSignInSession(opts: { data: unknown }): ISignInSession {
    const { userId, token, roles } = (opts.data ?? {}) as {
      userId?: unknown;
      token?: unknown;
      roles?: unknown;
    };

    const record =
      typeof token === 'string'
        ? { value: token, type: 'Bearer' }
        : (token as { value?: unknown; type?: unknown } | undefined);

    if (typeof record?.value !== 'string' || record.value.length === 0) {
      throw getError({
        message:
          '[login] The sign-in response carries no token | Expect { userId, token: { value, type } } or { token: <jwt> }',
      });
    }

    const claims = this.decodeJwtClaims({ jwt: record.value });

    const isUserId = (value: unknown): value is number | string => {
      return typeof value === 'number' || (typeof value === 'string' && value.length > 0);
    };

    const resolvedUserId = [userId, claims?.userId, claims?.sub].find(isUserId);

    if (resolvedUserId === undefined) {
      throw getError({
        message:
          '[login] The sign-in response carries no user id | Send userId next to the token, or put a userId or sub claim in the JWT',
      });
    }

    return {
      userId: resolvedUserId,
      token: {
        value: record.value,
        type: typeof record.type === 'string' ? record.type : 'Bearer',
      },
      roles: this.readRoleNames({ roles: roles ?? claims?.roles }),
    };
  }

  /** The claims of a JWT, or `undefined` for a token that is not one. The signature is not checked. */
  protected decodeJwtClaims(opts: { jwt: string }): Record<string, unknown> | undefined {
    const segment = opts.jwt.split('.')[1];

    if (!segment) {
      return undefined;
    }

    try {
      const bytes = Uint8Array.from(atob(segment.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
        char.charCodeAt(0),
      );
      const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));

      return typeof claims === 'object' && claims !== null
        ? (claims as Record<string, unknown>)
        : undefined;
    } catch (error) {
      // The name only: the message of a JSON parse error quotes the payload it could not parse.
      this.logger.debug(
        '[decodeJwtClaims] The token payload cannot be decoded, reading no claims | error: %s',
        error instanceof Error ? error.name : typeof error,
      );

      return undefined;
    }
  }

  /**
   * The role names of a list: a string is a name, and an object is named by its `identifier`, else
   * its `name` (IGNIS's role model has an `identifier`). An entry that is neither is skipped.
   */
  protected readRoleNames(opts: { roles: unknown }): Array<string> {
    if (!Array.isArray(opts.roles)) {
      return [];
    }

    const names: Array<string> = [];

    for (const role of opts.roles as Array<unknown>) {
      const named =
        typeof role === 'object' && role !== null ? (role as Record<string, unknown>) : {};
      const name =
        typeof role === 'string'
          ? role
          : [named.identifier, named.name].find((v) => typeof v === 'string');

      if (typeof name === 'string' && name.length > 0) {
        names.push(name);
      }
    }

    return names;
  }

  /** The username `login` remembers with the identity. Default: `params.username`. */
  protected resolveUsername(opts: { params: ILoginParams }): string {
    return opts.params?.username ?? '';
  }

  /**
   * Runs once the sign-in response is read and before the session is saved. A throw or a rejection
   * rejects `login` and nothing is saved: the place to refuse a user, or to hand the token to
   * another service.
   */
  protected beforeSaveSession(_opts: {
    session: ISignInSession;
    params: ILoginParams;
  }): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Saves the session where `checkAuth`, `getIdentity` and `getRoles` read it. A provider that
   * keeps the session elsewhere overrides this to do nothing; `login` still resolves.
   */
  protected saveSession(opts: { session: ISignInSession; username: string }): void {
    const { session, username } = opts;
    this.authService.saveAuth({
      token: session.token,
      userId: session.userId,
      roles: session.roles,
      username,
    });
  }

  // --- Session hooks -------------------------------------------------------------------------

  /**
   * Runs when a session starts or its token is replaced: after `login` saved it, after a `checkAuth`
   * confirmed it (the first one of a page that finds a stored session too), and whenever anything saves
   * a new token through `DefaultAuthService.saveAuth`, such as the refresh the network service makes on
   * a 401. `user` is the stored identity (`userId`, `username`,
   * `referenceId`, `provider`), or `{ userId, username }` when `saveSession` keeps nothing in the
   * store. A re-check of the same session does not call it again. It is awaited; a throw or a
   * rejection is logged and the caller carries on.
   */
  protected onSessionStarted(_opts: {
    token: IAuthTokenRecord;
    user: AnyType;
  }): void | Promise<void> {
    return undefined;
  }

  /**
   * Runs when the session this provider announced ends, with the reason: after `logout`, after the
   * 401 branch of `checkError`, when `checkAuth` rejects (that one does not clear the store), and when
   * other code calls `cleanUp` (reason `external`, for example the network service's `onAuthFailure`).
   * It is called once for a session, and not at all for one that was never announced. It is awaited;
   * a throw or a rejection is logged and the caller carries on.
   */
  protected onSessionCleared(_opts: { reason: TSessionClearReason }): void | Promise<void> {
    return undefined;
  }

  /**
   * Calls a hook after the hooks called before it. Its failure, and a hook that has not settled after
   * `sessionHookTimeout`, are logged and never reach the caller. A hook that waits for a provider
   * method waits behind itself until that timeout.
   */
  private runSessionHook(opts: { name: string; run: () => void | Promise<void> }): Promise<void> {
    const done = this.hookQueue.then(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(getError({ message: `did not settle in ${this.sessionHookTimeout} ms` }));
        }, this.sessionHookTimeout);
      });

      try {
        await Promise.race([opts.run(), timeout]);
      } catch (error) {
        this.logger.error('[%s] The hook failed, carrying on | error: %o', opts.name, error);
      } finally {
        clearTimeout(timer);
      }
    });
    this.hookQueue = done;

    return done;
  }

  /** Announces a session unless it is the one announced last. The claim is made before the hook is awaited. */
  private startSession(opts: { token: IAuthTokenRecord; user: AnyType }): Promise<void> {
    const session = [opts.user?.userId, opts.token.value].join('|');

    if (session === this.announcedSession) {
      return this.hookQueue;
    }

    this.announcedSession = session;

    return this.runSessionHook({
      name: 'onSessionStarted',
      run: () => this.onSessionStarted(opts),
    });
  }

  /** Announces the end of the session announced last, once. A session never announced ends silently. */
  private endSession(opts: { reason: TSessionClearReason }): Promise<void> {
    if (this.announcedSession === undefined) {
      return this.hookQueue;
    }

    this.announcedSession = undefined;

    return this.runSessionHook({
      name: 'onSessionCleared',
      run: () => this.onSessionCleared(opts),
    });
  }

  /** Announces or ends the session after the service saved or cleared it. */
  private syncSession(): Promise<void> {
    return this.authService.getAuth()?.value
      ? this.startStoredSession()
      : this.endSession({ reason: this.clearing ?? SessionClearReasons.EXTERNAL });
  }

  private async clearSession(opts: { reason: TSessionClearReason }): Promise<void> {
    this.clearing = opts.reason;

    try {
      this.authService.cleanUp();
    } finally {
      this.clearing = undefined;
    }

    await this.endSession(opts);
  }

  /** Announces the session in the store, when there is one. */
  private startStoredSession(): Promise<void> {
    const token = this.authService.getAuth();

    if (!token?.value) {
      return Promise.resolve();
    }

    return this.startSession({ token, user: this.authService.getUser() });
  }

  // --- react-admin's auth provider -------------------------------------------------------------

  /**
   * Posts the sign-in body to `signInPath`, stores the session and resolves `{ ...response,
   * redirectTo }`, where `redirectTo` is `afterLoginPath`. Rejects when the request fails, when the
   * response carries no token or user id, or when `beforeSaveSession` throws; no session is stored
   * then. Typed `Promise<unknown>` so that a subclass override of `login` keeps compiling.
   */
  async login(params: ILoginParams): Promise<unknown> {
    const response = await this.restDataProvider.send({
      resource: this.signInPath as TResource,
      params: { method: RequestMethods.POST, body: this.buildSignInBody({ params }) },
    });

    const session = this.readSignInSession({ data: response.data });

    // Before anything is saved, so a throw here leaves no session behind.
    await this.beforeSaveSession({ session, params });
    const username = this.resolveUsername({ params });
    this.saveSession({ session, username });

    // The store when it holds this session; else what the response said, for a `saveSession` that keeps it elsewhere.
    const stored = this.authService.getAuth();
    await this.startSession(
      stored?.value === session.token.value
        ? { token: stored, user: this.authService.getUser() }
        : { token: session.token, user: { userId: session.userId, username } },
    );

    return {
      ...response,
      redirectTo: removeDoubleSlashes(`/${this.afterLoginPath}`),
    };
  }

  /** Clears the session and resolves. */
  async logout(_params?: unknown): Promise<void> {
    await this.clearSession({ reason: SessionClearReasons.LOGOUT });
  }

  /**
   * Resolves when a token is stored and, if `paths.checkAuth` is set, the server answers with data.
   * Otherwise it ends the session (reason `rejected`) and rejects with `unauthenticatedRejection`;
   * it rejects with the request's error when the check request fails.
   */
  async checkAuth(_params?: unknown) {
    const token = this.authService.getAuth();

    if (!token?.value) {
      await this.endSession({ reason: SessionClearReasons.REJECTED });

      return Promise.reject(
        this.unauthenticatedRejection({ reason: SessionClearReasons.REJECTED }),
      );
    }

    if (!this.authProviderOptions.paths?.checkAuth) {
      await this.startStoredSession();

      return Promise.resolve();
    }

    const checked = this.announcedSession;
    const response = await this.restDataProvider.send({
      resource: this.authProviderOptions.paths.checkAuth as TResource,
      params: { method: RequestMethods.GET },
    });

    if (!response?.data) {
      // The answer belongs to the session announced before the request.
      if (this.announcedSession === checked) {
        await this.endSession({ reason: SessionClearReasons.REJECTED });
      }

      return Promise.reject(
        this.unauthenticatedRejection({ reason: SessionClearReasons.REJECTED }),
      );
    }

    await this.startStoredSession();

    return Promise.resolve();
  }

  /**
   * Resolves for every error but 401 and 403. A 401 clears the session (unless
   * `unauthenticatedRejection` says `logoutUser: false`) and rejects with that rejection; a 403
   * rejects with `{ redirectTo: unauthorizedPagePath, logoutUser: false }`.
   */
  async checkError(error: unknown) {
    const status = readStatus(error);

    if (status === 401) {
      const rejection = this.unauthenticatedRejection({ reason: SessionClearReasons.UNAUTHORIZED });

      if (rejection.logoutUser !== false) {
        await this.clearSession({ reason: SessionClearReasons.UNAUTHORIZED });
      }

      return Promise.reject(rejection);
    }

    if (status === 403) {
      return Promise.reject({
        redirectTo: this.unauthorizedPagePath,
        logoutUser: false,
      });
    }

    return Promise.resolve();
  }

  /** Resolves the stored user; rejects when there is no `userId`. */
  getIdentity(_params?: unknown) {
    const user = this.authService.getUser();

    if (!user?.userId) {
      return Promise.reject({ message: '[getIdentity] No userId to get user identity!' });
    }

    return Promise.resolve(user);
  }

  /** Resolves with nothing; the roles come from `getRoles`. */
  getPermissions(_params?: unknown) {
    return Promise.resolve();
  }

  /** Resolves the roles of the stored session. */
  getRoles(_params?: unknown) {
    return Promise.resolve(this.authService.getRoles());
  }

  /**
   * Refreshes the session through the network service's `refresh`, the one place a refresh is made:
   * `true` when it was refreshed, `false` when the service has no refresh to make. The `401`
   * recovery calls the same method, so one burst of 401s and this call share one refresh.
   *
   * @example
   * ```tsx
   * import { useRefreshToken } from '@venizia/ardor';
   *
   * // The data provider options name the refresh endpoint:
   * // { url: '/api', authRecovery: { refreshTokenPath: '/auth/refresh-token' } }
   * export const RefreshButton = () => {
   *   const refreshToken = useRefreshToken();
   *
   *   return <button onClick={() => refreshToken()}>Refresh</button>;
   * };
   * ```
   */
  async refreshToken(): Promise<boolean> {
    const isRefreshed = await this.restDataProvider.getNetworkService().refresh();

    if (isRefreshed) {
      await this.startStoredSession();
    }

    return isRefreshed;
  }

  override value(container: Container): IAuthProvider {
    // A subclass with its own constructor rarely forwards the optional 4th argument to `super`.
    const permissionProvider =
      this.permissionProvider ??
      container.get<IPermissionProvider>({
        key: CoreBindings.PERMISSION_PROVIDER,
        isOptional: true,
      });

    return {
      login: (params: ILoginParams) => this.login(params),
      logout: (params?: unknown) => this.logout(params),
      checkError: (error: unknown) => this.checkError(error),
      checkAuth: (params?: unknown) => this.checkAuth(params),
      getIdentity: (params?: unknown) => this.getIdentity(params),
      getPermissions: (params?: unknown) => this.getPermissions(params),
      getRoles: (params?: unknown) => this.getRoles(params),
      refreshToken: () => this.refreshToken(),
      // Absent without a permission provider, so react-admin keeps allowing everything.
      ...(permissionProvider
        ? {
            canAccess: (params: { resource: string; action: string; record?: unknown }) => {
              const { resource, action, record } = params;

              return permissionProvider.canAccess({ resource, action, record });
            },
          }
        : {}),
    };
  }
}
