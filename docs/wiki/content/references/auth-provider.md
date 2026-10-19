---
title: Auth provider
description: DefaultAuthProvider and DefaultAuthService - sign-in contract, storage keys, options, hooks, method table, and configuring an app with no sign-in.
---

# Auth provider

`DefaultAuthProvider` bridges react-admin authentication with the backend API through the REST data provider, storing authentication tokens, identity records, and role sets in `localStorage` via `DefaultAuthService`. An application configures endpoint paths through `IAuthProviderOptions`, overrides protected hooks on `DefaultAuthProvider` for custom authentication protocols, or omits authentication entirely.

## What it does

`DefaultAuthProvider` handles authentication credentials, session persistence, and authorization checks for react-admin. On sign-in, it transmits credentials to the API, validates the resulting session token and identity, and persists the session to `localStorage`. On subsequent requests and page changes, it verifies token presence, evaluates error statuses, extracts user identity, and checks permissions.

| Export | Kind | Purpose |
| --- | --- | --- |
| `DefaultAuthProvider` | class | react-admin auth provider implementing `IAuthProvider` |
| `DefaultAuthService` | class | Service managing auth tokens, identity, and permissions in `localStorage` |
| `IAuthProviderOptions` | interface | Configuration options for authentication routes under `paths` |
| `IAuthProvider` | interface | Extended react-admin auth provider including `getRoles` and `refreshToken` |
| `IReactAdminAuthProvider` | interface | Standard react-admin auth provider contract |
| `ISignInSession` | interface | Parsed sign-in session carrying `userId`, `token`, and `roles` |
| `LocalStorageKeys` | class | `localStorage` key constants: `KEY_AUTH_TOKEN`, `KEY_AUTH_IDENTITY`, `KEY_AUTH_PERMISSION` |
| `CoreBindings` | class | Container keys: `DEFAULT_AUTH_PROVIDER`, `AUTH_PROVIDER_OPTIONS`, `DEFAULT_AUTH_SERVICE` |

## How to provide it

The configuration class is the main way to configure ARDOR: a `@configuration()` class whose `@provide({ key })` methods return the options or the provider instances; `start()` binds each as a lazy SINGLETON. As described in [The bind order](../guides/core-concepts/configuration), the three keys this page needs (`CoreBindings.AUTH_PROVIDER_OPTIONS`, `CoreBindings.DEFAULT_AUTH_SERVICE`, and `CoreBindings.DEFAULT_AUTH_PROVIDER`) are bound by `@provide` methods of the application's configuration class:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultRestDataProvider,
  type IAuthProviderOptions,
  type IRestDataProviderOptions,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class AuthConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return {
      url: 'https://api.example.com',
      noAuthPaths: ['/auth/sign-in'],
    };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): IAuthProviderOptions {
    return {
      paths: {
        signIn: '/auth/sign-in',
        checkAuth: '/auth/whoami',
        afterLogin: '/',
      },
    };
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
  authService(): DefaultAuthService {
    return this.application.instantiate(DefaultAuthService);
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
  authProvider() {
    return this.application.instantiate(DefaultAuthProvider).value(this.application);
  }
}
```

The default provider class is `DefaultAuthProvider` in `packages/admin/src/providers/auth.ts`. The default session storage service is `DefaultAuthService` in `packages/kernel/src/base/services/auth.ts`. The container binding keys defined in `packages/kernel/src/common/keys.ts` are `CoreBindings.AUTH_PROVIDER_OPTIONS`, `CoreBindings.DEFAULT_AUTH_SERVICE`, and `CoreBindings.DEFAULT_AUTH_PROVIDER`.

## Options

`IAuthProviderOptions` in `packages/kernel/src/common/types.ts` defines route paths for authentication operations.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `paths` | `object` | `undefined` | Endpoint routing settings (the whole object is optional) |
| `paths.signIn` | `string` | `'/auth/sign-in'` | API resource route where `login` sends a `POST` request with credentials |
| `paths.checkAuth` | `string` | not called; the stored token is enough | API resource route where `checkAuth` sends a `GET` request to validate the token against the backend. When omitted, `checkAuth` verifies token existence in `localStorage` without making a network call |
| `paths.afterLogin` | `string` | `'/'` | Target redirect path returned in `redirectTo` when `login` succeeds |

> [!NOTE]
> The post-login redirect is `paths.afterLogin` inside `IAuthProviderOptions` (`CoreBindings.AUTH_PROVIDER_OPTIONS`), not a top-level option.

```ts
import { type IAuthProviderOptions } from '@venizia/ardor';

export const authProviderOptions: IAuthProviderOptions = {
  paths: {
    signIn: '/auth/sign-in',
    checkAuth: '/auth/whoami',
    afterLogin: '/dashboard',
  },
};
```

## Example

The following complete example demonstrates a custom auth provider subclass that accepts email credentials, enforces an admin role check before saving the session, and redirects to a custom sign-in route. It binds the subclass under `CoreBindings.DEFAULT_AUTH_PROVIDER` in a configuration class:

```ts
import {
  type AnyType,
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultRestDataProvider,
  type IAuthProviderOptions,
  type IRestDataProviderOptions,
  type ISignInSession,
  inject,
  provide,
} from '@venizia/ardor';

export class CustomAuthProvider extends DefaultAuthProvider {
  protected override get loginPagePath(): string {
    return '/signin';
  }

  protected override buildSignInBody(opts: { params: AnyType }): unknown {
    return {
      email: opts.params?.email,
      password: opts.params?.password,
    };
  }

  protected override resolveUsername(opts: { params: AnyType }): string {
    return opts.params?.email ?? '';
  }

  protected override async beforeSaveSession(opts: {
    session: ISignInSession;
    params: AnyType;
  }): Promise<void> {
    if (!opts.session.roles.includes('admin')) {
      throw new Error('[signIn] Only administrators may sign in');
    }
  }
}

@configuration()
export class CustomAuthConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return {
      url: 'https://api.example.com',
      noAuthPaths: ['/auth/sign-in'],
    };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): IAuthProviderOptions {
    return {
      paths: {
        signIn: '/auth/sign-in',
        afterLogin: '/dashboard',
      },
    };
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_SERVICE })
  authService(): DefaultAuthService {
    return this.application.instantiate(DefaultAuthService);
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }

  @provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })
  authProvider() {
    return this.application.instantiate(CustomAuthProvider).value(this.application);
  }
}
```

## The sign-in contract

The default sign-in flow adheres to the IGNIS authentication protocol:

- **Route:** `POST` to `paths.signIn` (default `/auth/sign-in`) sent through `restDataProvider.send()`. The route must also be listed in `noAuthPaths` on `IRestDataProviderOptions` so the request travels without an `Authorization` header.
- **Request Body:** Created by `buildSignInBody({ params })` from login form parameters (`params.username` and `params.password`):

```json
{
  "identifier": {
    "scheme": "username",
    "value": "alice"
  },
  "credential": {
    "scheme": "basic",
    "value": "secret123"
  }
}
```

- **Response:** Processed by `readSignInSession({ data })`. Accepts two formats:
  1. `{ userId: string | number, roles?: Array<string | { identifier?: string; name?: string }>, token: { value: string, type: string } }` (the recommended format).
  2. `{ token: string }` or `{ token: { value: string, type?: string } }`, where `type` defaults to `'Bearer'`. In this format, `userId` is extracted from token claims (`userId` or `sub`), and `roles` is extracted from the `roles` token claim.

If the response lacks a valid token or user identifier, `login` throws an error and no credentials are saved.

- **Storage:** `DefaultAuthService.saveAuth()` persists authentication information in `localStorage`:

| Key | Constant | Stored Content |
| --- | --- | --- |
| `@app/auth/token` | `LocalStorageKeys.KEY_AUTH_TOKEN` | `JSON.stringify({ value, type, provider })` |
| `@app/auth/identity` | `LocalStorageKeys.KEY_AUTH_IDENTITY` | `JSON.stringify({ userId, username, referenceId, provider })` |
| `@app/auth/permission` | `LocalStorageKeys.KEY_AUTH_PERMISSION` | `JSON.stringify(roles)` (array of role name strings) |

`username` defaults to `params.username ?? ''`, while `provider` and `referenceId` default to empty strings. When `roles` is omitted in `saveAuth()`, as occurs during token refreshes, the existing stored permissions remain untouched.

```ts
import { DefaultAuthService, LocalStorageKeys } from '@venizia/ardor';

const authService = new DefaultAuthService();

authService.saveAuth({
  userId: 'user-42',
  username: 'alice',
  token: { value: 'eyJhbGciOi...', type: 'Bearer' },
  roles: ['admin', 'editor'],
});

const token = authService.getAuth();
const identity = authService.getUser();
const roles = authService.getRoles();

const rawToken = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
```

## Auth provider methods

`DefaultAuthProvider.value()` binds each method to the provider instance before handing it to react-admin:

| Method | What it calls | What it returns |
| --- | --- | --- |
| `login(params)` | Posts credentials to `signInPath` via `restDataProvider.send()`, parses session with `readSignInSession()`, runs `beforeSaveSession()`, and persists via `saveSession()` | `Promise<{ ...response, redirectTo: string }>` redirecting to `afterLoginPath` (default `'/'`) |
| `logout(params)` | Invokes `authService.cleanUp()`, clearing all `localStorage` keys starting with `@app/auth/` or `@app/oauth2/` | `Promise<void>` |
| `checkAuth(params)` | Reads `authService.getAuth()`. Rejects if no token value is stored. When `paths.checkAuth` is set, sends a `GET` request to that path and rejects if response data is missing | `Promise<void>` (resolves on success, rejects with `{ redirectTo: loginPagePath }` on failure) |
| `checkError(params)` | Reads HTTP status from `params.status` (react-admin `HttpError`) or `params.statusCode` (`ApplicationError`). On 401, calls `authService.cleanUp()` and rejects with `{ redirectTo: loginPagePath }`. On 403, rejects with `{ redirectTo: unauthorizedPagePath, logoutUser: false }` | `Promise<void>` (resolves for any status other than 401 or 403) |
| `getIdentity(params)` | Reads stored identity from `authService.getUser()`. Rejects if `userId` is absent | `Promise<UserIdentity>` returning `{ userId, username, referenceId, provider }` |
| `getPermissions(params)` | Default implementation performs no operation | `Promise<void>` resolving to `undefined` |
| `getRoles(params)` | Reads stored roles from `authService.getRoles()` | `Promise<Set<string>>` containing stored role names |
| `refreshToken()` | Calls `restDataProvider.getNetworkService().refresh()`. Also invoked by the `useRefreshToken` hook | `Promise<AnyType>` (`true` if refreshed, `false` when no refresh is configured) |
| `canAccess(params)` | Calls `permissionProvider.canAccess({ resource, action, record })` when `CoreBindings.PERMISSION_PROVIDER` is bound in the container | `Promise<boolean>`. When unbound, `canAccess` is omitted from the provider so react-admin permits access by default |

## Overridable hooks

`DefaultAuthProvider` in `packages/admin/src/providers/auth.ts` encapsulates behaviour in protected getters and methods. Subclasses can override any step of authentication while keeping the rest (see the complete subclass example under [Example](#example)):

| Hook / Property | Signature | Default Implementation | Purpose |
| --- | --- | --- | --- |
| `signInPath` | `protected get: string` | `paths.signIn ?? '/auth/sign-in'` | Target API route for sign-in requests |
| `afterLoginPath` | `protected get: string` | `paths.afterLogin ?? '/'` | Redirect destination following successful sign-in |
| `loginPagePath` | `protected get: string` | `'/login'` | Route of login page redirected to on 401 or authentication failure |
| `unauthorizedPagePath` | `protected get: string` | `'/unauthorized'` | Route redirected to on 403 authorization failure |
| `buildSignInBody(opts)` | `opts: { params: AnyType } => unknown` | `{ identifier: { scheme: 'username', value: opts.params?.username }, credential: { scheme: 'basic', value: opts.params?.password } }` | Builds request payload sent to `signInPath` |
| `readSignInSession(opts)` | `opts: { data: unknown } => ISignInSession` | Extracts `{ userId, token, roles }` or reads claims from a JWT string | Parses server response into structured session data |
| `decodeJwtClaims(opts)` | `opts: { jwt: string } => Record<string, unknown> \| undefined` | Decodes base64 payload segment of JWT | Extracts JWT token claims without validating cryptographic signature |
| `readRoleNames(opts)` | `opts: { roles: unknown } => Array<string>` | Extracts strings or `identifier` / `name` properties | Normalizes varied role response formats into string array |
| `resolveUsername(opts)` | `opts: { params: AnyType } => string` | `opts.params?.username ?? ''` | Determines username string saved in user identity |
| `beforeSaveSession(opts)` | `opts: { session: ISignInSession; params: AnyType } => Promise<void>` | `Promise.resolve()` | Validation hook before persistence; throwing rejects login and saves nothing |
| `saveSession(opts)` | `opts: { session: ISignInSession; username: string } => void` | `authService.saveAuth(...)` | Saves token, identity, and permissions to `localStorage` |

## An application with no sign-in

`ArdorApplication` in `packages/admin/src/components/application.tsx` injects `CoreBindings.DEFAULT_AUTH_PROVIDER` with `isOptional: true`.

An application with no sign-in leaves `DEFAULT_AUTH_PROVIDER` unbound; `ArdorApplication` then runs without an auth provider. In this configuration, react-admin mounts no login page, runs no `checkAuth` guards, and treats all routes as public. `CoreBindings.AUTH_PROVIDER_OPTIONS` and `CoreBindings.DEFAULT_AUTH_SERVICE` can also be left unbound.

To ensure the REST data provider does not attach `Authorization` headers to outgoing requests, configure `noAuthPathRegex: /./` in `IRestDataProviderOptions`:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  type IRestDataProviderOptions,
  inject,
  provide,
} from '@venizia/ardor';

@configuration()
export class PublicConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE })
    private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return {
      url: 'https://api.example.com',
      noAuthPathRegex: /./,
    };
  }

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(DefaultRestDataProvider).value(this.application);
  }
}
```

## Related

- [Add sign-in tutorial](../guides/tutorials/add-sign-in) - Step-by-step tutorial on adding authentication to an ARDOR admin
- [Auth recovery best practices](../best-practices/auth-recovery) - Handling token refresh and 401 error recovery
- [Application reference](./application) - Application lifecycle, container methods, and startup sequence
- [Binding keys reference](./binding-keys) - Catalog of CoreBindings and LocalStorageKeys
- [Data provider reference](./data-provider) - REST data provider options, send method, and data fetching
- [Network reference](./network) - Network service options, error handling, and request headers
- [Permission reference](./permission) - Role-based access control and permission providers
- [5-minute quickstart](../guides/get-started/5-minute-quickstart) - Scaffold a complete ARDOR application
