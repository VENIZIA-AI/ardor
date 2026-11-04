---
title: A refreshTokenPath now refreshes the token without a subclass
description: When authRecovery.refreshTokenPath is set, the default refreshToken posts to it and saves the new token, keeping the stored identity and roles, so a 401 is recovered without writing a network service.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-04

## A refreshTokenPath now refreshes the token without a subclass

<Badge type="warning" text="Behavior Change" />

**In one line.** `authRecovery.refreshTokenPath` used to only stop the refresh endpoint from starting another refresh. Now `DefaultNetworkRequestService.refreshToken()` also uses it: it POSTs to that path with no body, saves the token of the answer, and the request that got the `401` is retried. Every app that has a refresh endpoint wrote the same subclass for this; it can go.

```ts
import type { IRestDataProviderOptions } from '@venizia/ardor';

const restDataProviderOptions: IRestDataProviderOptions = {
  url: 'https://api.example.com',
  authRecovery: { refreshTokenPath: '/auth/refresh' },
  noAuthPaths: ['/auth/sign-in'],
};
```

## What changed

- **The default refresh.** With a `refreshTokenPath` and the auth service, `refreshToken()` posts to the path with no body and the stored (expired) token, reads `{ token: { value, type } }` or `{ token: '<jwt>' }` from the answer, and saves it through the auth service. It then returns `true`, so the original request is retried once.
- **The stored session is kept.** A refresh keeps the same user: it saves the new token with the stored user id, and the stored `username`, `referenceId` and `provider` are passed back with it, and the roles are never passed, so a refresh answer that carries roles in another shape cannot wipe them.
- **A failure is as before.** A non-2xx answer, or an answer without a token, rejects the refresh: `onAuthFailure` runs once, the `401` stands, and the stored session is as it was.
- **Without a path, nothing changes.** With no `refreshTokenPath` the default still returns `false`. A subclass that overrides `refreshToken` is untouched.
- **Where the auth service comes from.** `DefaultRestDataProvider.value(container)` reads the optional `CoreBindings.DEFAULT_AUTH_SERVICE` binding and gives it to the network service as a new `authService` option. A network service you build yourself passes it in the options.
- **For another answer shape,** override the new protected hook `readRefreshedToken({ data })`.

## Who is affected

- **An app that set `refreshTokenPath` only to stop the loop, with no `refreshToken` override.** A `401` now sends a refresh request to that path with the old token, and on a failure runs `onAuthFailure`. If that path is not a refresh endpoint, remove the setting or override `refreshToken`.
- **An app with its own `refreshToken` subclass.** No action needed. You can delete it when it only posts to the path and saves the token.
- **All other apps.** No action needed.

See [Auth recovery](../best-practices/auth-recovery#the-default-refresh).
