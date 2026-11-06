---
title: Sign-out removes the stored data and the cached queries of the user
description: When the session ends, by any route, the auth provider removes the keys under @app/store/ and the application empties the query cache.
packages: ['@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-06

## Sign-out removes the stored data and the cached queries of the user

<Badge type="warning" text="Behavior Change" />

**In one line.** When the session ends, whether by a sign-out, a `401`, a failed refresh or code that calls `DefaultAuthService.cleanUp`, ARDOR removes the keys under `@app/store/` and empties the query cache, so the next user of the browser does not see the previous one's data.

## What changed

- **`@app/store/` keys are removed.** `DefaultAuthProvider.clearStoredData` runs when the session is gone and removes every key under `LocalStorageKeys.PREFIX_STORE` in `localStorage` and `sessionStorage`. Override it to keep some.
- **The query cache is emptied.** `ArdorApplication` owns the `QueryClient` (yours, if you pass `queryClient`) and empties it when the stored session disappears, after the redirect, as react-admin's own sign-out does. Before, only a sign-out through react-admin's logout emptied it.

- **A pending write is dropped too.** `BrowserStorage.removeWhere` tells every subscriber of a key under the prefix, stored or not, so a `useStoredState` with `writeDelayMs` that has not stored its first value yet does not write it after the sign-out.
- **A throwing `clearStoredData` does not stop the session from ending**; the error is logged.

## What this does not cover

It covers the `@app/store/` keys and the `QueryClient` that `ArdorApplication` owns, in the tab where the session ends. It does not clear react-admin's own store (react-admin's sign-out does), your Redux store, IndexedDB, cookies or the Cache API, and another tab clears when it next ends its own session. Reset those from `onSessionCleared` of your auth provider.

## Who is affected

- **An app that keeps a preference under `@app/store/`**, such as a theme or a sidebar width, and wants it to outlive a sign-out: move the key to `@app/prefs/<name>` (the reference examples now use it), or override `clearStoredData`. The old key is not migrated.
- **All other apps.** No action needed.
