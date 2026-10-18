---
title: No sign-in is a configuration, and login reads the IGNIS sign-in response
description: ArdorApplication runs without an auth provider when none is bound, and DefaultAuthProvider.login accepts the IGNIS auth component's bare token, reading the user id from the JWT. A subclass maps the request body with buildSignInBody.
packages: ['@venizia/ardor-admin']
---

# Changelog - 2026-10-18

## No sign-in is a configuration, and login reads the IGNIS sign-in response

<Badge type="tip" text="Enhancement" />

**In one line.** An admin over a public API leaves the auth provider unbound, and an admin over the IGNIS JWT auth component signs in with the default provider and one small subclass (issues #67 and #68).

```typescript
import { type AnyType, DefaultAuthProvider } from '@venizia/ardor';

export class IgnisAuthProvider extends DefaultAuthProvider {
  protected override buildSignInBody(params: AnyType) {
    return {
      identifier: { scheme: 'username', value: params.username },
      credential: { scheme: 'basic', value: params.password },
    };
  }
}
```

## What changed

- **The auth provider is optional.** `ArdorApplication` reads `CoreBindings.DEFAULT_AUTH_PROVIDER` without requiring it. Unbound, react-admin runs with no `authProvider`: no login page and every page public. Set `useAuth: false` on the REST options so no `Authorization` header is sent. Before, the missing binding threw on the first render, and the workaround was a subclass whose checks always resolve.
- **`login` reads two response shapes.** `{ userId, token: { value, type } }` as before, and the IGNIS auth component's `{ token: '<jwt>' }`: a bare token is stored as a `Bearer` token, and the user id is the response's `userId`, else the JWT's `userId` claim, else its `sub`. Before, a string token was spread into character keys and stored, and `checkAuth` rejected afterwards.
- **`login` fails loud.** A response with no token, or with no user id anywhere, rejects with a `[login]` error and stores nothing.
- **`buildSignInBody(params)` is the one step to override** when the API wants another request body. It returns `params` unchanged by default.

## Who is affected

- **An application on a response of `{ userId, token: { value, type } }`.** Nothing changes.
- **An application over the IGNIS auth controller.** Set `paths.signIn` to `/auth/sign-in` (and the same string in `noAuthPaths`), and override `buildSignInBody` as above. A subclass that only existed to read the token can go.
- **An application with a public API.** Delete the always-resolving auth provider and its bindings.

| File | Package |
|------|---------|
| `src/components/application.tsx`, `src/providers/auth.ts` | admin |
