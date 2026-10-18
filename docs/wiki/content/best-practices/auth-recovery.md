---
title: No-auth paths and token recovery
description: When to declare an endpoint as no-auth, how the one-refresh-one-retry recovery contract works, how to write the refreshToken hook of a network service subclass, and where tokens live.
---

# No-auth paths and token recovery

`noAuthPaths` and `noAuthPathRegex` describe which endpoints legitimately run without a token. They are a design decision, made once, at the request service. They are not a patch for a `401`. A `401` on an authenticated path is handled by the recovery contract: one refresh per burst, one retry, then `onAuthFailure`.

## Prerequisites

You have a `DefaultNetworkRequestService` (usually reached through `getNetworkService()` on the data provider) and a `DefaultAuthProvider` in your application - see [Network](../references/network) and [Auth provider](../references/auth-provider).

## Quick Reference

| Export | Kind | Role on this page |
| --- | --- | --- |
| `DefaultNetworkRequestService` | class | Decides whether a request carries a token, and runs recovery on `401`. Its protected hooks `refreshToken`, `onAuthFailure`, `resolveAuthToken` and `isNoAuthPath` are what you override |
| `DefaultRestDataProvider` | class | `createNetworkService()` returns the service; override it to return your subclass |
| `INoAuthOptions` | interface | `noAuthPaths`, `noAuthPathRegex` |
| `TNoAuthPathRegex` | type | A string, a `RegExp`, or an array of either |
| `IAuthRecoveryOptions` | interface | `refreshTokenPath` - data only |
| `DefaultAuthProvider` | class | Owns `login`, `logout`, `checkError`, `refreshToken` |
| `DefaultAuthService` | class | `saveAuth`, `getAuth`, `getUser`, `cleanUp` |
| `IAuthProviderOptions` | interface | `paths.signIn`, `paths.checkAuth`, `paths.afterLogin` |
| `LocalStorageKeys` | class | `KEY_AUTH_TOKEN` - the storage key the request service reads |

## Why a missing token is an error, not a silent skip

`DefaultNetworkRequestService.getRequestHeader({ resource })` builds headers for every request. If the path is not a no-auth path, it calls `getRequestAuthorizationHeader()`. That method reads the token through the `resolveAuthToken()` hook and **throws a `401` before the request is sent** when there is no token value:

```ts no-check
getRequestAuthorizationHeader() {
  const authToken = this.resolveAuthToken();

  if (!authToken?.value) {
    throw getError({ message: '[dataProvider][getAuthHeader] Invalid auth token to fetch!', statusCode: 401 });
  }
  ...
}
```

This is why the sign-in path must be declared as no-auth. Before login there is no token, so a sign-in request on an authenticated path never reaches the server. The same reasoning applies to the refresh path: the point of a refresh is that the current token is no longer good.

## Declaring no-auth paths

The two lists are data. They come from `INoAuthOptions`, sit in `IRestDataProviderOptions`, and are fixed when the service is built. There are no setters.

```ts no-check
declare class DefaultNetworkRequestService {
  constructor(opts: INoAuthOptions & {
    name: string;
    baseUrl?: string;
    headers?: HeadersInit;
    authRecovery?: IAuthRecoveryOptions;
  });

  protected isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean;
}
```

How `isNoAuthPath` decides, in order:

1. `noAuthPaths` - an exact string match against `resource`.
2. `noAuthPathRegex` - each pattern is tested against `resource` and against `paths.join('/')`. String patterns are compiled with `new RegExp`; an invalid pattern is logged and skipped. `lastIndex` is reset before each test, so global patterns are safe.

To send no token at all - a service that talks to an API with no sign-in - set `noAuthPathRegex: /./`. Every path then matches, the service never attaches a token, and recovery is off with it (`canRecover` checks `isNoAuthPath`).

Keep the list small and explicit. The sign-in path and the refresh path belong there. Public, unauthenticated reads belong there. Nothing else does.

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

const requests = new DefaultNetworkRequestService({
  name: 'api',
  baseUrl: 'https://api.example.com',
  noAuthPaths: ['/auth/sign-in', '/auth/refresh'],
  noAuthPathRegex: [/^\/public\//],
});
```

With that service, `/auth/sign-in` is no-auth by exact match, `/public/pricing` by regex, and `/orders` needs a token.

`isNoAuthPath` is a protected hook. A rule the two lists cannot say is an override in the service subclass (see [Wiring the refresh](#wiring-the-refresh)):

```ts
import { DefaultNetworkRequestService } from '@venizia/ardor';

class AppNetworkService extends DefaultNetworkRequestService {
  protected override isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean {
    return opts.resource?.startsWith('/open/') === true || super.isNoAuthPath(opts);
  }
}
```

Note that `getRequestHeader` only passes `{ resource }` to `isNoAuthPath`. A regex that relies on the joined `paths` is only consulted where `paths` are supplied, such as in `canRecover`.

## The recovery contract

Recovery has one piece of data and two hooks. The data is `IAuthRecoveryOptions`, set at construction. The hooks are protected methods of `DefaultNetworkRequestService`, which you override in a subclass.

```ts no-check
interface IAuthRecoveryOptions {
  refreshTokenPath?: string; // a request to this path never starts a refresh
}

declare class DefaultNetworkRequestService {
  /** true once refreshed; false when there is nothing to refresh (the default); throw when it failed. */
  protected refreshToken(): Promise<boolean>;

  /** Runs once when refreshToken threw. */
  protected onAuthFailure(): Promise<void>;

  /** The one public entry: one shared call per 401 burst. */
  refresh(): Promise<boolean>;
}
```

What the service guarantees:

- **Recovery only runs when it can help.** `canRecover(paths)` returns `false` when the path is a no-auth path, or when the joined path contains `refreshTokenPath`. A `401` from either surfaces immediately. A service that does not override `refreshToken` refreshes nothing: the hook resolves `false`, nothing is retried, and the `401` stands.
- **One refresh per burst.** `refresh()` stores the in-flight promise. Every `401` that arrives while a refresh is running awaits the same promise. The slot is cleared in `finally`, so the next burst starts a new refresh.
- **One retry.** When `refresh()` resolves `true`, the original request is sent again once, with the new token. The service does not loop.
- **Failure is contained.** If `refreshToken` rejects - or throws synchronously, which is why the chain starts with `Promise.resolve().then(...)` - `onAuthFailure` runs once, `refresh()` resolves `false`, and the original `401` is what the caller sees. If `onAuthFailure` itself throws, that is logged and swallowed; it never masks the `401`.

```ts no-check
class DefaultNetworkRequestService {
  ...

  refresh(): Promise<boolean> {
    this.refreshing ??= Promise.resolve()
      .then(() => this.refreshToken())
      .catch(async () => {
        try {
          await this.onAuthFailure();
        } catch {
          this.logger.error('[refresh] onAuthFailure failed');
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

## Wiring the refresh

The refresh is written once, as the `refreshToken` hook of a `DefaultNetworkRequestService` subclass. The subclass reaches the application in two steps.

First, write the subclass. `refreshToken` sends the refresh request, stores the new token under `LocalStorageKeys.KEY_AUTH_TOKEN`, and resolves `true`. `onAuthFailure` is the place to send the user back to sign-in:

```ts
import {
  DefaultNetworkRequestService,
  LocalStorageKeys,
  RequestMethods,
  RequestTypes,
} from '@venizia/ardor';

export class AppNetworkService extends DefaultNetworkRequestService {
  protected override async refreshToken(): Promise<boolean> {
    const { data } = await this.doRequest<{ token: string }>({
      type: RequestTypes.SEND,
      method: RequestMethods.POST,
      paths: ['/auth/token/refresh'],
      headers: this.getRequestHeader({ resource: '/auth/token/refresh' }),
    });

    localStorage.setItem(
      LocalStorageKeys.KEY_AUTH_TOKEN,
      JSON.stringify({ value: data.token, type: 'Bearer' }),
    );
    return true;
  }

  protected override async onAuthFailure(): Promise<void> {
    // send the user back to sign-in
  }
}
```

Second, return it from `DefaultRestDataProvider.createNetworkService()`, which is called once, on first use. The options keep only data, so the subclass takes them straight from `restDataProviderOptions`. The refresh path is in `noAuthPaths`; `refreshTokenPath` adds the second guard:

```ts
import { DefaultNetworkRequestService, DefaultRestDataProvider } from '@venizia/ardor';

// The subclass from the first step.
declare class AppNetworkService extends DefaultNetworkRequestService {}

export class AppRestDataProvider extends DefaultRestDataProvider {
  protected override createNetworkService() {
    return new AppNetworkService({
      name: 'app-network-service',
      baseUrl: this.restDataProviderOptions.url,
      noAuthPaths: this.restDataProviderOptions.noAuthPaths,
      noAuthPathRegex: this.restDataProviderOptions.noAuthPathRegex,
      headers: this.restDataProviderOptions.headers,
      authRecovery: this.restDataProviderOptions.authRecovery, // { refreshTokenPath: '/auth/token/refresh' }
    });
  }
}
```

Bind that provider subclass under `CoreBindings.DEFAULT_REST_DATA_PROVIDER`, in place of `DefaultRestDataProvider`:

```ts
import {
  type BaseArdorApplication as TArdorApplication,
  configuration,
  CoreBindings,
  DefaultRestDataProvider,
  inject,
  provide,
} from '@venizia/ardor';

// The provider subclass from the second step.
declare class AppRestDataProvider extends DefaultRestDataProvider {}

@configuration()
export class ProviderConfiguration {
  constructor(
    @inject({ key: CoreBindings.APPLICATION_INSTANCE }) private readonly application: TArdorApplication,
  ) {}

  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
  restDataProvider() {
    return this.application.instantiate(AppRestDataProvider).value(this.application);
  }
}
```

There is nothing to connect on the auth provider. `DefaultAuthProvider.refreshToken()` calls `restDataProvider.getNetworkService().refresh()` and resolves `true` or `false`. It is the same `refresh()` the `401` recovery calls, so `useRefreshToken`, a `401` burst and a call from code share one refresh.

You do not have to call `cleanUp` in `onAuthFailure` when the request came from react-admin. When the original `401` surfaces, react-admin calls `authProvider.checkError(error)` with the `ApplicationError` the data provider threw (`statusCode: 401`), and `DefaultAuthProvider.checkError` already calls `authService.cleanUp()` and redirects to `login`. Use `onAuthFailure` for work that must happen even outside react-admin's request path.

## Where tokens live

The request service stores nothing itself. It asks its `resolveAuthToken()` hook, which by default is `DefaultNetworkRequestService.readAuthTokenFromStorage()` - `localStorage` under `LocalStorageKeys.KEY_AUTH_TOKEN`, parsed as a JSON object with a `value` and an optional `type` (defaults to `Bearer`) and `provider`. It returns `undefined` where there is no `localStorage` or the stored value does not parse.

`resolveAuthToken()` is the one way to supply a token from somewhere else. Override it in the service subclass to read another store or to hold the token in memory:

```ts
import { DefaultNetworkRequestService, type IAuthTokenRecord } from '@venizia/ardor';

export class MemoryTokenNetworkService extends DefaultNetworkRequestService {
  protected token?: IAuthTokenRecord;

  protected override resolveAuthToken(): IAuthTokenRecord | undefined {
    return this.token;
  }
}
```

An HTTP repository should share both the token and the refresh. The data provider's `getDataSourceAuth()` hands an `HttpDataSource` four settings, read on every send: the session headers and the timezone, the request channel and tracing id, the token on every path but a no-auth one, and an `onUnauthorized` that joins the service's refresh, except on a no-auth path. So a screen reading through `@venizia/ardor/repository` sends what the data provider sends, and a `401` on either side triggers one `refreshToken` call between them:

```ts
import { CoreBindings, datasource, type IDataProvider } from '@venizia/ardor';
import { HttpDataSource } from '@venizia/ardor/repository';
import { inject } from '@venizia/ignis-inversion';

@datasource()
export class ApiDataSource extends HttpDataSource {
  constructor(
    @inject({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }) dataProvider: IDataProvider,
  ) {
    super({ baseUrl: '/api', ...dataProvider.getDataSourceAuth() });
  }
}
```

`getDataSourceAuth()` also sets `errorRootKey: 'error'`, so a repository error keeps the server's `normalized.code`, as the data provider's does. The refresh is shared by every call in flight, so one call's abort never cancels it: the aborted call is just not retried once the refresh settles.

The data provider must be a singleton. Declare it with `@provide` in a `@configuration()` class - `registerArtifacts()` binds it as a singleton. A bare `bind().toProvider()` in `bindContext()` is transient, so the datasource would receive its own data provider, with its own network service, token and refresh. Without a `refreshToken` override, a `401` from the repository stands, as it does for the data provider.

`DefaultAuthProvider` writes the token in exactly one place - `login`, via `authService.saveAuth` - and clears it in exactly one way - `authService.cleanUp`, called from `logout` and from `checkError` on a `401`. The only other writer is your `refreshToken` hook, which stores the refreshed token under the same key. Keep it that way: do not write the key from components, and do not clear it from anywhere but `cleanUp`.

## Common pitfalls

- **Adding a path to `noAuthPaths` because it returned `401`.** That hides an expired token instead of refreshing it. If the endpoint needs a user, leave it authenticated and let recovery run.
- **Forgetting the sign-in path.** `getRequestAuthorizationHeader` throws before the request is sent, so `login` rejects with `Invalid auth token to fetch!` and never reaches the server. `paths.signIn` defaults to `/auth/sign-in`; whatever you configure must also be in `noAuthPaths`.
- **Forgetting the refresh path.** Without it the service attaches the expired token to the refresh request. Without `refreshTokenPath` a `401` from the refresh request starts another refresh. Declare both.
- **Expecting recovery with no `refreshToken` override.** The default hook resolves `false`: nothing is refreshed, nothing is retried, and the `401` stands. Write the subclass, return it from `createNetworkService()`, and bind that provider, or recovery does nothing.
- **Returning `true` without refreshing.** `true` means "the token is new, retry now". The retry then fails with the same `401`. Resolve `false` when there is nothing to refresh, and throw when the refresh failed - a thrown `refreshToken` is what runs `onAuthFailure`.
- **Overriding `refreshToken` on the auth provider.** `DefaultAuthProvider.refreshToken()` only calls the service's `refresh()`. The refresh itself belongs to the service's hook, so a `401` and `useRefreshToken` make it in one place.
- **Using `noAuthPathRegex: /./` to "fix" a `401`.** It turns off the token for every request and turns off recovery with it (`canRecover` checks `isNoAuthPath`, which is always `true` then). It is only for a service that talks to an unauthenticated API.
- **Using an invalid string in `noAuthPathRegex`.** The service logs it and drops it. The path stays authenticated and you find out from the `401`, not from a build error. Prefer a `RegExp` literal.
- **Storing the token under your own key.** The default `resolveAuthToken()` only reads `LocalStorageKeys.KEY_AUTH_TOKEN`. A token elsewhere is invisible to it unless you override the hook.
- **Binding the plain `DefaultRestDataProvider`.** Overriding `createNetworkService()` on a subclass changes nothing until that subclass is what sits under `CoreBindings.DEFAULT_REST_DATA_PROVIDER`.

## Related

- [Network](../references/network) - `DefaultNetworkRequestService` and the request helpers
- [Data provider](../references/data-provider) - `createNetworkService()` and `IRestDataProviderOptions`
- [Auth provider](../references/auth-provider) - `DefaultAuthProvider` and `IAuthProviderOptions`
- [Binding keys](../references/binding-keys) - the `CoreBindings` used to resolve the service and the provider
- [Binding keys best practices](./binding-keys)
- [Services](./services)
- [Migration from ra-core-infra](../guides/migration/from-ra-core-infra)
