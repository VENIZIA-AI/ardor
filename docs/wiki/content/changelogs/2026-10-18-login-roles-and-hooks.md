---
title: login stores roles, and three options replace a login override
description: DefaultAuthProvider.login saves the roles of the sign-in response (or the token's roles claim) where getRoles reads them, and signInUsername, onSignIn and persistSession cover what an application overrides login for.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## login stores roles, and three options replace a login override

<Badge type="tip" text="Enhancement" />

**In one line.** `login` fills `getRoles()` from the sign-in response, and an application that overrode `login` to refuse a user, hand the token to another service, name the remembered user or skip saving sets an option instead (issue #74).

```typescript
import { type IAuthProviderOptions } from '@venizia/ardor';

export const authOptions: IAuthProviderOptions = {
  signInUsername: (params) => params.identifier.value,
  onSignIn: ({ session }) => {
    if (!session.roles.includes('admin')) {
      throw new Error('[signIn] This console is for administrators');
    }
  },
};
```

## What changed

- **Roles are stored.** IGNIS's auth controller returns whatever the application's `signIn` returns, and `{ userId, roles?, token: { value, type } }` is the recommended shape. `login` saves `roles` of the response, else the `roles` claim of the token, where `getRoles()` reads them (`@app/auth/permission`). A role is a string, or an object named by its `identifier` (IGNIS's role model) or else its `name`; another entry is skipped. Each login replaces the last user's roles. Before, `roles` was dropped and `getRoles()` stayed empty.
- **`saveAuth` takes `roles`.** `DefaultAuthService.saveAuth({ ..., roles })` writes them; called without `roles`, as a token refresh does, it leaves the stored roles alone.
- **`signInUsername(params)`** names the username stored with the identity. Default: `params.username`.
- **`onSignIn({ session, params })`** runs after the response is read and before the session is saved, and may be async. A throw or a rejection rejects `login` and nothing is saved. `session` is `{ userId, token, roles }`.
- **`persistSession: false`** makes `login` save nothing and still resolve; `onSignIn` still runs. Default `true`.
- **`ISignInSession` is exported** from `@venizia/ardor` and `@venizia/ardor-kernel`.

## Who is affected

- **An application that stores roles in a `login` override.** The override can go: the roles are stored from the response. One that writes the key after `super.login` still works.
- **An application whose `login` override refuses a user or calls another service.** Move the check to `onSignIn`, which runs before anything is saved.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `src/common/types.ts`, `src/base/services/auth.ts` | kernel |
| `src/providers/auth.ts` | admin |
