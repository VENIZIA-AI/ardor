---
title: Sign-in can stay on the page, and the resolved auth provider can be typed as present
description: paths.afterLogin accepts false so login resolves with redirectTo false; ApplicationProviders.resolve takes isAuthRequired to type the auth provider as present.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-06

## Sign-in can stay on the page, and the resolved auth provider can be typed as present

<Badge type="tip" text="New Feature" />

**In one line.** A shell that must not navigate after sign-in sets `paths.afterLogin: false`, and an application that always binds a sign-in resolves its providers with `isAuthRequired: true` to get `authProvider` without an optional type.

```ts
import type { IAuthProviderOptions } from '@venizia/ardor';

const options: IAuthProviderOptions = { paths: { afterLogin: false } };
// login() resolves { ...response, redirectTo: false }: react-admin does not navigate
```

## What changed

- **`paths.afterLogin` is `string | false`.** `false` makes `login` resolve with `redirectTo: false`. `DefaultAuthProvider.afterLoginPath` is `string | false` now; an override that returns a string still compiles.
- **`ApplicationProviders.resolve({ container, isAuthRequired: true })`** returns `authProvider` typed as present and throws when none is bound. Without the option the result is as before: a missing sign-in leaves `authProvider` out.

## Who is affected

- **A guest or kiosk shell**, and **a test that resolves the providers of an application that has a sign-in**: use the options above.
- **All other applications.** No action needed.
