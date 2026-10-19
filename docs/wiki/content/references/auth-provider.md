---
title: Auth provider
description: DefaultAuthProvider and DefaultAuthService - options, what login sends and stores (the IGNIS sign-in contract by default, and how to keep another), checkAuth, checkError, identity, roles, logout scope, an application with no sign-in, and how an application subclasses and binds them.
---

# Auth provider

`DefaultAuthProvider` is the react-admin auth provider shipped with ARDOR. It talks to the backend through the REST data provider, and it keeps the session in `localStorage` through `DefaultAuthService`. An application usually subclasses it, overrides a few methods, and binds the subclass on the IGNIS container.

## Prerequisites

A running application with the REST data provider bound - see [Application](../references/application) and [Data provider](../references/data-provider).

## Quick Reference

| Export | Kind | Role |
|---|---|---|
| `DefaultAuthProvider` | class | `BaseProvider<IAuthProvider>`. `value(container)` returns the object react-admin consumes. |
| `DefaultAuthService` | class | `localStorage` access: `getAuth`, `getUser`, `getRoles`, `saveAuth`, `cleanUp`. |
| `IAuthProviderOptions` | interface | Data only: `paths.signIn`, `paths.checkAuth`, `paths.afterLogin`. Behaviour is in the provider's protected hooks. |
| `IAuthProvider` | interface | `IReactAdminAuthProvider` plus `getRoles` and `refreshToken`. |
| `IReactAdminAuthProvider` | interface | The plain react-admin contract: `login`, `logout`, `checkAuth`, `checkError`, `getIdentity`, `getPermissions`. |
| `LocalStorageKeys` | class | `KEY_AUTH_TOKEN`, `KEY_AUTH_IDENTITY`, `KEY_AUTH_PERMISSION`. |
| `CoreBindings` | class | `DEFAULT_AUTH_PROVIDER`, `DEFAULT_AUTH_SERVICE`, `AUTH_PROVIDER_OPTIONS`, `DEFAULT_REST_DATA_PROVIDER`. |

## The provider contract

`IAuthProvider` extends the react-admin contract with two extra methods. `DefaultAuthProvider.value()` returns an object with every method bound to the instance, so react-admin can call them without `this`.

```ts no-check
interface IReactAdminAuthProvider {
  login: (params: AnyType) => Promise<{ redirectTo?: string | boolean } | void | AnyType>;
  logout: (params: AnyType) => Promise<void | false | string>;
  checkAuth: (params: AnyType & QueryFunctionContext) => Promise<void>;
  checkError: (error: AnyType) => Promise<void>;
  getIdentity?: (params?: QueryFunctionContext) => Promise<UserIdentity>;
  getPermissions: (params: AnyType & QueryFunctionContext) => Promise<AnyType>;
}

interface IAuthProvider extends IReactAdminAuthProvider {
  getRoles: (params?: AnyType) => Promise<Set<string>>;
  refreshToken: () => Promise<AnyType>;
}
```

## IAuthProviderOptions

The options object is bound under `CoreBindings.AUTH_PROVIDER_OPTIONS` and injected into the provider. Every field is optional.

```ts no-check
interface IAuthProviderOptions {
  paths?: {
    signIn?: string;
    checkAuth?: string;
    afterLogin?: string;
  };
}
```

| Field | Used by | Default when missing |
|---|---|---|
| `paths.signIn` | `login` - the resource that receives `POST` with the sign-in body | `/auth/sign-in`, the IGNIS auth controller's route |
| `paths.checkAuth` | `checkAuth` - the resource that receives `GET` to validate the stored token | not called; `checkAuth` only checks local storage |
| `paths.afterLogin` | `login` - the `redirectTo` value returned to react-admin | `/` |

```ts
import { type IAuthProviderOptions } from '@venizia/ardor';

const authProviderOptions: IAuthProviderOptions = {
  paths: {
    checkAuth: '/auth/whoami',
    afterLogin: '/dashboard',
  },
};
```

## login and what it stores

`login(params)` sends a `POST` to `paths.signIn` (default `/auth/sign-in`) through `restDataProvider.send`. The body is `buildSignInBody({ params })`: the IGNIS sign-in body made from `params.username` and `params.password`. The provider reads the session from the response `data`, saves it with `saveSession` (by default `authService.saveAuth`), and resolves with the response plus a `redirectTo` built from `paths.afterLogin` (double slashes are removed).

IGNIS's auth controller has no fixed sign-in response: it returns whatever your application's `signIn` returns. The response `data` is read in either of two shapes, the first being the recommended one:

```ts
type LoginResponseData =
  | { userId: string | number; roles?: Array<string | { identifier?: string; name?: string }>; token: { value: string; type: string } }
  | { userId?: string | number; roles?: Array<string | { identifier?: string; name?: string }>; token: string };
```

- **The token.** A bare string token is stored as a `Bearer` token. A `userId` that is not sent is read from the token's own claims: `userId`, else `sub`. The JWT's signature is not checked - the server does that on every request.
- **The roles.** `roles` of the response, else the `roles` claim of the token, are saved where `getRoles` reads them (`@app/auth/permission`). An entry is a string, or an object named by its `identifier` (IGNIS's role model: `{ id, identifier, priority }`) or else its `name`; any other entry is skipped. Each login replaces the roles of the last user, and a response with none leaves the set empty.
- **Failure.** A response with no token, or with no user id anywhere, rejects `login` with a `[login]` error and stores nothing.

`DefaultAuthService.saveAuth` writes two `localStorage` entries:

| Key | Constant | Content |
|---|---|---|
| `@app/auth/token` | `LocalStorageKeys.KEY_AUTH_TOKEN` | `JSON.stringify({ ...token, provider })` |
| `@app/auth/identity` | `LocalStorageKeys.KEY_AUTH_IDENTITY` | `JSON.stringify({ userId, username, referenceId, provider })` |

`login` passes `params.username` as `username`. `provider` and `referenceId` default to an empty string. `saveAuth` also takes `roles` (an array of strings) and writes `@app/auth/permission` with them; called without `roles`, as a token refresh does, it leaves the stored roles alone.

```ts
import { DefaultAuthService, LocalStorageKeys } from '@venizia/ardor';

const authService = new DefaultAuthService();

authService.saveAuth({
  userId: 'user-1',
  username: 'admin',
  token: { value: 'eyJ...', type: 'Bearer' },
});

const rawToken = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
// '{"value":"eyJ...","type":"Bearer","provider":""}'

const auth = authService.getAuth();
// { value: 'eyJ...', type: 'Bearer', provider: '' }
```

`getAuth` returns `null` and logs an error if the stored value cannot be parsed.

## Hooks around login

`login` is a sequence of four protected hooks, so a subclass changes one step and keeps the rest. They take one `opts` object each, and can use `this` and the injected services (`restDataProvider`, `authProviderOptions`, `authService`). The order is: send the sign-in request with `buildSignInBody`, read the response, `beforeSaveSession`, `saveSession` (with `resolveUsername`), resolve with `redirectTo`.

| Hook | Default | Override it to |
|---|---|---|
| `buildSignInBody({ params })` | The IGNIS sign-in body, from `params.username` and `params.password` | Post another body; return `params` to post the login form as it is |
| `resolveUsername({ params })` | `params.username` | Name the user the form identifies another way |
| `beforeSaveSession({ session, params })` | Nothing; awaited | Refuse a user, or hand the token to another service: a throw or a rejection rejects `login` and nothing is saved |
| `saveSession({ session, username })` | `authService.saveAuth` | Keep the session elsewhere: do nothing, and `login` still resolves |
| `readSignInSession({ data })` | The two response shapes described above | Read a sign-in response of another shape; it also has `decodeJwtClaims({ jwt })` and `readRoleNames({ roles })` |

`session` is `{ userId, token: { value, type }, roles }`, as read from the response. `params` is the login form's params.

```ts
import { type AnyType, DefaultAuthProvider, type ISignInSession } from '@venizia/ardor';

export class AdminAuthProvider extends DefaultAuthProvider {
  // The form sends { identifier: { value }, password }, not { username }.
  protected override resolveUsername(opts: { params: AnyType }) {
    return opts.params.identifier.value;
  }

  // Refuse a user, or hand the token to another service. Nothing is saved when this throws.
  protected override async beforeSaveSession(opts: { session: ISignInSession; params: AnyType }) {
    if (!opts.session.roles.includes('admin')) {
      throw new Error('[signIn] This console is for administrators');
    }
  }
}
```

The pages `login`, `checkAuth` and `checkError` name are protected getters too: `signInPath` (`paths.signIn`, else `/auth/sign-in`), `afterLoginPath` (`paths.afterLogin`, else `/`), `loginPagePath` (`/login`, react-admin's route) and `unauthorizedPagePath` (`/unauthorized`). Override one when the application mounts the page elsewhere.

A provider that keeps the session elsewhere overrides `saveSession` to do nothing; `beforeSaveSession` still runs, with the session in hand. `checkAuth` then finds no stored token, so such an application supplies its own check.

## The sign-in contract

The defaults are the contract of IGNIS's auth controller (`useAuthController: true`), since ARDOR is IGNIS's frontend:

| | Default (IGNIS) | The previous contract, kept in a subclass |
|---|---|---|
| Path | `/auth/sign-in` | `paths: { signIn: '/auth/login' }` in the options |
| Request body | `{ identifier: { scheme: 'username', value: username }, credential: { scheme: 'basic', value: password } }` | a `buildSignInBody` that returns `params`, so the form is posted as it is |
| Response | whatever your `signIn` returns; recommended `{ userId, roles?, token: { value, type } }` | the same; `login` also reads `{ token: '<jwt>' }`, so nothing to override |

The path must also be in `noAuthPaths`, so the sign-in request goes out without an `Authorization` header. The response shapes, the user id and the roles are described in [login and what it stores](#login-and-what-it-stores).

```ts
import { type IAuthProviderOptions, type IRestDataProviderOptions } from '@venizia/ardor';

// IGNIS: nothing to set but noAuthPaths.
export const ignisRestOptions: IRestDataProviderOptions = {
  url: 'https://api.example.com',
  noAuthPaths: ['/auth/sign-in'],
};

// Another API signs in at its own path: data in the options...
export const formRestOptions: IRestDataProviderOptions = {
  url: 'https://api.example.com',
  noAuthPaths: ['/auth/login'],
};

export const formAuthOptions: IAuthProviderOptions = {
  paths: { signIn: '/auth/login' },
};
```

```ts
import { type AnyType, DefaultAuthProvider } from '@venizia/ardor';

// ...and the body in a hook: the login form as it is.
export class FormAuthProvider extends DefaultAuthProvider {
  protected override buildSignInBody(opts: { params: AnyType }) {
    return opts.params;
  }
}
```

A login form that is not `{ username, password }` (an e-mail, another scheme) maps its own fields the same way:

```ts
import { type AnyType, DefaultAuthProvider } from '@venizia/ardor';

export class EmailAuthProvider extends DefaultAuthProvider {
  protected override buildSignInBody(opts: { params: AnyType }) {
    return {
      identifier: { scheme: 'email', value: opts.params.email },
      credential: { scheme: 'basic', value: opts.params.password },
    };
  }
}
```

## An application with no sign-in

`ArdorApplication` reads `CoreBindings.DEFAULT_AUTH_PROVIDER` as optional. Leave it, `AUTH_PROVIDER_OPTIONS` and `DEFAULT_AUTH_SERVICE` unbound and react-admin runs without an auth provider: no login page, no `checkAuth`, every page public. Set `noAuthPathRegex: /./` on the REST options so the data provider sends no `Authorization` header.

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class PublicConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return { url: 'https://api.example.com', noAuthPathRegex: /./ };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }
}
```

The data provider and the i18n provider stay required. Bind the i18n options and provider as in the [quickstart](../guides/get-started/quickstart).

## checkAuth

```ts
import { type AnyType } from '@venizia/ardor';

declare function checkAuth(_params: AnyType): Promise<void>;
```

The order is:

1. Read the token with `authService.getAuth()`. If there is no `token.value`, reject with `{ redirectTo: '/login' }`.
2. If `paths.checkAuth` is not set, resolve.
3. Otherwise send `GET paths.checkAuth`. If the response has no `data`, reject with `{ redirectTo: '/login' }`. Otherwise resolve.

Set `paths.checkAuth` only when you want a server round trip on every check. Without it, a token in storage is enough.

## checkError

```ts
import { type AnyType } from '@venizia/ardor';

declare function checkError(params: AnyType): Promise<void>;
```

The status is `params.status` - react-admin's own `HttpError` - or, when that is absent, `params.statusCode`: an error thrown by `doRequest` is an `ApplicationError` that carries only `statusCode` (see [Network](../references/network#error-shape-on-non-2xx)). An override that reads only `status` never sees a data provider failure.

| Status | Effect | Result |
|---|---|---|
| `401` | `authService.cleanUp()` runs first | rejects with `{ redirectTo: '/login' }` |
| `403` | nothing is removed from storage | rejects with `{ redirectTo: '/unauthorized', logoutUser: false }` |
| anything else | none | resolves |

The `403` branch keeps the session. Your router needs an `/unauthorized` route for that redirect to land somewhere.

## getIdentity

```ts
import { type AnyType } from '@venizia/ardor';

// react-admin's UserIdentity type
type UserIdentity = AnyType;

declare function getIdentity(_params: AnyType): Promise<UserIdentity>;
```

Reads `@app/auth/identity` through `authService.getUser()`. If the parsed object has no `userId`, it rejects with `{ message: '[getIdentity] No userId to get user identity!' }`. Otherwise it resolves with the stored object: `{ userId, username, referenceId, provider }`. The token is not part of the identity.

## getRoles and getPermissions

```ts
import { type AnyType } from '@venizia/ardor';

declare function getRoles(_params: AnyType): Promise<Set<string>>;
declare function getPermissions(_params: AnyType): Promise<void>;
```

For react-admin's `canAccess` - the method behind `useCanAccess` and `<CanAccess>` - bind an `IPermissionProvider` under `CoreBindings.PERMISSION_PROVIDER`: `DefaultAuthProvider` then exposes `canAccess({ resource, action, record })` and answers from it. Without one there is no `canAccess`, and react-admin allows everything. A subclass that declares its own constructor needs no change: the provider is read from the container too, and one passed to `super` as the fourth argument wins. See [Features and permissions](./features#permissions).

`getRoles` resolves with `authService.getRoles()`, which parses `@app/auth/permission` (`LocalStorageKeys.KEY_AUTH_PERMISSION`) as a JSON array and returns it as a `Set<string>`. An empty or missing value gives an empty set. `login` writes the key from the `roles` of the sign-in response (see [login and what it stores](#login-and-what-it-stores)); an application whose API sends roles another way stores them with `authService.saveAuth({ ..., roles })`.

`getPermissions` resolves with `undefined` in the base class. Override it if react-admin's `usePermissions` should return something.

```ts
import { type AnyType, DefaultAuthProvider, RequestMethods } from '@venizia/ardor';

export class AppAuthProvider extends DefaultAuthProvider {
  override async getPermissions(_params: AnyType) {
    const rs = await this.restDataProvider.send({
      resource: '/auth/permissions',
      params: { method: RequestMethods.GET },
    });
    return rs.data;
  }
}
```

## refreshToken

```ts
import { type AnyType } from '@venizia/ardor';

declare function refreshToken(): Promise<AnyType>;
```

`refreshToken` calls `restDataProvider.getNetworkService().refresh()` and resolves `true` when the session was refreshed, `false` when the network service has no refresh to make (its default). The refresh itself is not here: it is the `refreshToken` hook of `DefaultNetworkRequestService`, so a refresh is made in one place. The `401` recovery calls the same `refresh()`, and one burst of `401`s plus this call share one refresh. `useRefreshToken` calls this method. See [Auth recovery](../best-practices/auth-recovery) for the subclass that implements it and [Network](../references/network) for the hooks.

## logout and cleanUp scope

```ts
import { type AnyType } from '@venizia/ardor';

declare function logout(_params: AnyType): Promise<void>;
```

`logout` calls `authService.cleanUp()` and resolves. `cleanUp` walks every `localStorage` key and removes the ones that start with `@app/auth/` or `@app/oauth2/`. Everything else in `localStorage` is left alone.

This is the same call `checkError` makes on `401`. If your application stores session data under another prefix, it survives logout.

## Subclassing DefaultAuthProvider

The constructor injects three fields, all `protected`, so overrides can use them:

| Field | Type | Injected from |
|---|---|---|
| `restDataProvider` | `IDataProvider<TResource>` | `CoreBindings.DEFAULT_REST_DATA_PROVIDER` |
| `authProviderOptions` | `IAuthProviderOptions` | `CoreBindings.AUTH_PROVIDER_OPTIONS` |
| `authService` | `DefaultAuthService` | `CoreBindings.DEFAULT_AUTH_SERVICE` |

A subclass without its own constructor keeps that injection. `value()` calls the methods through `this`, so an overridden method is what react-admin gets.

```ts
import { type AnyType, DefaultAuthProvider } from '@venizia/ardor';

export class AppAuthProvider extends DefaultAuthProvider {
  override checkError(params: AnyType) {
    if (params?.status === 403) {
      return Promise.reject({ redirectTo: '/forbidden', logoutUser: false });
    }
    return super.checkError(params);
  }
}
```

## Binding the provider

Five bindings are involved. The REST data provider options carry one entry that matters here:

- `CoreBindings.DEFAULT_AUTH_SERVICE` - provided by `DefaultAuthService`.
- `CoreBindings.AUTH_PROVIDER_OPTIONS` - provided as your `IAuthProviderOptions` value.
- `CoreBindings.DEFAULT_AUTH_PROVIDER` - provided as your subclass (or `DefaultAuthProvider` itself).
- `CoreBindings.REST_DATA_PROVIDER_OPTIONS` - provided as your `IRestDataProviderOptions` value. Its `noAuthPaths` must contain the sign-in path, so the login request goes out without an authorization header.
- `CoreBindings.DEFAULT_REST_DATA_PROVIDER` - provided as `DefaultRestDataProvider`, the provider the auth provider sends its requests through.

Declare all of them in a `@configuration()` class:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  BaseArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultRestDataProvider,
  type IApplicationInfo,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class AuthConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions() {
    return {
      url: 'https://api.example.com',
      noAuthPaths: ['/auth/sign-in'],
    };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions() {
    return {
      paths: { checkAuth: '/auth/whoami', afterLogin: '/dashboard' },
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
  authService() {
    return this.application.instantiate(DefaultAuthService);
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
  authProvider() {
    // AppAuthProvider (the subclass above) or DefaultAuthProvider itself.
    return this.application.instantiate(DefaultAuthProvider).value(this.application);
  }
}

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'app', version: '1.0.0', description: 'App with auth' };
  }

  bindContext(): void {}
}
```

The binding API itself is documented in [Application](../references/application) and the key list in [Binding keys](../references/binding-keys).

## Common pitfalls

- `login` rejects a response that has no token, or no user id in the response or the token's claims. A backend whose token is not a JWT must send `userId` next to it.
- `paths.signIn` defaults to `/auth/sign-in`. An API that signs in elsewhere sets `paths.signIn`, and a `buildSignInBody` override when it takes the form as it is (see [The sign-in contract](#the-sign-in-contract)); without a matching `noAuthPaths` entry the first request fails before it is sent.
- `paths.signIn` and `noAuthPaths` must hold the same string. `noAuthPaths` is an exact match list, not a pattern.
- `getRoles` reads `@app/auth/permission`, which `login` fills from the `roles` of the sign-in response or the token's `roles` claim. A response with neither leaves the set empty.
- `checkError` on `403` does not log the user out. If you want a `403` to end the session, override it.
- `cleanUp` only removes keys under `@app/auth/` and `@app/oauth2/`. Keep session data under those prefixes if it should disappear on logout.
- `getIdentity` rejects when there is no `userId`. Do not call it before login and expect an empty object.
- `getPermissions` is a no-op in the base class, and `refreshToken` refreshes nothing until the network service's `refreshToken` hook is overridden.

## Related

- [Application](../references/application)
- [Binding keys](../references/binding-keys)
- [Data provider](../references/data-provider)
- [Network](../references/network)
- [Hooks](../references/hooks)
- [Types](../references/types)
- [Quickstart](../guides/get-started/quickstart)
- [Migration from ra-core-infra](../guides/migration/from-ra-core-infra)
