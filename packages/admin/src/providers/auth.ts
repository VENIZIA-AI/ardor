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
import { type IAuthProvider, type IDataProvider } from '@/common';

/** The claims of a JWT, or `undefined` for a token that is not one. The signature is not checked. */
const decodeJwtClaims = (opts: { jwt: string }): Record<string, unknown> | undefined => {
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
  } catch {
    return undefined;
  }
};

const isUserId = (value: unknown): value is number | string => {
  return typeof value === 'number' || (typeof value === 'string' && value.length > 0);
};

/**
 * The role names of a list: a string is a name, and an object is named by its `identifier`, else
 * its `name` (IGNIS's role model has an `identifier`). An entry that is neither is skipped.
 */
const readRoleNames = (opts: { roles: unknown }): Array<string> => {
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
};

/**
 * What a sign-in response carries. IGNIS's auth controller returns whatever the application's
 * `signIn` returns, so two shapes are read: `{ userId, roles?, token: { value, type } }` (the
 * recommended one), and `{ token: '<jwt>' }`, a Bearer token whose user id is a claim of the token
 * itself (`userId`, else `sub`). Roles come from the response, else from the token's `roles`
 * claim. A response with no token or no user id throws: storing `undefined` would pass `login`
 * and fail every check after it.
 */
const readSignInSession = (opts: { data: unknown }): ISignInSession => {
  const { data } = opts;
  const { userId, token, roles } = (data ?? {}) as {
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

  const claims = decodeJwtClaims({ jwt: record.value });
  const resolvedUserId = [userId, claims?.userId, claims?.sub].find(isUserId);

  if (resolvedUserId === undefined) {
    throw getError({
      message:
        '[login] The sign-in response carries no user id | Send userId next to the token, or put a userId or sub claim in the JWT',
    });
  }

  return {
    userId: resolvedUserId,
    token: { value: record.value, type: typeof record.type === 'string' ? record.type : 'Bearer' },
    roles: readRoleNames({ roles: roles ?? claims?.roles }),
  };
};

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

  /**
   * The body of the sign-in request: `signInBody` of the options, else the IGNIS sign-in body made
   * from `params.username` and `params.password`. A subclass may override this instead.
   */
  protected buildSignInBody(params: AnyType): AnyType {
    if (this.authProviderOptions.signInBody) {
      return this.authProviderOptions.signInBody(params);
    }

    return {
      identifier: { scheme: 'username', value: params?.username },
      credential: { scheme: 'basic', value: params?.password },
    };
  }

  async login(params: AnyType) {
    const rs = await this.restDataProvider.send({
      resource: (this.authProviderOptions.paths?.signIn ?? '/auth/sign-in') as TResource,
      params: { method: RequestMethods.POST, body: this.buildSignInBody(params) },
    });

    const session = readSignInSession({ data: rs.data });

    // Before anything is saved, so a throw here leaves no session behind.
    await this.authProviderOptions.onSignIn?.({ session, params });

    if (this.authProviderOptions.persistSession ?? true) {
      this.authService.saveAuth({
        token: session.token,
        userId: session.userId,
        roles: session.roles,
        username: this.authProviderOptions.signInUsername?.(params) ?? params.username,
      });
    }

    return {
      ...rs,
      redirectTo: removeDoubleSlashes(`/${this.authProviderOptions.endpoints?.afterLogin ?? '/'}`),
    };
  }

  logout(_params: AnyType) {
    return new Promise<void>((resolve) => {
      this.authService.cleanUp();
      resolve();
    });
  }

  async checkAuth(_params: AnyType) {
    const token = this.authService.getAuth();

    if (!token?.value) {
      return Promise.reject({ redirectTo: '/login' });
    }

    if (!this.authProviderOptions.paths?.checkAuth) {
      return Promise.resolve();
    }

    const rs = await this.restDataProvider.send({
      resource: this.authProviderOptions.paths.checkAuth as TResource,
      params: { method: RequestMethods.GET },
    });

    if (!rs?.data) {
      return Promise.reject({ redirectTo: '/login' });
    }

    return Promise.resolve();
  }

  checkError(params: AnyType) {
    // react-admin's own HttpError carries `status`; an ApplicationError from the data provider carries `statusCode`.
    const status = params?.status ?? params?.statusCode;

    if (status === 401) {
      this.authService.cleanUp();
      return Promise.reject({ redirectTo: '/login' });
    }

    if (status === 403) {
      return Promise.reject({
        redirectTo: `/unauthorized`,
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

  refreshToken(): Promise<AnyType> {
    return Promise.resolve();
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
