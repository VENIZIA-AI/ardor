---
title: Auth provider
description: DefaultAuthProvider and DefaultAuthService - sign-in contract, storage keys, options, hooks, session hooks, method table, and configuring an app with no sign-in.
---

# Auth provider

`DefaultAuthProvider` bridges react-admin authentication with the backend API through the REST data provider, storing authentication tokens, identity records, and role sets in `localStorage` via `DefaultAuthService`. Bind `AUTH_PROVIDER_OPTIONS`, `DEFAULT_AUTH_SERVICE`, and `DEFAULT_AUTH_PROVIDER` in an application [configuration](../guides/core-concepts/configuration) class:

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

## Exports

| Export | Kind | Purpose |
| --- | --- | --- |
| `DefaultAuthProvider` | class | react-admin auth provider implementing `IAuthProvider` in `packages/admin/src/providers/auth.ts` |
| `DefaultAuthService` | class | Service managing auth tokens, identity, and permissions in `localStorage` in `packages/kernel/src/base/services/auth.ts` |
| `IAuthProviderOptions` | interface | Configuration options for authentication routes under `paths` |
| `IAuthProvider` | interface | Extended react-admin auth provider including `getRoles` and `refreshToken` |
| `IReactAdminAuthProvider` | type | Standard react-admin auth provider contract |
| `ILoginParams` | interface | What the login form hands to `login`: `username`, `password` and any other form field |
| `ISignInSession` | interface | Parsed sign-in session carrying `userId`, `token`, and `roles` |
| `SessionClearReasons`, `TSessionClearReason` | class, type | The reasons `onSessionCleared` receives: `logout`, `unauthorized`, `rejected`, `external` |
| `IAuthRejection` | interface | What `checkAuth` and `checkError` reject with: `redirectTo`, `logoutUser`, `message` |
| `LocalStorageKeys` | class | `localStorage` key constants: `KEY_AUTH_TOKEN`, `KEY_AUTH_IDENTITY`, `KEY_AUTH_PERMISSION` |
| `CoreBindings` | class | Container keys: `DEFAULT_AUTH_PROVIDER`, `AUTH_PROVIDER_OPTIONS`, `DEFAULT_AUTH_SERVICE` |

## Options

`IAuthProviderOptions` in `packages/kernel/src/common/types.ts` defines route paths for authentication operations.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `paths` | `object` | `undefined` | Endpoint routing settings (the whole object is optional) |
| `paths.signIn` | `string` | `'/auth/sign-in'` | API resource route where `login` sends a `POST` request with credentials |
| `paths.checkAuth` | `string` | not called; the stored token is enough | API resource route where `checkAuth` sends a `GET` request to validate the token against the backend. When omitted, `checkAuth` verifies token existence in `localStorage` without making a network call |
| `paths.afterLogin` | `string \| false` | `'/'` | Target redirect path returned in `redirectTo` when `login` succeeds; `false` returns `redirectTo: false` and the page stays (a guest or kiosk shell) |

> [!NOTE]
> The post-login redirect is `paths.afterLogin` inside `IAuthProviderOptions` (`CoreBindings.AUTH_PROVIDER_OPTIONS`), not a top-level option.

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

With an application `id` in `IApplicationInfo`, the three keys are `@app/auth/<id>/token`, `@app/auth/<id>/identity` and `@app/auth/<id>/permission`; see [Two applications on one origin](./binding-keys#two-applications-on-one-origin).

`username` defaults to `params.username ?? ''`, while `provider` and `referenceId` default to empty strings. When `roles` is omitted in `saveAuth()`, as occurs during token refreshes, the existing stored permissions remain untouched.

> [!WARNING]
> The roles in `@app/auth/permission` are data in the browser: anyone who controls the browser can change them. `getRoles` and `canAccess` are for showing and hiding interface. The backend must check every permission on every request, with the token it receives.

## Auth provider methods

`DefaultAuthProvider.value()` binds each method to the provider instance before handing it to react-admin:

| Method | What it calls | What it returns |
| --- | --- | --- |
| `login(params)` | Posts credentials to `signInPath` via `restDataProvider.send()`, parses session with `readSignInSession()`, runs `beforeSaveSession()`, and persists via `saveSession()` | `Promise<{ ...response, redirectTo: string }>` redirecting to `afterLoginPath` (default `'/'`) |
| `logout(params)` | Invokes `authService.cleanUp()`, clearing all `localStorage` keys starting with `@app/auth/` | `Promise<void>` |
| `checkAuth(params)` | Reads `authService.getAuth()`. Rejects if no token value is stored. When `paths.checkAuth` is set, sends a `GET` request to that path and rejects if response data is missing | `Promise<void>` (resolves on success, rejects with `{ redirectTo: loginPagePath }` on failure) |
| `checkError(params)` | Reads HTTP status from `params.status` (react-admin `HttpError`) or `params.statusCode` (`ApplicationError`). On 401, calls `authService.cleanUp()` and rejects with `{ redirectTo: loginPagePath }`. On 403, rejects with `{ redirectTo: unauthorizedPagePath, logoutUser: false }` | `Promise<void>` (resolves for any status other than 401 or 403) |
| `getIdentity(params)` | Reads stored identity from `authService.getUser()`. Rejects if `userId` is absent | `Promise<UserIdentity>` returning `{ userId, username, referenceId, provider }` |
| `getPermissions(params)` | Default implementation performs no operation | `Promise<void>` resolving to `undefined` |
| `getRoles(params)` | Reads stored roles from `authService.getRoles()`; they only show or hide interface | `Promise<Set<string>>` containing stored role names |
| `refreshToken()` | Calls `restDataProvider.getNetworkService().refresh()`. Also invoked by the `useRefreshToken` hook | `Promise<boolean>` (`true` if refreshed, `false` when no refresh is configured) |
| `canAccess(params)` | Calls `permissionProvider.canAccess({ resource, action, record })` when `CoreBindings.PERMISSION_PROVIDER` is bound in the container | `Promise<boolean>`. When unbound, `canAccess` is omitted from the provider so react-admin permits access by default |

## Overridable hooks

`DefaultAuthProvider` in `packages/admin/src/providers/auth.ts` encapsulates behaviour in protected getters and methods:

| Hook / Property | Signature | Default Implementation | Purpose |
| --- | --- | --- | --- |
| `signInPath` | `protected get: string` | `paths.signIn ?? '/auth/sign-in'` | Target API route for sign-in requests |
| `afterLoginPath` | `protected get: string` | `paths.afterLogin ?? '/'` | Redirect destination following successful sign-in |
| `loginPagePath` | `protected get: string` | `'/login'` | Route of login page redirected to on 401 or authentication failure |
| `unauthorizedPagePath` | `protected get: string` | `'/unauthorized'` | Route redirected to on 403 authorization failure |
| `buildSignInBody(opts)` | `opts: { params: ILoginParams } => unknown` | `{ identifier: { scheme: 'username', value: opts.params?.username }, credential: { scheme: 'basic', value: opts.params?.password } }` | Builds request payload sent to `signInPath` |
| `readSignInSession(opts)` | `opts: { data: unknown } => ISignInSession` | Extracts `{ userId, token, roles }` or reads claims from a JWT string | Parses server response into structured session data |
| `decodeJwtClaims(opts)` | `opts: { jwt: string } => Record<string, unknown> \| undefined` | Decodes base64 payload segment of JWT | Extracts JWT token claims without validating cryptographic signature |
| `readRoleNames(opts)` | `opts: { roles: unknown } => Array<string>` | Extracts strings or `identifier` / `name` properties | Normalizes varied role response formats into string array |
| `resolveUsername(opts)` | `opts: { params: ILoginParams } => string` | `opts.params?.username ?? ''` | Determines username string saved in user identity |
| `beforeSaveSession(opts)` | `opts: { session: ISignInSession; params: ILoginParams } => Promise<void>` | `Promise.resolve()` | Validation hook before persistence; throwing rejects login and saves nothing |
| `saveSession(opts)` | `opts: { session: ISignInSession; username: string } => void` | `authService.saveAuth(...)` | Saves token, identity, and permissions to `localStorage` |
| `sessionHookTimeout` | `protected get: number` | `10000` | Milliseconds a session hook may run before the provider logs it and carries on. See [Session hooks](#session-hooks) |
| `unauthenticatedRejection(opts)` | `opts: { reason: TSessionClearReason } => IAuthRejection` | `{ redirectTo: this.loginPagePath }` | What `checkAuth` (`rejected`) and the 401 branch of `checkError` (`unauthorized`) reject with. See [Guest apps](#guest-apps) |
| `onSessionStarted(opts)` | `opts: { token: IAuthTokenRecord; user: AnyType } => void \| Promise<void>` | no-op | Runs when a session starts or its token is replaced. See [Session hooks](#session-hooks) |
| `onSessionCleared(opts)` | `opts: { reason: TSessionClearReason } => void \| Promise<void>` | no-op | Runs when the announced session ends. See [Session hooks](#session-hooks) |

Subclasses can override any hook to customize authentication:

```ts
import {
  type AnyType,
  DefaultAuthProvider,
  type ISignInSession,
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
```

## Session hooks

To keep a socket or a per-user cache in step with the session, override `onSessionStarted` and `onSessionCleared`. You no longer override `checkAuth` for it.

```ts
import {
  type AnyType,
  DefaultAuthProvider,
  type IAuthTokenRecord,
  type TSessionClearReason,
} from '@venizia/ardor';

declare const socket: {
  connect: (opts: { token: string }) => Promise<void>;
  disconnect: (opts: { reason: string }) => void;
};

export class SocketAuthProvider extends DefaultAuthProvider {
  protected override async onSessionStarted(opts: {
    token: IAuthTokenRecord;
    user: AnyType;
  }): Promise<void> {
    await socket.connect({ token: opts.token.value });
  }

  protected override onSessionCleared(opts: { reason: TSessionClearReason }): void {
    socket.disconnect({ reason: opts.reason });
  }
}
```

Each hook fires once per change of the session. A re-check of the same session stays silent.

| Hook | Fires after | Does not fire |
| --- | --- | --- |
| `onSessionStarted` | `login` saved the session; a `checkAuth` confirmed it (the first one of a page that finds a stored session too); a token was saved by anything that calls `DefaultAuthService.saveAuth`, such as your network service's `refreshToken()` on a 401 | A `checkAuth` or a `refreshToken()` that leaves the same user and token. |
| `onSessionCleared` | `logout`; the 401 branch of `checkError`; a `checkAuth` that rejects; a `cleanUp` made by other code, with the reason `external` | A session that was never announced. A second clear of the same session |

- **The arguments.** `token` is the stored token record (`value`, `type`). `user` is the stored identity (`userId`, `username`, `referenceId`, `provider`), or `{ userId, username }` when your `saveSession` keeps nothing in the store. `reason` is `SessionClearReasons.LOGOUT`, `UNAUTHORIZED`, `REJECTED` or `EXTERNAL`.
- **Order.** `logout` and the 401 branch clear the store first, then call the hook. A rejected `checkAuth` calls the hook but does not clear the store.
- **Async.** The provider awaits a hook before `login`, `logout`, `checkAuth`, `checkError` or `refreshToken()` resolves or rejects. Hook calls run one after the other, so a slow `onSessionStarted` ends before a later `onSessionCleared` begins. A `checkAuth` that finds the session already announced waits for the hook of the call that announced it.
- **Failures.** A hook that throws or rejects is logged and the call carries on. Sign-in and sign-out do not fail because a socket is down.
- **A hook that never settles.** After `sessionHookTimeout` (10 seconds; override the getter) the provider logs it and carries on. The hook itself keeps running, and the next hook may start while it does. Put a timeout on your own `connect` too.
- **Do not call the provider from a hook.** `this.logout()` or `this.refreshToken()` inside a hook queues behind that hook, so it waits until `sessionHookTimeout` ends the hook. Return from the hook and call it afterwards.
- **What the provider sees.** The provider subscribes to `DefaultAuthService` (`subscribe({ listener })` runs after every `saveAuth` and `cleanUp`), so a refresh your network service makes on a 401 and a `cleanUp` from its `onAuthFailure` reach the hooks as well. A token written straight to `localStorage`, or by another tab, does not: save it with `saveAuth`.
- **One provider per auth service.** Each provider listens to the service in its constructor, so a second provider on the same `DefaultAuthService` calls every hook again. A provider you build and discard yourself (a test, a hot reload) stops listening with `dispose()`.
- **A refresh is a start.** A new token for the same user calls `onSessionStarted` again with the new `token`; there is no separate hook. A token saved again with the same value stays silent.

## Guest apps

A guest app has no login page, and a 401 should not log the user out. Override `unauthenticatedRejection`, which `checkAuth` and the 401 branch of `checkError` reject with:

```ts
import {
  DefaultAuthProvider,
  type IAuthRejection,
  SessionClearReasons,
  type TSessionClearReason,
} from '@venizia/ardor';

export class GuestAuthProvider extends DefaultAuthProvider {
  protected override unauthenticatedRejection(opts: { reason: TSessionClearReason }): IAuthRejection {
    return opts.reason === SessionClearReasons.UNAUTHORIZED
      ? { logoutUser: false, message: false }
      : { redirectTo: false, message: false };
  }
}
```

The values follow ra-core (5.15.5):

| Rejects | Value | What ra-core does |
| --- | --- | --- |
| `checkAuth` | `redirectTo: false` | No redirect after it logs out. |
| `checkAuth` | `message: false` | No notification. |
| `checkError` (401) | `logoutUser: false` | It does not call `logout`. It redirects only if `redirectTo` is set. |
| `checkError` (401) | `message: false` | No "not authorized" notification. |

`{ message: false }` alone still redirects: ra-core logs out and goes to `/login` unless `redirectTo` is `false`. For `checkAuth` return `{ redirectTo: false, message: false }`.

A 401 whose rejection has `logoutUser: false` keeps the stored session: the provider does not run `cleanUp` and does not call `onSessionCleared`. The revoked token then stays stored and keeps going out with every request, so the app must clear or replace it itself (for example in the network service's `onAuthFailure`, or by saving a new token with `saveAuth`). Otherwise every request keeps answering 401. Any other rejection clears the session as before. `checkAuth` always calls `logout` through ra-core when it rejects, so `onSessionCleared` with `logout` follows a rejected check that logs out.

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

- [Add sign-in](../guides/tutorials/add-sign-in) - Step-by-step tutorial on adding authentication to an ARDOR admin
- [Auth recovery](../best-practices/auth-recovery) - Handling token refresh and 401 error recovery
- [Permission provider](./permission) - Role-based access control and permission providers
- [REST data provider](./data-provider) - REST data provider options, send method, and data fetching
