---
title: Sign-out clears only keys under @app/auth/, not @app/oauth2/
description: DefaultAuthService.cleanUp no longer removes keys under @app/oauth2/, and LocalStorageKeys.PREFIX_OAUTH2 is removed.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-11-02

## Sign-out clears only keys under `@app/auth/`, not `@app/oauth2/`

<Badge type="warning" text="Breaking Change" />

**In one line.** `DefaultAuthService.cleanUp()` removes only the keys that start with `@app/auth/`. A key under `@app/oauth2/` stays in `localStorage` after sign-out, and `LocalStorageKeys.PREFIX_OAUTH2` is gone.

## What changed

- **`cleanUp` has one prefix.** It removes `@app/auth/token`, `@app/auth/identity`, `@app/auth/permission` and any other key under `@app/auth/`. Sign-out and the 401 branch of `checkError` both call it.
- **`LocalStorageKeys.PREFIX_OAUTH2` is removed.** `LocalStorageKeys.PREFIX_AUTH` stays.
- **ARDOR never wrote under `@app/oauth2/`.** Only code of your own put keys there.

## Who is affected

- **An app that keeps OAuth2 state, such as a PKCE verifier, under `@app/oauth2/`.** Sign-out no longer removes it. A token left in the browser is a leak, so clear those keys yourself on sign-out (see below).
- **An app that reads `LocalStorageKeys.PREFIX_OAUTH2`.** It no longer compiles. Use your own constant.
- **All other apps.** No action needed.

## Breaking changes

> [!WARNING]
> Only an app that stores something under `@app/oauth2/` is affected.

**Before:** `cleanUp()` removed every key under `@app/auth/` and `@app/oauth2/`.

**After:** `cleanUp()` removes only the keys under `@app/auth/`. To keep the old effect for your own keys, move them under `@app/auth/`, or remove them yourself when the user signs out:

```ts
export const clearOAuth2Keys = (): void => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('@app/oauth2/')) {
      localStorage.removeItem(key);
    }
  }
};
```
