---
title: Auth provider
description: DefaultAuthProvider and DefaultAuthService - options, what login stores, checkAuth, checkError, identity, roles, logout scope, and how an application subclasses and binds them.
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
| `IAuthProviderOptions` | interface | `paths.signIn`, `paths.signUp`, `paths.checkAuth`, `endpoints.afterLogin`. |
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
  endpoints?: {
    afterLogin?: string;
  };
  paths?: {
    signIn?: string;
    signUp?: string;
    checkAuth?: string;
  };
}
```

| Field | Used by | Default when missing |
|---|---|---|
| `paths.signIn` | `login` - the resource that receives `POST` with the login params | `/auth/login` |
| `paths.checkAuth` | `checkAuth` - the resource that receives `GET` to validate the stored token | not called; `checkAuth` only checks local storage |
| `paths.signUp` | not read by `DefaultAuthProvider`; available for subclasses | none |
| `endpoints.afterLogin` | `login` - the `redirectTo` value returned to react-admin | `/` |

```ts
import { type IAuthProviderOptions } from '@venizia/ardor';

const authProviderOptions: IAuthProviderOptions = {
  paths: {
    signIn: '/auth/login',
    checkAuth: '/auth/whoami',
  },
  endpoints: {
    afterLogin: '/dashboard',
  },
};
```

## login and what it stores

`login(params)` sends `params` as the body of a `POST` to `paths.signIn` through `restDataProvider.send`. It reads `userId` and `token` from the response `data`, saves them with `authService.saveAuth`, and resolves with the response plus a `redirectTo` built from `endpoints.afterLogin` (double slashes are removed).

The backend response `data` must contain at least:

```ts
type LoginResponseData = {
  userId: string | number;
  token: { value: string; type: string };
};
```

`DefaultAuthService.saveAuth` writes two `localStorage` entries:

| Key | Constant | Content |
|---|---|---|
| `@app/auth/token` | `LocalStorageKeys.KEY_AUTH_TOKEN` | `JSON.stringify({ ...token, provider })` |
| `@app/auth/identity` | `LocalStorageKeys.KEY_AUTH_IDENTITY` | `JSON.stringify({ userId, username, referenceId, provider })` |

`login` passes `params.username` as `username`. `provider` and `referenceId` default to an empty string. Nothing in `login` or `DefaultAuthService` writes `@app/auth/permission`.

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

## checkAuth

```ts
import { type AnyType } from '@venizia/ardor';

declare function checkAuth(_params: AnyType): Promise<void>;
```

The order is:

1. Read the token with `authService.getAuth()`. If there is no `token.value`, reject with `{ redirectTo: 'login' }`.
2. If `paths.checkAuth` is not set, resolve.
3. Otherwise send `GET paths.checkAuth`. If the response has no `data`, reject with `{ redirectTo: 'login' }`. Otherwise resolve.

Set `paths.checkAuth` only when you want a server round trip on every check. Without it, a token in storage is enough.

## checkError

```ts
import { type AnyType } from '@venizia/ardor';

declare function checkError(params: AnyType): Promise<void>;
```

Only `params.status` is read.

| Status | Effect | Result |
|---|---|---|
| `401` | `authService.cleanUp()` runs first | rejects with `{ redirectTo: 'login' }` |
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

`getRoles` resolves with `authService.getRoles()`, which parses `@app/auth/permission` (`LocalStorageKeys.KEY_AUTH_PERMISSION`) as a JSON array and returns it as a `Set<string>`. An empty or missing value gives an empty set. Because the base class never writes that key, the set stays empty unless your application stores it.

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

The base implementation resolves with `undefined` and does not call the backend. Override it when your API has a refresh endpoint. The `IAuthRecoveryOptions.refreshToken` hook of the REST data provider is a separate entry point - see [Network](../references/network).

```ts
import { DefaultAuthProvider, RequestMethods } from '@venizia/ardor';

export class AppAuthProvider extends DefaultAuthProvider {
  override async refreshToken() {
    const rs = await this.restDataProvider.send({
      resource: '/auth/refresh',
      params: { method: RequestMethods.POST },
    });

    const { userId, token } = rs.data;
    this.authService.saveAuth({ userId, token });
    return rs.data;
  }
}
```

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
import { type AnyType, DefaultAuthProvider, LocalStorageKeys } from '@venizia/ardor';

export class AppAuthProvider extends DefaultAuthProvider {
  override async login(params: AnyType) {
    const rs = await super.login(params);

    // The base class never writes this key; store roles so getRoles() returns them.
    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_PERMISSION,
      JSON.stringify((rs as AnyType).data?.roles ?? []),
    );

    return rs;
  }

  override checkError(params: AnyType) {
    if (params?.status === 403) {
      return Promise.reject({ redirectTo: '/forbidden', logoutUser: false });
    }
    return super.checkError(params);
  }
}
```

## Binding the provider

Three bindings are involved, plus one entry in the REST data provider options:

- `CoreBindings.DEFAULT_AUTH_SERVICE` - bound `toClass` `DefaultAuthService`.
- `CoreBindings.AUTH_PROVIDER_OPTIONS` - bound to your `IAuthProviderOptions` value.
- `CoreBindings.DEFAULT_AUTH_PROVIDER` - bound `toProvider` your subclass (or `DefaultAuthProvider` itself).
- `IRestDataProviderOptions.noAuthPaths` - must contain the sign-in path, so the login request goes out without an authorization header.

```ts no-check
import {
  BaseArdorApplication,
  CoreBindings,
  DefaultAuthService,
  type IAuthProviderOptions,
  type IRestDataProviderOptions,
} from '@venizia/ardor';
import { AppAuthProvider } from './auth-provider';

const authProviderOptions: IAuthProviderOptions = {
  paths: { signIn: '/auth/login', checkAuth: '/auth/whoami' },
  endpoints: { afterLogin: '/dashboard' },
};

const restDataProviderOptions: IRestDataProviderOptions = {
  url: 'https://api.example.com',
  noAuthPaths: ['/auth/login'],
};

export class Application extends BaseArdorApplication {
  override bindContext() {
    ...
    this.container.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).to(restDataProviderOptions);
    this.container.bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).to(authProviderOptions);
    this.container.bind({ key: CoreBindings.DEFAULT_AUTH_SERVICE }).toClass(DefaultAuthService);
    this.container.bind({ key: CoreBindings.DEFAULT_AUTH_PROVIDER }).toProvider(AppAuthProvider);
    ...
  }
}
```

The binding API itself is documented in [Application](../references/application) and the key list in [Binding keys](../references/binding-keys).

## Common pitfalls

- `login` expects `data.userId` and `data.token` in the response. A backend that returns a bare string token will store `undefined` and `checkAuth` will reject.
- `paths.signIn` and `noAuthPaths` must hold the same string. `noAuthPaths` is an exact match list, not a pattern.
- `getRoles` reads `@app/auth/permission`, but nothing in the base classes writes it. Store it yourself or the set is always empty.
- `checkError` on `403` does not log the user out. If you want a `403` to end the session, override it.
- `cleanUp` only removes keys under `@app/auth/` and `@app/oauth2/`. Keep session data under those prefixes if it should disappear on logout.
- `getIdentity` rejects when there is no `userId`. Do not call it before login and expect an empty object.
- `refreshToken` and `getPermissions` are no-ops in the base class. Overriding one of them does not affect the other.

## Related

- [Application](../references/application)
- [Binding keys](../references/binding-keys)
- [Data provider](../references/data-provider)
- [Network](../references/network)
- [Hooks](../references/hooks)
- [Types](../references/types)
- [Quickstart](../guides/get-started/quickstart)
- [Migration from ra-core-infra](../guides/migration/from-ra-core-infra)
