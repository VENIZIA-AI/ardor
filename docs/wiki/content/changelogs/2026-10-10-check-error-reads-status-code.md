---
title: checkError redirects on a 401 or 403 from the data provider
description: DefaultAuthProvider.checkError falls back to statusCode, so an ApplicationError thrown by the data provider now reaches its 401 and 403 branches.
---

# Changelog - 2026-10-10

## checkError redirects on a 401 or 403 from the data provider

<Badge type="info" text="Bug Fix" />

**In one line.** `DefaultAuthProvider.checkError` reads `status`, else `statusCode`, so a `401` or `403` thrown by the data provider now logs out or redirects as the method always intended.

## What changed

- **The status it reads.** `checkError` takes `params.status` (react-admin's own `HttpError`) and, when that is absent, `params.statusCode` (an `ApplicationError`). Before, it read only `status`, and an error from `doRequest` has only `statusCode`, so the `401` and `403` branches never ran for a data provider failure.
- **The branches themselves are unchanged.** `401` runs `authService.cleanUp()` and rejects with `{ redirectTo: 'login' }`. `403` rejects with `{ redirectTo: '/unauthorized', logoutUser: false }` and keeps the session. Anything else resolves.
- **No error at all.** `checkError(undefined)` resolves instead of throwing.

## Who is affected

- **Applications that use `DefaultAuthProvider.checkError` as it is.** A `401` the data provider gives up on (recovery failed or was not allowed) now ends the session and goes to login, and a `403` now goes to `/unauthorized`. Make sure the router has an `/unauthorized` route.
- **Applications that override `checkError` and read only `status`.** Unchanged, and still blind to data provider failures. Read `params?.status ?? params?.statusCode`, or call `super.checkError(params)`.

## Details

| File | Package |
|------|---------|
| `src/providers/auth.ts` | admin |
| `src/__tests__/providers/auth.test.ts` | admin |

See [Auth provider](../references/auth-provider#checkerror).
