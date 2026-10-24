import { type Container, getError, inject } from '@venizia/ignis-inversion';
import { removeDoubleSlashes } from 'ra-core';

import {
  type AnyType,
  BaseProvider,
  CoreBindings,
  type DefaultAuthService,
  type IAuthProviderOptions,
  type ISignInSession,
  type IPermissionProvider,
  RequestMethods,
} from '@venizia/ardor-kernel';
import type { IAuthProvider, IDataProvider } from '@/common';

/**
 * The options hold data (`paths`); behaviour is in the protected hooks, each taking one `opts`
 * object: `buildSignInBody`, `resolveUsername`, `beforeSaveSession`, `saveSession` and
 * `readSignInSession` around `login`, and the page paths (`signInPath`, `afterLoginPath`,
 * `loginPagePath`, `unauthorizedPagePath`).
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
  }

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

  // --- Sign-in hooks ---------------------------------------------------------------------------

  /**
   * The body of the sign-in request: the IGNIS sign-in body, made from `params.username` and
   * `params.password`. Override it when the API wants another shape; `opts.params` as it is posts
   * the login form unchanged.
   */
  protected buildSignInBody(opts: { params: AnyType }): unknown {
    return {
      identifier: { scheme: 'username', value: opts.params?.username },
      credential: { scheme: 'basic', value: opts.params?.password },
    };
  }

  /**
   * What a sign-in response carries. IGNIS's auth controller returns whatever the application's
   * `signIn` returns, so two shapes are read: `{ userId, roles?, token: { value, type } }` (the
   * recommended one), and `{ token: '<jwt>' }`, a Bearer token whose user id is a claim of the token
   * itself (`userId`, else `sub`). Roles come from the response, else from the token's `roles`
   * claim. A response with no token or no user id throws: storing `undefined` would pass `login`
   * and fail every check after it.
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
      const bytes = Uint8Array.from(atob(segment.replace(/-/g, '+').replace(/_/g, '/')), char =>
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
          : [named.identifier, named.name].find(v => typeof v === 'string');
      if (typeof name === 'string' && name.length > 0) {
        names.push(name);
      }
    }

    return names;
  }

  /** The username `login` remembers with the identity. Default: `params.username`. */
  protected resolveUsername(opts: { params: AnyType }): string {
    return opts.params?.username ?? '';
  }

  /**
   * Runs once the sign-in response is read and before the session is saved. A throw or a rejection
   * rejects `login` and nothing is saved: the place to refuse a user, or to hand the token to
   * another service.
   */
  protected beforeSaveSession(_opts: { session: ISignInSession; params: AnyType }): Promise<void> {
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

  // --- react-admin's auth provider -------------------------------------------------------------

  /**
   * Typed `Promise<unknown>`, as it was before it became async: a subclass that overrides `login`
   * with that signature keeps compiling.
   */
  async login(params: AnyType): Promise<unknown> {
    const rs = await this.restDataProvider.send({
      resource: this.signInPath as TResource,
      params: { method: RequestMethods.POST, body: this.buildSignInBody({ params }) },
    });

    const session = this.readSignInSession({ data: rs.data });

    // Before anything is saved, so a throw here leaves no session behind.
    await this.beforeSaveSession({ session, params });
    this.saveSession({ session, username: this.resolveUsername({ params }) });

    return {
      ...rs,
      redirectTo: removeDoubleSlashes(`/${this.afterLoginPath}`),
    };
  }

  logout(_params: AnyType) {
    return new Promise<void>(resolve => {
      this.authService.cleanUp();
      resolve();
    });
  }

  async checkAuth(_params: AnyType) {
    const token = this.authService.getAuth();

    if (!token?.value) {
      return Promise.reject({ redirectTo: this.loginPagePath });
    }

    if (!this.authProviderOptions.paths?.checkAuth) {
      return Promise.resolve();
    }

    const rs = await this.restDataProvider.send({
      resource: this.authProviderOptions.paths.checkAuth as TResource,
      params: { method: RequestMethods.GET },
    });

    if (!rs?.data) {
      return Promise.reject({ redirectTo: this.loginPagePath });
    }

    return Promise.resolve();
  }

  checkError(params: AnyType) {
    // react-admin's own HttpError carries `status`; an ApplicationError from the data provider carries `statusCode`.
    const status = params?.status ?? params?.statusCode;

    if (status === 401) {
      this.authService.cleanUp();
      return Promise.reject({ redirectTo: this.loginPagePath });
    }

    if (status === 403) {
      return Promise.reject({
        redirectTo: this.unauthorizedPagePath,
        logoutUser: false,
      });
    }

    return Promise.resolve();
  }

  getIdentity(_params: AnyType) {
    const user = this.authService.getUser();

    if (!user?.userId) {
      return Promise.reject({ message: '[getIdentity] No userId to get user identity!' });
    }

    return Promise.resolve(user);
  }

  getPermissions(_params: AnyType) {
    return Promise.resolve();
  }

  getRoles(_params: AnyType) {
    return Promise.resolve(this.authService.getRoles());
  }

  /**
   * Refreshes the session through the network service's `refresh`, the one place a refresh is made:
   * `true` when it was refreshed, `false` when the service has no refresh to make. The `401`
   * recovery calls the same method, so one burst of 401s and this call share one refresh.
   */
  refreshToken(): Promise<AnyType> {
    return this.restDataProvider.getNetworkService().refresh();
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
      login: (params: AnyType) => this.login(params),
      logout: (params: AnyType) => this.logout(params),
      checkError: (params: AnyType) => this.checkError(params),
      checkAuth: (params: AnyType) => this.checkAuth(params),
      getIdentity: (params: AnyType) => this.getIdentity(params),
      getPermissions: (params: AnyType) => this.getPermissions(params),
      getRoles: (params: AnyType) => this.getRoles(params),
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
