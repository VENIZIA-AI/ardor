---
title: No-auth paths and token recovery
description: When to declare an endpoint as no-auth, how the one-refresh-one-retry recovery contract works, how to wire refreshToken to the AuthProvider, and where tokens live.
---

# No-auth paths and token recovery

`useAuth`, `noAuthPaths` and `noAuthPathRegex` describe which endpoints legitimately run without a token. They are a design decision, made once, at the request service. They are not a patch for a `401`. A `401` on an authenticated path is handled by the recovery contract: one refresh per burst, one retry, then `onAuthFailure`.

## Prerequisites

You have a `DefaultNetworkRequestService` (usually resolved from the container) and a `DefaultAuthProvider` in your application - see [Network](../references/network) and [Auth provider](../references/auth-provider).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `DefaultNetworkRequestService` | class | Decides whether a request carries a token, and runs recovery on `401` |
| `INoAuthOptions` | interface | `useAuth`, `noAuthPaths`, `noAuthPathRegex` |
| `TNoAuthPathRegex` | type | A string, a `RegExp`, or an array of either |
| `IAuthRecoveryOptions` | interface | `refreshToken`, `refreshTokenPath`, `onAuthFailure` |
| `DefaultAuthProvider` | class | Owns `login`, `logout`, `checkError`, `refreshToken` |
| `DefaultAuthService` | class | `saveAuth`, `getAuth`, `getUser`, `cleanUp` |
| `IAuthProviderOptions` | interface | `paths.signIn`, `paths.checkAuth`, `endpoints.afterLogin` |
| `LocalStorageKeys` | class | `KEY_AUTH_TOKEN` - the storage key the request service reads |

## Why a missing token is an error, not a silent skip

`DefaultNetworkRequestService.getRequestHeader({ resource })` builds headers for every request. If the path is not a no-auth path, it calls `getRequestAuthorizationHeader()`. That method reads the token and **throws a `401` before the request is sent** when there is no token value:

```ts no-check
getRequestAuthorizationHeader() {
  const storedToken = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
  const authToken = this.authToken ?? JSON.parse(storedToken?.length ? storedToken : '{}');

  if (!authToken?.value) {
    throw getError({ message: '[dataProvider][getAuthHeader] Invalid auth token to fetch!', statusCode: 401 });
  }
  ...
}
```

This is why the sign-in path must be declared as no-auth. Before login there is no token, so a sign-in request on an authenticated path never reaches the server. The same reasoning applies to the refresh path: the point of a refresh is that the current token is no longer good.

## Declaring no-auth paths

The three options come from `INoAuthOptions` and are passed to the constructor. They can also be changed later with `setUseAuth`, `setNoAuthPaths` and `setNoAuthPathRegex`.

```ts no-check
declare class DefaultNetworkRequestService {
  constructor(opts: INoAuthOptions & {
    name: string;
    baseUrl?: string;
    headers?: HeadersInit;
    authRecovery?: IAuthRecoveryOptions;
  });

  isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean;
  setUseAuth(useAuth: boolean): void;
  setNoAuthPaths(noAuthPaths?: string[]): void;
  setNoAuthPathRegex(noAuthPathRegex?: TNoAuthPathRegex): void;
}
```

How `isNoAuthPath` decides, in order:

1. `useAuth === false` - every path is no-auth. The service never attaches a token.
2. `noAuthPaths` - an exact string match against `resource`.
3. `noAuthPathRegex` - each pattern is tested against `resource` and against `paths.join('/')`. String patterns are compiled with `new RegExp`; an invalid pattern is logged with `console.error` and skipped. `lastIndex` is reset before each test, so global patterns are safe.

Keep the list small and explicit. The sign-in path and the refresh path belong there. Public, unauthenticated reads belong there. Nothing else does.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const requests = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  noAuthPaths: ['/auth/login', '/auth/refresh'],
  noAuthPathRegex: [/^\/public\//],
});

requests.isNoAuthPath({ resource: '/auth/login' }); // true - exact match
requests.isNoAuthPath({ resource: '/public/pricing' }); // true - regex match
requests.isNoAuthPath({ resource: '/orders' }); // false - token required
```

Note that `getRequestHeader` only passes `{ resource }` to `isNoAuthPath`. A regex that relies on the joined `paths` is only consulted where `paths` are supplied, such as in `canRecover`.

## The recovery contract

Recovery is configured with `IAuthRecoveryOptions`, either in the constructor or through `setAuthRecovery`. `setAuthRecovery` merges with what is already set, so you can wire `refreshToken` after construction.

```ts no-check
interface IAuthRecoveryOptions {
  refreshToken?: () => unknown | Promise<unknown>;
  refreshTokenPath?: string;
  onAuthFailure?: () => unknown | Promise<unknown>;
}

declare class DefaultNetworkRequestService {
  setAuthRecovery(authRecovery: Partial<IAuthRecoveryOptions>): void;
  getAuthRecovery(): IAuthRecoveryOptions | undefined;
}
```

What the service guarantees:

- **Recovery only runs when it can help.** `canRecover(paths)` returns `false` when there is no `refreshToken`, when the path is a no-auth path, or when the joined path contains `refreshTokenPath`. A `401` from any of those surfaces immediately.
- **One refresh per burst.** `ensureRefreshed` stores the in-flight promise in `this.refreshing`. Every `401` that arrives while a refresh is running awaits the same promise. The slot is cleared in `finally`, so the next burst starts a new refresh.
- **One retry.** After a successful refresh the original request is sent again once. The service does not loop.
- **Failure is contained.** If `refreshToken` rejects - or throws synchronously, which is why the chain starts with `Promise.resolve().then(...)` - `onAuthFailure` is called, and the original `401` is what the caller sees. If `onAuthFailure` itself throws, that is logged and swallowed; it never masks the `401`.

```ts no-check
class DefaultNetworkRequestService {
  ...

  private ensureRefreshed(): Promise<boolean> {
    const rec = this.authRecovery;
    const refreshToken = rec?.refreshToken;
    if (!rec || !refreshToken) {
      return Promise.resolve(false);
    }

    this.refreshing ??= Promise.resolve()
      .then(() => refreshToken())
      .then(() => true)
      .catch(async () => {
        try {
          await rec.onAuthFailure?.();
        } catch {
          console.error('[DefaultNetworkRequestService][ensureRefreshed] onAuthFailure callback failed');
        }
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });

    return this.refreshing;
  }
}
```

`refreshTokenPath` and `noAuthPaths` are two separate guards. Putting the refresh path in `noAuthPaths` stops the expired token from being attached to the refresh request. Setting `refreshTokenPath` stops a `401` from the refresh request from starting another refresh. Set both.

## Wiring refreshToken to the AuthProvider

`DefaultAuthProvider.refreshToken()` is a no-op by default - it returns `Promise.resolve()`. The service does not know about the provider. You connect them in two steps.

First, override `refreshToken` on your provider. It sends the refresh request through the data provider and stores the new token with `authService.saveAuth`:

```ts no-check
import { DefaultAuthProvider, RequestMethods } from '@venizia/ardor';

export class AppAuthProvider extends DefaultAuthProvider {
  override async refreshToken() {
    const rs = await this.restDataProvider.send({
      resource: '/auth/refresh',
      params: { method: RequestMethods.POST, body: { ... } },
    });

    const { userId, token } = rs.data;
    this.authService.saveAuth({ token, userId, username: ... });
  }
}
```

Second, hand that method to the request service through `setAuthRecovery`. The refresh path is already in `noAuthPaths`; `refreshTokenPath` adds the second guard:

```ts
import type {
  DefaultAuthProvider,
  DefaultAuthService,
  DefaultNetworkRequestService,
} from '@venizia/ardor';

declare const requests: DefaultNetworkRequestService;
declare const authProvider: DefaultAuthProvider;
declare const authService: DefaultAuthService;

requests.setAuthRecovery({
  refreshToken: () => authProvider.refreshToken(),
  refreshTokenPath: '/auth/refresh',
  onAuthFailure: () => authService.cleanUp(),
});
```

You do not have to call `cleanUp` in `onAuthFailure` when the request came from react-admin. When the original `401` surfaces, react-admin calls `authProvider.checkError({ status: 401 })`, and `DefaultAuthProvider.checkError` already calls `authService.cleanUp()` and redirects to `login`. Use `onAuthFailure` for work that must happen even outside react-admin's request path.

## Where tokens live

The request service reads the token from one place: `localStorage` under `LocalStorageKeys.KEY_AUTH_TOKEN`. The stored value is a JSON object with a `value` and an optional `type` (defaults to `Bearer`) and `provider`. An in-memory override set with `setAuthToken({ type, value })` takes precedence when present.

```ts
import { LocalStorageKeys } from '@venizia/ardor';

const raw = localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN);
const stored = raw?.length ? JSON.parse(raw) : {};
```

`DefaultAuthProvider` writes the token in exactly one place - `login`, via `authService.saveAuth` - and clears it in exactly one way - `authService.cleanUp`, called from `logout` and from `checkError` on a `401`. Nothing else in the provider touches storage. Keep it that way: do not write the key from components, and do not clear it from anywhere but `cleanUp`.

## Common pitfalls

- **Adding a path to `noAuthPaths` because it returned `401`.** That hides an expired token instead of refreshing it. If the endpoint needs a user, leave it authenticated and let recovery run.
- **Forgetting the sign-in path.** `getRequestAuthorizationHeader` throws before the request is sent, so `login` rejects with `Invalid auth token to fetch!` and never reaches the server. `paths.signIn` defaults to `/auth/login`; whatever you configure must also be in `noAuthPaths`.
- **Forgetting the refresh path.** Without it the service attaches the expired token to the refresh request. Without `refreshTokenPath` a `401` from the refresh request starts another refresh. Declare both.
- **Expecting `DefaultAuthProvider.refreshToken` to do something.** It resolves with nothing. Override it and pass it to `setAuthRecovery`, or recovery is disabled - `canRecover` returns `false` when `refreshToken` is missing.
- **Calling `setUseAuth(false)` to "fix" a `401`.** It turns off the token for every request and turns off recovery with it (`canRecover` checks `isNoAuthPath`, which is always `true` then). It is only for a service that talks to an unauthenticated API.
- **Using an invalid string in `noAuthPathRegex`.** The service logs it and drops it. The path stays authenticated and you find out from the `401`, not from a build error. Prefer a `RegExp` literal.
- **Storing the token under your own key.** The service only reads `LocalStorageKeys.KEY_AUTH_TOKEN`. A token elsewhere is invisible to it.

## Related

- [Network](../references/network) - `DefaultNetworkRequestService` and the request helpers
- [Auth provider](../references/auth-provider) - `DefaultAuthProvider` and `IAuthProviderOptions`
- [Binding keys](../references/binding-keys) - the `CoreBindings` used to resolve the service and the provider
- [Binding keys best practices](./binding-keys)
- [Services](./services)
- [Migration from ra-core-infra](../guides/migration/from-ra-core-infra)
