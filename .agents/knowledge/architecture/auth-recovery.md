---
type: Concept
title: Auth recovery
description: How ARDOR's network layer recovers from a 401 by refreshing the auth token once and retrying the failed request, and how DefaultAuthProvider/DefaultAuthService fit around it.
resource: packages/kernel/src/base/services/network-request.ts
tags: [architecture, auth, network, recovery, kernel]
---

Auth recovery is the retry-on-401 logic built into `DefaultNetworkRequestService` (packages/kernel/src/base/services/network-request.ts). It lets a request that fails with 401 attempt a single token refresh and one retry, instead of forcing every caller to hand-roll refresh logic.

## The flow

1. A request comes back with status 401.
2. The service calls `canRecover(paths)`. This returns false (no recovery attempted) when:
   - there is no `authRecovery.refreshToken` configured,
   - the path is a [no-auth path](/architecture/no-auth-paths.md) (`isNoAuthPath`), or
   - the path matches `authRecovery.refreshTokenPath` - the refresh-token endpoint itself must never trigger a recovery loop on its own failure.
3. If recovery is allowed, the service calls `ensureRefreshed()`.
4. `ensureRefreshed()` guards a single in-flight refresh with `this.refreshing`. Multiple concurrent 401s share the same promise (`this.refreshing ??= ...`) so the app never fires more than one refresh call at a time, no matter how many requests failed together. The refresh call is wrapped in `Promise.resolve().then(() => refreshToken())` deliberately: a `refreshToken` that throws synchronously is treated as a failed refresh (going through `onAuthFailure`) rather than escaping as an unrelated exception out of `doRequest`.
5. On success, `ensureRefreshed()` resolves `true`. The service then retries the original request exactly once, with the auth headers re-read (see below).
6. On failure, it calls `authRecovery.onAuthFailure?.()` (swallowing any error from that callback itself, logging instead) and resolves `false`. The service then surfaces the original 401 - no infinite retry, no second refresh attempt.
7. `this.refreshing` is cleared in a `.finally()` regardless of outcome, so the next 401 can start a fresh refresh cycle.

This whole scheme sits below the [data provider pipeline](/architecture/data-provider-pipeline.md): the pipeline just sees a request that either succeeds after a transparent refresh, or fails with the original 401 for [error flow](/architecture/error-flow.md) to handle.

## Sharing it with an HTTP repository

`getDataSourceAuth(opts?)` returns an `IDataSourceAuth` for an `HttpDataSource` (IGNIS connectors `>=0.2.1-4`), four settings whose hooks IGNIS calls on every send, the retry included, with the request's `{ paths }`:
- `headersResolver` is `getSessionHeaders()` (the timezone, then what `setHeaders` holds now), plus `getTracingHeaders()` (channel and tracing id) when `opts` carries `restDataProviderOptions` and `applicationInfo`. The data provider's own `getDataSourceAuth()` passes both; `getNetworkService().getDataSourceAuth()` passes neither. `getRequestProps` builds its headers from the same two methods, so the two transports cannot drift.
- `authTokenResolver` is `resolveAuthToken()`, except `undefined` where `isNoAuthPath({ resource: paths[0], paths })` holds, which is every path when `useAuth` is `false`.
- `onUnauthorized` is `ensureRefreshed()` gated by `canRecover(paths)`, the data provider's own gate: no refresh on a no-auth path or on the refresh path. A 401 from a repository otherwise joins the same `this.refreshing` promise as the data provider's. The context's `signal` is deliberately unused: the refresh is shared, and IGNIS does not retry a call aborted meanwhile.
- `errorRootKey` is `'error'`, the same `ERROR_ROOT_KEY` constant `doRequest` reads its error envelope under, so a repository error keeps the server's `normalized.code`.

Pinned by the `getDataSourceAuth` block in `network-request.test.ts` (six tests: session headers set after construction, channel and tracing id, no token on a no-auth path, none with `useAuth: false`, no refresh on a no-auth 401, the code under `error`) and one in admin `rest-data.test.ts`. All six went red under four mutations: the resolver ignoring the path, `onUnauthorized` ignoring `canRecover`, an empty `headersResolver`, no `errorRootKey`. The two older tests still pin the shared refresh and `setAuthToken`.

It only holds if every consumer resolves the same network service. Declare the data provider with `@provide` in a `@configuration()` class, so `registerArtifacts()` binds it as a singleton; a bare `bind().toProvider(DefaultRestDataProvider)` is transient. See [DI in the browser](/architecture/di-in-the-browser.md).

## Headers and auth token

`getRequestHeader` builds the header set per request. For non-no-auth paths it calls `getRequestAuthorizationHeader()`, which reads the in-memory `authToken` or, only when there is none, the constructor's `authTokenResolver` (default `readAuthTokenFromStorage`, the stored token under `LocalStorageKeys.KEY_AUTH_TOKEN`), throwing a 401-tagged error if no token value is present. The resulting `Authorization` and `X-Auth-Provider` headers follow the shared [header protocol](/architecture/header-protocol.md).

The retry does not re-run `getRequestHeader`: it reuses the original request's headers and overrides only `Authorization` and `X-Auth-Provider`, from a fresh `getRequestAuthorizationHeader()` call. Because an in-memory token set by `setAuthToken` wins over localStorage, a `refreshToken` that only writes localStorage (for example through `DefaultAuthService.saveAuth`) is invisible to the retry once `setAuthToken` has been called - update the in-memory token too, or never set it.

Recovery only covers a 401 returned by the server. When no token exists at all (no in-memory `authToken` and nothing under `@app/auth/token`), `getRequestProps` throws a client-side 401 before `doRequest` runs, so no refresh is attempted and `onAuthFailure` is not called. The CRUD methods of `DefaultRestDataProvider` are not `async`, so from them that throw is synchronous.

## Configuring it

`authRecovery` comes from `IRestDataProviderOptions.authRecovery` (the `REST_DATA_PROVIDER_OPTIONS` binding) when `DefaultRestDataProvider` constructs its `DefaultNetworkRequestService`. It can be changed later with `dataProvider.getNetworkService().setAuthRecovery({ ... })`, which shallow-merges a partial into the current options (`getAuthRecovery()` reads them back). A `refreshToken` that needs a service bound at boot does not require it: `refreshToken` is only called when a 401 is recovered, so a closure in the options that resolves the service when called works too (see [vert-admin](/examples/vert-admin.md)).

## DefaultAuthProvider and DefaultAuthService

`DefaultAuthProvider` (packages/admin/src/providers/auth.ts) is the react-admin `authProvider` built on top of this. It does not itself implement the refresh/retry loop - that lives in the network service - but it is the layer that keeps the stored session consistent with recovery outcomes:

- `login` sends credentials to the configured sign-in path, then calls `authService.saveAuth({ token, userId, username })` to persist the session under the `LocalStorageKeys` keys that `getRequestAuthorizationHeader` later reads.
- `checkError` is react-admin's hook for provider-surfaced errors: on status 401 it calls `authService.cleanUp()` and rejects with `{ redirectTo: 'login' }`, forcing the UI back to login when recovery has definitively failed upstream. On 403 it redirects to `/unauthorized` without logging the user out.
- `logout` and `checkError`'s 401 branch both go through `authService.cleanUp()`, which is the single place session state is torn down - this is the same cleanup that should run from `authRecovery.onAuthFailure` so that a failed silent refresh and an explicit logout leave the app in the same state.
- `refreshToken()` on the provider itself is a no-op stub; the actual `refreshToken` implementation plugged into `authRecovery` is supplied separately (typically bound through DI, see [DI in the browser](/architecture/di-in-the-browser.md)) and is what `ensureRefreshed()` calls.

Together these two pieces mean: the network service handles the mechanics of one shared refresh and one retry per failing request, while `DefaultAuthProvider`/`DefaultAuthService` own where the session is stored, how login populates it, and how a definitive auth failure clears it and sends the user back to login.
