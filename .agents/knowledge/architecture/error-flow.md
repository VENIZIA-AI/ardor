---
type: Concept
title: Error flow
description: How thrown errors flow in ARDOR - getError-built ApplicationErrors and raw HTTP failure bodies from doRequest - through @api() logging, checkError auth mapping, and useNotifyError display.
resource: packages/admin/src/hooks/use-notify-error.ts
tags: [architecture, errors, error-handling, auth, notifications]
---

ARDOR treats errors as data, not exceptions to pattern-match on. The data and auth layers raise their failures with `getError` from `@venizia/ignis-inversion`, which returns an `ApplicationError`. The main exception is an HTTP failure body, which `doRequest` rethrows as the backend sent it (step 1); `DefaultAuthProvider.getIdentity` also rejects with a plain `{ message }` object. Nothing in those layers does `new Error(...)` or `instanceof Error` checks - see [Error handling](/conventions/error-handling.md) for the rule and [Coding style](/conventions/coding-style.md) for why. This concept walks the actual path an error takes at runtime.

**1. Where errors originate: doRequest**

The network layer's `doRequest` (`DefaultNetworkRequestService`, `packages/kernel/src/base/services/network-request.ts`) is where raw HTTP failures enter the flow. On a non-2xx response it parses the JSON body and throws `body.error ?? body` as-is - it prefers a server-supplied `error` field, falling back to the whole body if no `error` key exists. The thrown value is whatever that JSON body holds, with a shape (including whether a `status` or `normalized` field is present) set by the backend, not a guaranteed `ApplicationError`. If the body is not JSON (empty, or an HTML proxy page), `rs.json()` itself rejects with a native `SyntaxError` that carries no status at all. The admin REST data provider returns the `doRequest` promise without a catch, so the value reaches react-admin unchanged. The failures ARDOR raises itself do use `getError`: `doRequest` throws `getError({ message })` when no `baseUrl` is set, and `getRequestAuthorizationHeader` throws `getError({ message, statusCode: 401 })` for a missing token rather than constructing a native `Error`.

**2. Logging: the @api() decorator**

Service methods that make outbound calls are wrapped with the `@api()` decorator (`packages/kernel/src/base/decorators/api.ts`). It wraps the original method in a try/catch: on success it returns the result untouched; on failure it logs `[methodName] resource: X | error: %o` through `this.logger.error` and then rethrows the same error object. It never swallows or replaces the error - its only job is to attach a consistent log line before the error keeps propagating up through the [Data provider pipeline](/architecture/data-provider-pipeline.md). Any `BaseService` method decorated with `@api()` gets this for free; the log line reads an optional `resource` field on the instance and prints `-` without one.

**3. Auth-specific mapping: checkError**

`DefaultAuthProvider.checkError` (part of the auth provider consumed by react-admin) inspects the `status` on the thrown error and maps it to react-admin's expected reject shape:

- `401` triggers `authService.cleanUp()` and rejects with `{ redirectTo: 'login' }`.
- `403` rejects with `{ redirectTo: '/unauthorized', logoutUser: false }` - the session is kept alive, only the route changes.
- Anything else resolves, meaning react-admin treats it as not an auth-related failure.

This is the bridge between thrown HTTP failures and the redirect behavior described in [Auth recovery](/architecture/auth-recovery.md). Note that `checkError` reads `status`, not `statusCode`: an `ApplicationError` built by `getError` (including the missing-token 401 from step 1) never matches, and an HTTP failure only matches if the backend body (or its `error` field) carries a `status`.

**4. Display: useNotifyError**

At the UI edge, `useNotifyError` (packages/admin/src/hooks/use-notify-error.ts) is the hook components call to surface an error to the user. It takes an `ApplicationError` and reads `error.normalized?.code` as the notification message key and `error.normalized?.args` as the interpolation arguments, passing both into react-admin's `notify` with `type: 'error'`. This is why upstream code must produce real `ApplicationError`s via `getError` rather than plain objects or native `Error`s: the `normalized` field is what makes translation-aware, argument-interpolated error messages possible. See [i18n](/architecture/i18n.md) for how `code` resolves to a translated string.

**The non-obvious rules**

- Never construct errors with `new Error(...)` and never branch with `instanceof` across package boundaries - always `getError` in, `ApplicationError` out. The exception is an HTTP failure body: `doRequest` rethrows it as received, so its `status` and `normalized` fields are the backend's contract, not ARDOR's. An `ApplicationError` carries `statusCode`, not `status`, so `checkError` never sees a status on one.
- `@api()` only logs and rethrows - it is not a place to transform or downgrade errors.
- `checkError`'s 401 handling actively cleans up auth state before redirecting, so a 401 is both a navigation event and a side-effecting logout, not just a passive to the login page.
- `useNotifyError` assumes `error.normalized` exists; if a thrown value skipped `getError` somewhere upstream (or is a backend error body with no `normalized` field), the notification will silently show `undefined` as the message key, which is the practical cost of breaking the "always use getError" rule.
