---
type: Concept
title: Error flow
description: How ARDOR turns thrown errors into a normalized shape that flows from network calls through @api() logging, checkError auth mapping, and useNotifyError display.
resource: packages/admin/src/hooks/use-notify-error.ts
tags: [architecture, errors, error-handling, auth, notifications]
---

ARDOR treats errors as data, not exceptions to pattern-match on. Every error that crosses a package boundary is created with `getError` from `@venizia/ignis-inversion`, which returns an `ApplicationError`. Nothing in the codebase does `new Error(...)` or `instanceof Error` checks across package boundaries - see [Error handling](/conventions/error-handling.md) for the rule and [Coding style](/conventions/coding-style.md) for why. This concept walks the actual path an error takes at runtime.

**1. Where errors originate: doRequest**

The network layer's `doRequest` is the single place raw HTTP failures get turned into `ApplicationError`s. When a request fails, ARDOR throws `getError` built from `body.error ?? body` - it prefers a server-supplied `error` field on the response body, falling back to the whole body if no `error` key exists. This means the shape of the error depends on what the backend sends, but the throwing code never has to guess: it always produces an `ApplicationError` with a `statusCode` and, where the server provides one, a normalized `code`/`args` pair. `getRequestAuthorizationHeader` in the auth flow follows the same pattern when it throws for a missing token, calling `getError({ message, statusCode: 401 })` directly rather than constructing a native `Error`.

**2. Logging: the @api() decorator**

Service methods that make outbound calls are wrapped with the `@api()` decorator (`packages/kernel/src/base/decorators/api.ts`). It wraps the original method in a try/catch: on success it returns the result untouched; on failure it logs `[methodName] resource: X | error: %o` through `this.logger.error` and then rethrows the same error object. It never swallows or replaces the error - its only job is to attach a consistent log line before the error keeps propagating up through the [Data provider pipeline](/architecture/data-provider-pipeline.md). Any `BaseApiService` method decorated with `@api()` gets this for free.

**3. Auth-specific mapping: checkError**

`DefaultAuthProvider.checkError` (part of the auth provider consumed by react-admin) inspects the `status` on the thrown error and maps it to react-admin's expected reject shape:

- `401` triggers `authService.cleanUp()` and rejects with `{ redirectTo: 'login' }`.
- `403` rejects with `{ redirectTo: '/unauthorized', logoutUser: false }` - the session is kept alive, only the route changes.
- Anything else resolves, meaning react-admin treats it as not an auth-related failure.

This is the bridge between raw `ApplicationError`s carrying HTTP status codes and the redirect behavior described in [Auth recovery](/architecture/auth-recovery.md). Note that `checkError` here works off `status`, matching whatever shape `doRequest`'s thrown error exposes to react-admin's data provider contract.

**4. Display: useNotifyError**

At the UI edge, `useNotifyError` (packages/admin/src/hooks/use-notify-error.ts) is the hook components call to surface an error to the user. It takes an `ApplicationError` and reads `error.normalized?.code` as the notification message key and `error.normalized?.args` as the interpolation arguments, passing both into react-admin's `notify` with `type: 'error'`. This is why upstream code must produce real `ApplicationError`s via `getError` rather than plain objects or native `Error`s: the `normalized` field is what makes translation-aware, argument-interpolated error messages possible. See [i18n](/architecture/i18n.md) for how `code` resolves to a translated string.

**The non-obvious rules**

- Never construct errors with `new Error(...)` and never branch with `instanceof` across package boundaries - always `getError` in, `ApplicationError` out. This keeps the shape consistent so `checkError` and `useNotifyError` can rely on `status` and `normalized` always being present in the right cases.
- `@api()` only logs and rethrows - it is not a place to transform or downgrade errors. Transformation happens once, at the `doRequest` boundary.
- `checkError`'s 401 handling actively cleans up auth state before redirecting, so a 401 is both a navigation event and a side-effecting logout, not just a passive to the login page.
- `useNotifyError` assumes `error.normalized` exists; if a thrown value skipped `getError` somewhere upstream, the notification will silently show `undefined` as the message key, which is the practical cost of breaking the "always use getError" rule.
