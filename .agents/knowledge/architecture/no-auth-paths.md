---
type: Concept
title: No-auth paths
description: How DefaultNetworkRequestService decides which requests skip the auth header, and why a 401 must never be fixed by widening that list.
resource: packages/kernel/src/base/services/network-request.ts
tags: [architecture, auth, network-request, no-auth-paths]
---

# No-auth paths

`DefaultNetworkRequestService` attaches an authorization header to every outgoing request unless the request's path is declared no-auth. This decision is made per-request by `isNoAuthPath`, and it is configured once at construction time through `INoAuthOptions`, not tuned reactively when something fails.

## The knobs

Three options passed into the constructor (`packages/kernel/src/base/services/network-request.ts`) control this:

- `useAuth` (default `true`) - a global switch. When `false`, every request is treated as no-auth and no token is ever attached.
- `noAuthPaths` - an array of exact resource strings. If the request's `resource` matches one of these strings exactly, no auth header is added.
- `noAuthPathRegex` - a `TNoAuthPathRegex`: a string, a `RegExp`, or an array of either. Each string entry is compiled with `new RegExp(...)`; invalid patterns are logged via `console.error` and dropped rather than throwing. The normalized list is kept as `noAuthPathRegexes: RegExp[]`.

Regex patterns are tested against two candidates: `resource` and `paths.join('/')` when a `paths` array is supplied. `lastIndex` is reset before each `test` call so global regexes do not silently skip matches on repeated use.

## isNoAuthPath

```ts
isNoAuthPath(opts: { resource?: string; paths?: string[] }): boolean {
  if (!this.useAuth) return true;
  if (resource && this.noAuthPaths?.includes(resource)) return true;
  if (!this.noAuthPathRegexes.length) return false;
  // test candidates against each regex...
}
```

The order matters: `useAuth` is checked first as a full bypass, then the exact-match list, then the regex list. Any one of them returning true is enough to skip auth for that request.

## Runtime setters

The three options are not fixed for the service's lifetime. `setUseAuth`, `setNoAuthPaths`, and `setNoAuthPathRegex` replace the corresponding state at runtime (the regex setter re-normalizes through the same string/RegExp/array logic used at construction). This lets an application reconfigure no-auth behavior, for example after login flows change which endpoints are public, without recreating the service.

## Why this is not the fix for a 401

A `401` response means the server rejected the credentials that were sent, or found none where it expected them. Widening `noAuthPaths` or `noAuthPathRegex` to make that request "pass" does not fix the underlying problem - it just stops the client from sending a token at all, which either produces a different error server-side or silently succeeds against an endpoint that was never meant to be public. Declaring a path no-auth is a statement about the resource's actual authentication requirements, decided once when the service is configured, not a runtime patch applied because a request happened to fail.

The correct response to a 401 belongs to the recovery contract described in [Auth recovery](/architecture/auth-recovery.md): a single refresh attempt, a single retry, and a defined failure path if the refresh itself does not succeed. `isNoAuthPath` is consulted internally by that recovery logic too - a path that is already no-auth is never considered eligible for a token refresh retry, since there was no token to have gone stale.

## Where this sits in the request pipeline

`DefaultNetworkRequestService` is one of the kernel services resolved through the container - see [DI in the browser](/architecture/di-in-the-browser.md) for how it gets constructed and injected, and [Data provider pipeline](/architecture/data-provider-pipeline.md) for how its output feeds react-admin's data provider contract. The header it builds (or omits) is part of the wider [Header protocol](/architecture/header-protocol.md) used across requests.
