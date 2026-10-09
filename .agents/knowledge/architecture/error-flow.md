---
type: Concept
title: Error flow
description: How thrown errors flow in ARDOR - ApplicationErrors built by getError and from the HTTP error envelope in doRequest - through @api() logging, checkError auth mapping, and useNotifyError display.
resource: packages/admin/src/hooks/use-notify-error.ts
tags: [architecture, errors, error-handling, auth, notifications]
---

ARDOR treats errors as data, not exceptions to pattern-match on. The data and auth layers raise their failures with `getError` from `@venizia/ignis-inversion`, which returns an `ApplicationError`. `doRequest` builds one from the HTTP error envelope (step 1); `DefaultAuthProvider.getIdentity` is the exception, rejecting with a plain `{ message }` object. Nothing in those layers does `new Error(...)` - see [Error handling](/conventions/error-handling.md) for the rule and [Coding style](/conventions/coding-style.md) for why. This concept walks the actual path an error takes at runtime.

**1. Where errors originate: doRequest**

The network layer's `doRequest` (`DefaultNetworkRequestService`, `packages/kernel/src/base/services/network-request.ts`) is where HTTP failures enter the flow. On a non-2xx response it reads the body with IGNIS `HttpResponseReader.readError` under the `error` root key (`ERROR_ROOT_KEY`, the same key `getDataSourceAuth()` gives an `HttpDataSource`) and throws an `ApplicationError` from `toResponseError`, mapped like IGNIS `HttpDataSource`: `statusCode` is the HTTP status (always set; a `statusCode` in the body is ignored); `message` and `normalized.text` are the server's `normalized.text`, else `message`, else `HTTP <status>` (the server text, not a log line, because react-admin shows `error.message`); `normalized.code` is the server code lower-cased, `core.system_error` when none, and `normalized.args` the server args or `{}`; `extra` is the server `extra` plus `requestId` (a relaying server's earlier `extra.requestId` moves to `extra.upstreamRequestIds`, nearest first), `undefined` when empty; `cause` is `details.cause`. Every other body key is dropped (`type`, `path`, `url`, the rest of `details`, ad hoc fields) and the top-level `requestId` lives in `extra.requestId`. A body without the `error` key is read as it stands; a body that is not JSON, is empty, is an array, or holds a string under `error` has no known fields and becomes `HTTP <status>` with the default code, never a `SyntaxError` or a bare string. The admin REST data provider returns the `doRequest` promise without a catch, so the `ApplicationError` reaches react-admin unchanged (before 2026-10-10 it was the raw parsed body, `body.error ?? body`). The failures ARDOR raises itself do use `getError`: `doRequest` throws `getError({ message })` when no `baseUrl` is set, and `getRequestAuthorizationHeader` throws `getError({ message, statusCode: 401 })` for a missing token rather than constructing a native `Error`.

**2. Logging: the @api() decorator**

Service methods that make outbound calls are wrapped with the `@api()` decorator (`packages/kernel/src/base/decorators/api.ts`). It wraps the original method in a try/catch: on success it returns the result untouched; on failure it logs `[methodName] resource: X | error: %o` through `this.logger.error` and then rethrows the same error object. It never swallows or replaces the error - its only job is to attach a consistent log line before the error keeps propagating up through the [Data provider pipeline](/architecture/data-provider-pipeline.md). Any `BaseService` method decorated with `@api()` gets this for free; the log line reads an optional `resource` field on the instance and prints `-` without one.

**3. Auth-specific mapping: checkError**

`DefaultAuthProvider.checkError` (part of the auth provider consumed by react-admin) inspects the status on the thrown error - `status` (react-admin's own `HttpError`), else `statusCode` (an `ApplicationError`) - and maps it to react-admin's expected reject shape:

- `401` triggers `authService.cleanUp()` and rejects with `{ redirectTo: 'login' }`.
- `403` rejects with `{ redirectTo: '/unauthorized', logoutUser: false }` - the session is kept alive, only the route changes.
- Anything else resolves, meaning react-admin treats it as not an auth-related failure.

This is the bridge between thrown HTTP failures and the redirect behavior described in [Auth recovery](/architecture/auth-recovery.md). Since 2026-10-10 it falls back to `statusCode`, so every `doRequest` failure and the missing-token 401 (`getRequestAuthorizationHeader`) reach these branches; before, it read only `status`, which an `ApplicationError` never has, and a 401 or 403 from the data provider never redirected.

**4. Display: useNotifyError**

At the UI edge, `useNotifyError` (packages/admin/src/hooks/use-notify-error.ts) is the hook components call to surface an error to the user. It takes an `ApplicationError` - which is what `doRequest` now throws - and reads `error.normalized?.code` as the notification message key and `error.normalized?.args` as the interpolation arguments, passing both into react-admin's `notify` with `type: 'error'`. This is why upstream code must produce real `ApplicationError`s via `getError` rather than plain objects or bare `Error`s: the `normalized` field is what makes translation-aware, argument-interpolated error messages possible. See [i18n](/architecture/i18n.md) for how `code` resolves to a translated string.

**The non-obvious rules**

- Never construct errors with `new Error(...)` and never branch with `instanceof ApplicationError` across package boundaries - always `getError` in, `ApplicationError` out (`isApplicationError()` to test). `doRequest` follows it: the backend's envelope is read into an `ApplicationError`, and `error instanceof Error` is true. An `ApplicationError` carries `statusCode`, not `status`, so `checkError` never sees a status on one. Read the request id from `error.extra.requestId`; the body's own top-level `requestId` is not a property of the error.
- `@api()` only logs and rethrows - it is not a place to transform or downgrade errors.
- `checkError`'s 401 handling actively cleans up auth state before redirecting, so a 401 is both a navigation event and a side-effecting logout, not just a passive to the login page.
- `useNotifyError` assumes `error.normalized` exists; if a thrown value skipped `getError` somewhere upstream (the auth provider's plain `{ message }` rejection, for one), the notification will silently show `undefined` as the message key, which is the practical cost of breaking the "always use getError" rule. A `doRequest` failure always has `normalized`.
