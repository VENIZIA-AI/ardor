---
type: Concept
title: Auth recovery
description: How ARDOR's network layer recovers from a 401 by refreshing the auth token once and retrying the failed request, through the refreshToken and onAuthFailure hooks of the network service, and how DefaultAuthProvider/DefaultAuthService fit around it.
resource: packages/kernel/src/base/services/network-request.ts
tags: [architecture, auth, network, recovery, kernel]
---

Auth recovery is the retry-on-401 logic built into `DefaultNetworkRequestService` (packages/kernel/src/base/services/network-request.ts). It lets a request that fails with 401 attempt a single token refresh and one retry, instead of forcing every caller to hand-roll refresh logic.

The options hold data: `authRecovery.refreshTokenPath`. The behaviour is two protected hooks of the service, each overridden in a subclass: `refreshToken(): Promise<boolean>` (resolve `true` once the token is refreshed, `false` when there is nothing to refresh - the default - and throw when the refresh failed) and `onAuthFailure(): Promise<void>` (runs once when `refreshToken` threw; a no-op by default).

## The flow

1. A request comes back with status 401.
2. The service calls `canRecover(paths)`. This returns false (no recovery attempted) when:
   - the path is a [no-auth path](/architecture/no-auth-paths.md) (`isNoAuthPath`), or
   - the path matches `authRecovery.refreshTokenPath` - the refresh-token endpoint itself must never trigger a recovery loop on its own failure.
3. If recovery is allowed, the service calls its public `refresh()`.
4. `refresh()` guards a single in-flight refresh with `this.refreshing`. Multiple concurrent 401s share the same promise (`this.refreshing ??= ...`) so the app never fires more than one refresh call at a time, no matter how many requests failed together. The hook runs inside `Promise.resolve().then(() => this.refreshToken())` deliberately: a `refreshToken` that throws synchronously is treated as a failed refresh (going through `onAuthFailure`) rather than escaping as an unrelated exception out of `doRequest`.
5. When `refreshToken()` resolves `true`, `refresh()` resolves `true` and the service retries the original request exactly once, with the auth headers re-read (see below). When it resolves `false` (the default hook, a service with no refresh) the original 401 stands and `onAuthFailure` does not run.
6. When `refreshToken()` throws, `refresh()` calls `onAuthFailure()` (swallowing any error from that hook itself, logging instead) and resolves `false`. The service then surfaces the original 401 - no infinite retry, no second refresh attempt.
7. `this.refreshing` is cleared in a `.finally()` regardless of outcome, so the next 401 can start a fresh refresh cycle.

This whole scheme sits below the [data provider pipeline](/architecture/data-provider-pipeline.md): the pipeline just sees a request that either succeeds after a transparent refresh, or fails with the original 401 for [error flow](/architecture/error-flow.md) to handle.

## Sharing it with an HTTP repository

`getDataSourceAuth(opts?)` returns an `IDataSourceAuth` for an `HttpDataSource` (IGNIS connectors `>=0.2.1-4`), four settings whose hooks IGNIS calls on every send, the retry included, with the request's `{ paths }`:
- `headersResolver` is `getSessionHeaders()` (the timezone, then what `setHeaders({ headers })` holds now), plus `getTracingHeaders()` (channel and tracing id) when `opts` carries `restDataProviderOptions` and `applicationInfo`. The data provider's own `getDataSourceAuth()` passes both; `getNetworkService().getDataSourceAuth()` passes neither. `getRequestProps` builds its headers from the same two methods, so the two transports cannot drift.
- `authTokenResolver` is `resolveAuthToken()`, except `undefined` where `isNoAuthPath({ resource: paths[0], paths })` holds, which is every path when `noAuthPathRegex` is `/./`.
- `onUnauthorized` is `refresh()` gated by `canRecover(paths)`, the data provider's own gate: no refresh on a no-auth path or on the refresh path. A 401 from a repository otherwise joins the same `this.refreshing` promise as the data provider's. The context's `signal` is deliberately unused: the refresh is shared, and IGNIS does not retry a call aborted meanwhile.
- `errorRootKey` is `'error'`, the same `ERROR_ROOT_KEY` constant `doRequest` reads its error envelope under, so a repository error keeps the server's `normalized.code`.

Pinned by the `getDataSourceAuth` block in `network-request.test.ts` (session headers set after construction, channel and tracing id, no token on a no-auth path, none with `noAuthPathRegex: /./`, no refresh on a no-auth 401, the code under `error`) and one in admin `rest-data.test.ts`.

It only holds if every consumer resolves the same network service. Declare the data provider with `@provide` in a `@configuration()` class, so `registerArtifacts()` binds it as a singleton; a bare `bind().toProvider(DefaultRestDataProvider)` is transient. See [DI in the browser](/architecture/di-in-the-browser.md).

## Headers and auth token

`getRequestHeader` builds the header set per request. For non-no-auth paths it calls `getRequestAuthorizationHeader()`, which asks the protected hook `resolveAuthToken()` - by default `DefaultNetworkRequestService.readAuthTokenFromStorage()`, the stored token under `LocalStorageKeys.KEY_AUTH_TOKEN` - and throws a 401-tagged error if no token value is present. `resolveAuthToken()` is the one way to supply a token: override it to read another store or to hold the token in memory. The resulting `Authorization` and `X-Auth-Provider` headers follow the shared [header protocol](/architecture/header-protocol.md).

The retry does not re-run `getRequestHeader`: it reuses the original request's headers and overrides only `Authorization` and `X-Auth-Provider`, from a fresh `getRequestAuthorizationHeader()` call, so a `refreshToken` that stores the new token (for example in `localStorage`, or in the memory `resolveAuthToken` reads) is what the retry sends.

Recovery only covers a 401 returned by the server. When no token exists at all, `getRequestProps` throws a client-side 401 before `doRequest` runs, so no refresh is attempted and `onAuthFailure` is not called. The CRUD methods of `DefaultRestDataProvider` are not `async`, so from them that throw is synchronous.

## Configuring it

`authRecovery` comes from `IRestDataProviderOptions.authRecovery` (the `REST_DATA_PROVIDER_OPTIONS` binding), and `DefaultRestDataProvider.createNetworkService()` hands it to the service it builds, once, on first use. The hooks are not options: subclass `DefaultNetworkRequestService`, override `refreshToken` and `onAuthFailure`, subclass `DefaultRestDataProvider` so `createNetworkService()` returns it, and bind that provider under `CoreBindings.DEFAULT_REST_DATA_PROVIDER` (see [vert-admin](/examples/vert-admin.md)). The options are fixed once the service is built: there is no `setAuthRecovery`.

## DefaultAuthProvider and DefaultAuthService

`DefaultAuthProvider` (packages/admin/src/providers/auth.ts) is the react-admin `authProvider` built on top of this. It does not itself implement the refresh/retry loop - that lives in the network service - but it is the layer that keeps the stored session consistent with recovery outcomes:

- `login` sends credentials to the configured sign-in path, reads the session with `readSignInSession`, and `saveSession` persists it (`authService.saveAuth`) under the `LocalStorageKeys` keys that `resolveAuthToken` later reads.
- `checkError` is react-admin's hook for provider-surfaced errors: on status 401 it calls `authService.cleanUp()` and rejects with `{ redirectTo: loginPagePath }` (`/login`), forcing the UI back to login when recovery has definitively failed upstream. On 403 it redirects to `unauthorizedPagePath` (`/unauthorized`) without logging the user out.
- `logout` and `checkError`'s 401 branch both go through `authService.cleanUp()`, which is the single place session state is torn down - this is the same cleanup that should run from the service's `onAuthFailure` so that a failed silent refresh and an explicit logout leave the app in the same state.
- `refreshToken()` on the provider calls the network service's `refresh()`: the one place a refresh is made, shared with the 401 recovery. It resolves `true` or `false`; the refresh itself is the service's `refreshToken` hook.

Together these two pieces mean: the network service handles the mechanics of one shared refresh and one retry per failing request, while `DefaultAuthProvider`/`DefaultAuthService` own where the session is stored, how login populates it, and how a definitive auth failure clears it and sends the user back to login.
