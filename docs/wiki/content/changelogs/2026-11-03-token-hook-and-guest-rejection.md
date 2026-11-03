---
title: Session hooks see every token change, and the unauthenticated rejection is configurable
description: DefaultAuthService.subscribe tells the provider about every saved or cleared session, so onSessionStarted fires for a refresh by the network service, and unauthenticatedRejection sets what checkAuth and a 401 reject with.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-03

## Session hooks see every token change, and the unauthenticated rejection is configurable

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" />

**In one line.** `onSessionStarted` now fires for a token refreshed by your network service's 401 recovery, `onSessionCleared` fires for a `cleanUp` made outside the provider, and a guest app can set what `checkAuth` and a 401 reject with.

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

## What changed

- **`DefaultAuthService.subscribe({ listener })`** (`@venizia/ardor-kernel`). It runs after every `saveAuth` and `cleanUp` and returns a function that stops it. A listener that throws is logged and does not break the save.
- **A token change fires `onSessionStarted`.** `DefaultAuthProvider` listens, so a refresh that saves the new token with `saveAuth`, from the provider or from your network service, calls the hook with the new `token`. There is no separate refresh hook. The once-per-change and ordering guarantees are unchanged.
- **A new reason, `external`.** A `cleanUp` made by other code, such as your `onAuthFailure`, calls `onSessionCleared({ reason: SessionClearReasons.EXTERNAL })`. `logout` and the 401 branch keep `logout` and `unauthorized`.
- **`unauthenticatedRejection({ reason })`** (`@venizia/ardor-admin`). It returns the value `checkAuth` (reason `rejected`) and the 401 branch of `checkError` (reason `unauthorized`) reject with. The default is the old `{ redirectTo: loginPagePath }`, so an app that overrides nothing behaves as before.
- **A 401 can keep the session.** When the rejection has `logoutUser: false`, the provider does not run `cleanUp` and does not call `onSessionCleared`. The revoked token stays stored and keeps going out, so clear or replace it yourself (for example in `onAuthFailure`), or every request keeps answering 401.
- **`dispose()`.** The provider listens to the auth service from its constructor. Build one provider per service (a second one calls every hook again), and call `dispose()` on one you discard.
- **New exports.** `IAuthRejection`, and `SessionClearReasons.EXTERNAL`. The admin size limit goes from 10.5 kB to 10.65 kB (a repository gate).

## Who is affected

- **A guest app with no login page.** Override `unauthenticatedRejection`. `{ message: false }` alone still redirects to `/login`; `checkAuth` needs `redirectTo: false` too.
- **An app that syncs a socket or a cache in `onSessionStarted`.** It now also runs after a refresh your network service makes. Make the hook safe to run for a new token.
- **A token written straight to `localStorage`.** Still not seen. Save it with `DefaultAuthService.saveAuth`.
- **All other apps.** No action needed.

See [Auth provider](../references/auth-provider#session-hooks) and [Guest apps](../references/auth-provider#guest-apps).
