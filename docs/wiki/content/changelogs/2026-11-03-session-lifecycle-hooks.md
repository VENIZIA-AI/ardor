---
title: DefaultAuthProvider has session hooks
description: onSessionStarted and onSessionCleared tell a subclass when the session starts, changes its token or ends, so a socket or a per-user cache stays in step without overriding checkAuth.
packages: ['@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-03

## DefaultAuthProvider has session hooks

<Badge type="tip" text="New Feature" />

**In one line.** Override `onSessionStarted` and `onSessionCleared` on `DefaultAuthProvider` to keep a socket or a per-user cache in step with the session. You no longer override `checkAuth` for it.

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

## What changed

- **`onSessionStarted({ token, user })`.** It runs after `login` saved the session, after a `checkAuth` confirmed it, and after `refreshToken()` stored a new token. A re-check of the same user and token does not call it again.
- **`onSessionCleared({ reason })`.** It runs after `logout`, after the 401 branch of `checkError`, and when `checkAuth` rejects. `reason` is `SessionClearReasons.LOGOUT`, `UNAUTHORIZED` or `REJECTED`. It runs once for a session, and not for a session that was never announced.
- **Both hooks are optional.** The default of each does nothing, so an application that overrides neither behaves as before. A rejected `checkAuth` still does not clear the stored token.
- **They are awaited, and they cannot break sign-in.** A hook that throws or rejects is logged and the call carries on. A hook that has not settled after `sessionHookTimeout` (10 seconds, a protected getter you can override) is logged and left behind. Hook calls run one after the other.
- **Do not call the provider from a hook.** A `this.logout()` inside a hook waits behind that hook until the timeout.
- **New exports.** `SessionClearReasons` and `TSessionClearReason`, from `@venizia/ardor-admin` and `@venizia/ardor`. The new protected getter is `sessionHookTimeout`.

## Who is affected

- **An app that overrides `checkAuth`, `logout` or `saveSession` to sync a socket or a cache with the session.** Move that code into the two hooks and delete the overrides.
- **All other apps.** No action needed.

The provider reacts to its own calls only. A `cleanUp` run by your network service's `onAuthFailure` fires no hook; the next `checkAuth` or a 401 in `checkError` does.

See [Auth provider](../references/auth-provider#session-hooks).
