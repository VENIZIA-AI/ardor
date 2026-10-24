---
title: Correctness fixes in the kernel, the admin and the hooks
description: Number parsing reads text as 0 instead of NaN and a float keeps its decimal point, and a series of smaller fixes in the data providers, the network service and the React hooks.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-25

## Correctness fixes in the kernel, the admin and the hooks

<Badge type="info" text="Bug Fix" />

**In one line.** A series of small fixes where the code did not do what its documentation said; none changes a public signature.

## What changed

- **Number parsing.** `toInteger` and `toFloat` return `0` for text that is not a number, as documented, instead of `NaN`. `getNumberValue` with `NumberParseMethods.FLOAT` keeps the decimal point: `'10.50'` reads `10.5`, not `1050`. The integer method still strips dots, so `'1.234'` reads `1234`.
- **An async `getAppInfo`.** `preConfigure` now waits for it, so `APPLICATION_INFO` holds the info and not a promise. The signature is unchanged and a synchronous `getAppInfo` keeps `preConfigure` synchronous.
- **A response body that is not an object.** `convertResponse` with `requestCountData=1` throws the documented error for `null` and for a primitive body, instead of a `TypeError`.
- **Errors are no longer swallowed.** A failed token refresh, a failing `onAuthFailure`, an invalid `noAuthPathRegex` pattern, a stored token that is not JSON, and a JWT payload that cannot be decoded are now logged. The last two log the error name only, because the message of a JSON parse error quotes the text it could not parse, which is the token.
- **Data-provider methods reject.** `getList`, `getOne`, `getMany`, `getManyReference`, `create`, `update`, `updateMany`, `delete`, `deleteMany` and `send` of the REST data provider are `async`: a failure while the request is being built is a rejected promise, as react-admin expects, and no longer a synchronous throw.
- **`CountRestDataProvider` keeps the list extras.** The `extra` a list route answers reaches the result as `meta.extra`, and the `x-request-extra` header built for the list is no longer sent to the `/count` route.
- **`DefaultAuthService` on bad or missing storage.** `getUser` and `getRoles` read a corrupt stored value as empty instead of throwing, and `getRoles` keeps only the strings of a stored list. `getAuth` no longer logs the stored text: the message of a JSON parse error quotes it, and the stored text is the token; the error name is logged. Every method is safe where there is no `localStorage`, and `saveAuth` throws a clear error there, because a sign-in that is not kept must not look like it worked. The two prefixes `cleanUp` removes are `LocalStorageKeys.PREFIX_AUTH` and `PREFIX_OAUTH2`.
- **List pagination.** The page defaults to 1 (a missing page used to send a negative `skip`), a `perPage` of 0 or none sends no limit instead of `limit: 0`, and only `skip` is sent: IGNIS reads `offset` as its alias, so the second copy was redundant.

## Who is affected

- **A server that reads only `offset`.** The list request no longer carries it; read `skip`, which IGNIS treats as the primary.
- **A log reader.** The new lines are warnings and errors for the failures above, and a debug line for an undecodable JWT payload.
- **Code that relied on `NaN` from `toInteger` or `toFloat`.** It now gets `0`.
- **Code that parsed a decimal with `getNumberValue` and `FLOAT`.** It now gets the decimal; the old result was a number 100 times too large for two decimals.
