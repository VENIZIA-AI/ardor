---
title: IGNIS's sign-in is the default, and an application can run with no sign-in
description: DefaultAuthProvider signs in the way the IGNIS auth controller expects - POST /auth/sign-in, the identifier/credential body, a bare token in the response - and the old path and body stay behind paths.signIn and signInBody. ArdorApplication runs without an auth provider, and a signed-out deep link no longer loops.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## IGNIS's sign-in is the default, and an application can run with no sign-in

<Badge type="warning" text="Behavior Change" />

**In one line.** ARDOR is IGNIS's frontend, so `DefaultAuthProvider` signs in the way IGNIS's auth controller expects; an application on the previous contract sets two options (issues #67, #68 and #73).

```typescript
import { type IAuthProviderOptions } from '@venizia/ardor';

// Keep the previous contract: its path, and the login form as the body.
export const previousContract: IAuthProviderOptions = {
  paths: { signIn: '/auth/login' },
  signInBody: (params) => params,
};
```

## What changed

- **The default sign-in is IGNIS's.** `paths.signIn` defaults to `/auth/sign-in` (it was `/auth/login`), and the body is `{ identifier: { scheme: 'username', value: params.username }, credential: { scheme: 'basic', value: params.password } }` (it was the login form as it came). The path must be in `noAuthPaths`.
- **`signInBody` is a new option** of `IAuthProviderOptions`: `(params) => body`. `(params) => params` keeps the form body, and a login form with other fields maps its own. A subclass can override the protected `buildSignInBody(params)` instead.
- **`login` reads two response shapes.** `{ userId, token: { value, type } }` as before, and the IGNIS auth component's `{ token: '<jwt>' }`: a bare token is stored as a `Bearer` token, and the user id is the response's `userId`, else the JWT's `userId` claim, else its `sub`. Before, a string token was spread into character keys and stored, and `checkAuth` rejected afterwards.
- **`login` fails loud.** A response with no token, or with no user id anywhere, rejects with a `[login]` error and stores nothing.
- **The auth provider is optional.** `ArdorApplication` reads `CoreBindings.DEFAULT_AUTH_PROVIDER` without requiring it. Unbound, react-admin runs with no `authProvider`: no login page and every page public. Set `useAuth: false` on the REST options so no `Authorization` header is sent. Before, the missing binding threw on the first render.
- **A signed-out deep link no longer loops.** `checkAuth` and `checkError` rejected with `{ redirectTo: 'login' }`, which react-admin resolves against the current route: `#/products` went to `#/products/login`, then `#/products/login/login`, without end. They now reject with `{ redirectTo: '/login' }`.

## Who is affected

- **An application whose backend signs in at `/auth/login` with the form body.** Add the two options above, or move the backend to IGNIS's route. Without them the first sign-in posts to `/auth/sign-in` and fails.
- **An application over the IGNIS auth controller.** Delete the subclass or the `paths.signIn` that only mapped the contract, and list `/auth/sign-in` in `noAuthPaths`.
- **An application with its own `loginPage` route other than `/login`.** The redirect is now absolute; keep the login page at `/login`.
- **An application with a public API.** Delete the always-resolving auth provider and its bindings.

| File | Package |
|------|---------|
| `src/common/types.ts` | kernel |
| `src/components/application.tsx`, `src/providers/auth.ts` | admin |
