---
title: One logger per scope, singleton services, and a kernel that owns its headers
description: Logger.getInstance returns one instance per scope; service() and injectable() bind singletons; the application binds itself; per-call headers and x-www-form-urlencoded bodies are honoured.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-09-11

## Kernel hardening

<Badge type="tip" text="Enhancement" />

**In one line.** The kernel's defaults: one logger per scope, singleton services, an application that binds itself, and request headers and bodies sent as written. [Migration from ra-core-infra](../guides/migrations/from-ra-core-infra) lists what differs from the old package.

## What changed

- **One logger per scope.** `Logger.getInstance({ scope })` returns one instance per scope, so a line logged by `DefaultAuthService` says `[DefaultAuthService]`. `enableDebug` stays one switch for every scope.
- **Services are singletons by default.** `application.service(Class)` and `application.injectable(scope, Class)` bind with `BindingScopes.SINGLETON`.
- **The application binds itself.** `start()` binds the application under `CoreBindings.APPLICATION_INSTANCE`; a manual binding of the same key still wins because it runs later in `bindContext`.
- **Per-call headers reach the wire.** `send({ params: { headers } })` merges those headers over the computed ones.
- **`x-www-form-urlencoded` is really URL-encoded.** `bodyType: RequestBodyTypes.FORM_URL_ENCODED` sends a `URLSearchParams` body. A form body is never sent as multipart under a URL-encoded content type.
- **A refresh that throws synchronously is a failed refresh.** `authRecovery.refreshToken` throwing (rather than rejecting) now calls `onAuthFailure` and surfaces the original 401, like a rejection does.
- **Browser packages compile without Bun's ambient types.** `getRequestHeader` declares `Record<string, string>`; the emitted declarations no longer inline Bun's `Headers`.

## Who is affected

- **Applications on ARDOR.** No action needed; these are the kernel's defaults. A manual binding of `APPLICATION_INSTANCE` or of a service's scope still applies, because it runs later in `bindContext`.
- **A service that must be transient.** Pass a scope explicitly: `application.bind({ key }).toClass(Class).setScope(BindingScopes.TRANSIENT)`.
- **Applications moving from ra-core-infra.** The behaviours above differ from the old package; follow the migration guide.
