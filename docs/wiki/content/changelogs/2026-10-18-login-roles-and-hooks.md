---
title: login stores roles, and hooks replace a login override
description: DefaultAuthProvider.login saves the roles of the sign-in response (or the token's roles claim) where getRoles reads them, and the hooks resolveUsername, beforeSaveSession and saveSession cover what an application overrides login for.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## login stores roles, and hooks replace a login override

<Badge type="tip" text="Enhancement" />

**In one line.** `login` fills `getRoles()` from the sign-in response, and an application that overrode `login` to refuse a user, hand the token to another service, name the remembered user or skip saving overrides a hook instead (issue #74; 0.1.4-4 shipped the hooks as options, see [the sign-in hooks](./2026-10-18-sign-in-hooks)).

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

- **Roles are stored.** IGNIS's auth controller returns whatever the application's `signIn` returns, and `{ userId, roles?, token: { value, type } }` is the recommended shape. `login` saves `roles` of the response, else the `roles` claim of the token, where `getRoles()` reads them (`@app/auth/permission`). A role is a string, or an object named by its `identifier` (IGNIS's role model) or else its `name`; another entry is skipped. Each login replaces the last user's roles. Before, `roles` was dropped and `getRoles()` stayed empty.
- **`saveAuth` takes `roles`.** `DefaultAuthService.saveAuth({ ..., roles })` writes them; called without `roles`, as a token refresh does, it leaves the stored roles alone.
- **`resolveUsername({ params })`** names the username stored with the identity. Default: `params.username`.
- **`beforeSaveSession({ session, params })`** runs after the response is read and before the session is saved, and is awaited. A throw or a rejection rejects `login` and nothing is saved. `session` is `{ userId, token, roles }`.
- **`saveSession({ session, username })`** saves the session; override it to do nothing when the session is kept elsewhere, and `login` still resolves. Default: `authService.saveAuth`.
- **`ISignInSession` is exported** from `@venizia/ardor` and `@venizia/ardor-kernel`.

## Who is affected

- **An application that stores roles in a `login` override.** The override can go: the roles are stored from the response. One that writes the key after `super.login` still works.
- **An application whose `login` override refuses a user or calls another service.** Move the check to `beforeSaveSession`, which runs before anything is saved.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `src/common/types.ts`, `src/base/services/auth.ts` | kernel |
| `src/providers/auth.ts` | admin |
