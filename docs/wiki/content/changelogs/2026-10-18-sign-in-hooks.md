---
title: login stores roles, and the sign-in extension points are protected hooks
description: DefaultAuthProvider.login saves the roles of the sign-in response where getRoles reads them. The four sign-in options of 0.1.4-4 become the protected hooks buildSignInBody, resolveUsername, beforeSaveSession and saveSession.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## login stores roles, and the sign-in extension points are protected hooks

<Badge type="tip" text="Enhancement" /> <Badge type="warning" text="Behavior Change" />

**In one line.** `login` fills `getRoles()` from the sign-in response (issue #74), and what 0.1.4-4 offered as four behaviour options of `IAuthProviderOptions` is four protected hooks of `DefaultAuthProvider` from 0.1.4-5, in IGNIS style: the options hold data, a subclass holds behaviour (issue #80).

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

- **Roles are stored.** IGNIS's auth controller returns whatever the application's `signIn` returns, and `{ userId, roles?, token: { value, type } }` is the recommended shape. `login` saves the `roles` of the response, else the `roles` claim of the token, where `getRoles()` reads them (`@app/auth/permission`). A role is a string, or an object named by its `identifier` (IGNIS's role model) or else its `name`.
- **`saveAuth` takes `roles`.** `DefaultAuthService.saveAuth({ ..., roles })` writes them; called without `roles`, as a token refresh does, it leaves the stored roles alone.
- **`ISignInSession` is exported** from `@venizia/ardor` and `@venizia/ardor-kernel`.
- **The behaviour options are gone.** `IAuthProviderOptions` holds data only (`paths`). `signInBody`, `signInUsername`, `onSignIn` and `persistSession` no longer exist, and a key left in an options object is a type error.
- **Four hooks replace them**, each taking one `opts` object and able to use `this` and the injected services:

| 0.1.4-4 option | Hook |
|---|---|
| `signInBody(params)` | `buildSignInBody({ params })`: the IGNIS body by default; return `params` to post the form as it is |
| `signInUsername(params)` | `resolveUsername({ params })`: `params.username` by default |
| `onSignIn({ session, params })` | `beforeSaveSession({ session, params })`: awaited before the session is saved; a throw or a rejection rejects `login` and nothing is saved |
| `persistSession: false` | `saveSession({ session, username })`: `authService.saveAuth` by default; override it to do nothing and `login` still resolves |

- **`login` is one sequence.** Post `buildSignInBody`, read the session, await `beforeSaveSession`, `saveSession`, resolve with `redirectTo`. The `/auth/login` form post is `paths.signIn` in the options and a `buildSignInBody` that returns `params`.

## Who is affected

- **An application that stores roles in a `login` override.** The override can go: the roles are stored from the response. One that writes the key after `super.login` still works.
- **An application that set one of the four options of 0.1.4-4, or whose `login` override refuses a user or calls another service.** Move it to the matching hook in a subclass of `DefaultAuthProvider` and bind the subclass under `CoreBindings.DEFAULT_AUTH_PROVIDER`.
- **Everyone else.** No action needed.

## Details

- The options moved again in the same release: [Options hold data, behaviour lives in protected hooks](./2026-10-18-hooks-not-flags) describes `endpoints` folding into `paths` and every hook taking an `opts` object.

| File | Package |
|------|---------|
| `src/common/types.ts`, `src/base/services/auth.ts` | kernel |
| `src/providers/auth.ts` | admin |
