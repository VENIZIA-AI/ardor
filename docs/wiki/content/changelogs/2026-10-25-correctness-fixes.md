---
title: Correctness fixes in the kernel, the admin and the hooks
description: A series of fixes in the data providers, the network service, the auth service and the React hooks where the code did not do what its documentation said.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-25

## Correctness fixes in the kernel, the admin and the hooks

<Badge type="info" text="Bug Fix" />

**In one line.** A series of small fixes where the code did not do what its documentation said; none changes a public signature.

## What changed

- **An async `getAppInfo`.** `preConfigure` now waits for it, so `APPLICATION_INFO` holds the info and not a promise. A synchronous `getAppInfo` keeps `preConfigure` synchronous.
- **A response body that is not an object.** `convertResponse` with `requestCountData=1` throws the documented error for `null` and for a primitive body, instead of a `TypeError`.
- **Errors are no longer swallowed.** A failed token refresh, a failing `onAuthFailure`, an invalid `noAuthPathRegex` pattern, a stored token that is not JSON, and a JWT payload that cannot be decoded are now logged. The last two log the error name only, because a JSON parse error message quotes the token.
- **Data-provider methods reject.** `getList`, `getOne`, `getMany`, `getManyReference`, `create`, `update`, `updateMany`, `delete`, `deleteMany` and `send` of the REST data provider are `async`: a failure while the request is being built is a rejected promise, as react-admin expects, not a synchronous throw.
- **`CountRestDataProvider` keeps the list extras.** The `extra` a list route answers reaches the result as `meta.extra`, and the `x-request-extra` header built for the list is no longer sent to the `/count` route.
- **`DefaultAuthService` on bad or missing storage.** `getUser` and `getRoles` read a corrupt stored value as empty instead of throwing, and `getRoles` keeps only the strings of a stored list. `getAuth` no longer logs the stored text (it is the token); it logs the error name. Every method is safe where there is no `localStorage`, and `saveAuth` throws a clear error there, because a sign-in that is not kept must not look like it worked. `cleanUp` removes the two prefixes `LocalStorageKeys.PREFIX_AUTH` and `PREFIX_OAUTH2`.
- **List pagination.** The page defaults to 1 (a missing page used to send a negative `skip`), a `perPage` of 0 or none sends no limit instead of `limit: 0`, and only `skip` is sent: IGNIS reads `offset` as its alias.
- **React hooks.** `useSizer` reports the `offsetWidth` and `offsetHeight` of the element as they are (it mixed `clientWidth` and `offsetHeight` and added a pixel to each). `useWindowDimensions` answers 0 by 0 where there is no `window`, instead of throwing, and measures the browser once mounted. A `confirm()` that replaces an open prompt resolves the replaced one with `false`; it used to leave it pending forever. `useAutosave` and `useCopyToClipboard` log through the application `Logger`, not `console`.
- **`ArdorApplication` resolves its providers once.** The memo of the data, auth and i18n providers never held, so the container was read again on each render. It now depends on the container only; the react-admin props are spread on top, as before.
- **Type parameter name.** The generic parameter of `send`, `doRequest` and `parseResponse` is `TResult` (it was `ReturnType`, which shadowed the TypeScript utility type). Callers pass it positionally, so nothing changes.

## Who is affected

- **A server that reads only `offset`.** The list request no longer carries it; read `skip`, which IGNIS treats as the primary.
- **A layout that relied on the extra pixel of `useSizer`.** The size is now the element's real `offsetWidth` and `offsetHeight`.
- **A log reader.** The new lines are warnings and errors for the failures above, and a debug line for an undecodable JWT payload.
