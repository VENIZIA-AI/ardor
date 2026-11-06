---
title: An application id keeps two applications on one origin apart
description: IApplicationInfo.id scopes the session keys and the store prefix in browser storage; without it nothing changes, so a single application per origin needs no migration.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-06

## An application id keeps two applications on one origin apart

<Badge type="tip" text="New Feature" />

**In one line.** Two ARDOR applications served from one origin used to share one session and one `@app/store/` namespace. Give each an `id` in its application info and their keys are separate.

```ts
const info = { name: 'Shop', version: '1.0.0', description: 'The shop', id: 'shop' };
// the session is now @app/auth/shop/token, @app/auth/shop/identity and @app/auth/shop/permission,
// the store prefix @app/store/shop/
```

## What changed

- **`IApplicationInfo.id`.** Optional; letters, digits, `.`, `_` and `-`, not dots only. An invalid id stops `DefaultAuthService` from being built.
- **`LocalStorageKeys.scoped({ id })`** answers the keys of one application; without an id they are the existing constants.
- **One place.** `DefaultAuthService` reads the id from `CoreBindings.APPLICATION_INFO` and exposes `keys`. Its `cleanUp`, `DefaultAuthProvider`'s sign-out sweep of the store and the request service's default token all use it, so signing out of one application leaves the other's session and data alone. The keys stay under `@app/auth/`, which `BrowserStorage` still refuses to write.
- **No id, no change.** An application without an `id` keeps the keys it has, so there is nothing to migrate. An application with an `id` starts with an empty session under the new keys: its users sign in once.

## Who is affected

- **Applications that share an origin.** Give each an `id`. One without an id still sweeps all of `@app/auth/` and `@app/store/` at sign-out, the others' keys included.
- **All other applications.** No action needed.
