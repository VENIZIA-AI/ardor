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
5. On success, `ensureRefreshed()` resolves `true`. The service then retries the original request exactly once, using the freshly-set auth header.
6. On failure, it calls `authRecovery.onAuthFailure?.()` (swallowing any error from that callback itself, logging instead) and resolves `false`. The service then surfaces the original 401 - no infinite retry, no second refresh attempt.
7. `this.refreshing` is cleared in a `.finally()` regardless of outcome, so the next 401 can start a fresh refresh cycle.

This whole scheme sits below the [data provider pipeline](/architecture/data-provider-pipeline.md): the pipeline just sees a request that either succeeds after a transparent refresh, or fails with the original 401 for [error flow](/architecture/error-flow.md) to handle.

## Headers and auth token

`getRequestHeader` builds the header set per request. For non-no-auth paths it calls `getRequestAuthorizationHeader()`, which reads the current in-memory `authToken` or falls back to `localStorage.getItem(LocalStorageKeys.KEY_AUTH_TOKEN)`, throwing a 401-tagged error if no token value is present. The resulting `Authorization` and `X-Auth-Provider` headers follow the shared [header protocol](/architecture/header-protocol.md). After a successful refresh, whatever code path updates the stored/in-memory token (via `setAuthToken` or a fresh login) is what makes the retried request carry the new header - the retry re-runs `getRequestHeader`, it does not reuse the old one.

## DefaultAuthProvider and DefaultAuthService

`DefaultAuthProvider` (packages/admin/src/providers/auth.ts) is the react-admin `authProvider` built on top of this. It does not itself implement the refresh/retry loop - that lives in the network service - but it is the layer that keeps the stored session consistent with recovery outcomes:

- `login` sends credentials to the configured sign-in path, then calls `authService.saveAuth({ token, userId, username })` to persist the session under the `LocalStorageKeys` keys that `getRequestAuthorizationHeader` later reads.
- `checkError` is react-admin's hook for provider-surfaced errors: on status 401 it calls `authService.cleanUp()` and rejects with `{ redirectTo: 'login' }`, forcing the UI back to login when recovery has definitively failed upstream. On 403 it redirects to `/unauthorized` without logging the user out.
- `logout` and `checkError`'s 401 branch both go through `authService.cleanUp()`, which is the single place session state is torn down - this is the same cleanup that should run from `authRecovery.onAuthFailure` so that a failed silent refresh and an explicit logout leave the app in the same state.
- `refreshToken()` on the provider itself is a no-op stub; the actual `refreshToken` implementation plugged into `authRecovery` is supplied separately (typically bound through DI, see [DI in the browser](/architecture/di-in-the-browser.md)) and is what `ensureRefreshed()` calls.

Together these two pieces mean: the network service handles the mechanics of one shared refresh and one retry per failing request, while `DefaultAuthProvider`/`DefaultAuthService` own where the session is stored, how login populates it, and how a definitive auth failure clears it and sends the user back to login.
