---
title: The sign-in extension points are protected hooks, not options
description: IAuthProviderOptions is data only again. signInBody, signInUsername, onSignIn and persistSession of 0.1.4-4 become the protected hooks buildSignInBody, resolveUsername, beforeSaveSession and saveSession of DefaultAuthProvider, each taking one opts object.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## The sign-in extension points are protected hooks, not options

<Badge type="warning" text="Behavior Change" />

**In one line.** What 0.1.4-4 offered as four behaviour options of `IAuthProviderOptions` is now four protected hooks of `DefaultAuthProvider`, in IGNIS style: the options hold data, a subclass holds behaviour (issue #80).

```typescript
import { type AnyType, DefaultAuthProvider, type ISignInSession } from '@venizia/ardor';

export class AdminAuthProvider extends DefaultAuthProvider {
  protected override resolveUsername(opts: { params: AnyType }) {
    return opts.params.identifier.value;
  }

  protected override async beforeSaveSession(opts: { session: ISignInSession; params: AnyType }) {
    if (!opts.session.roles.includes('admin')) {
      throw new Error('[signIn] This console is for administrators');
    }
  }
}
```

## What changed

- **The options are gone.** `IAuthProviderOptions` keeps `endpoints` and `paths`. `signInBody`, `signInUsername`, `onSignIn` and `persistSession` no longer exist, and a key left in an options object is a type error.
- **Four hooks replace them**, each taking one `opts` object and able to use `this` and the injected services:

| 0.1.4-4 option | Hook |
|---|---|
| `signInBody(params)` | `buildSignInBody({ params })`: the IGNIS body by default; return `params` to post the form as it is |
| `signInUsername(params)` | `resolveUsername({ params })`: `params.username` by default |
| `onSignIn({ session, params })` | `beforeSaveSession({ session, params })`: awaited before the session is saved; a throw or a rejection rejects `login` and nothing is saved |
| `persistSession: false` | `saveSession({ session, username })`: `authService.saveAuth` by default; override it to do nothing and `login` still resolves |

- **`login` is the same sequence.** Post `buildSignInBody`, read the session, await `beforeSaveSession`, `saveSession`, resolve with `redirectTo`.
- **The `/auth/login` form post** is `paths.signIn` in the options and a `buildSignInBody` that returns `params`.

## Who is affected

- **An application on 0.1.4-4 that set one of the four options.** Move it to the matching hook in a subclass of `DefaultAuthProvider` and bind the subclass under `CoreBindings.DEFAULT_AUTH_PROVIDER`. None was known to be in use.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `src/common/types.ts` | kernel |
| `src/providers/auth.ts` | admin |
