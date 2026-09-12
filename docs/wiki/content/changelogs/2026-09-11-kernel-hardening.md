---
title: One logger per scope, singleton services, and a kernel that owns its headers
description: Logger.getInstance returns one instance per scope; service() and injectable() bind singletons; the application binds itself; per-call headers and x-www-form-urlencoded bodies are honoured.
---

# Changelog - 2026-09-11

## Kernel hardening

<Badge type="tip" text="Enhancement" /> <Badge type="info" text="Bug Fix" /> <Badge type="warning" text="Behavior Change" />

**In one line.** Four behaviors every consumer worked around by hand are now the framework's defaults, and two silent data-layer bugs are fixed.

## What changed

- **One logger per scope.** `Logger.getInstance({ scope })` returns one instance per scope, so a line logged by `DefaultAuthService` says `[DefaultAuthService]`. It used to return the first instance ever created, whatever scope was asked for. `enableDebug` stays one switch for every scope.
- **Services are singletons by default.** `application.service(Class)` and `application.injectable(scope, Class)` bind with `BindingScopes.SINGLETON`. Every known consumer set this by hand on every binding.
- **The application binds itself.** `start()` binds the application under `CoreBindings.APPLICATION_INSTANCE`; a manual binding of the same key still wins because it runs later in `bindContext`.
- **Per-call headers reach the wire.** `send({ params: { headers } })` merges those headers over the computed ones. They were accepted by the type and dropped.
- **`x-www-form-urlencoded` is really URL-encoded.** `bodyType: RequestBodyTypes.FORM_URL_ENCODED` sends a `URLSearchParams` body. It used to send multipart `FormData` under a URL-encoded content type.
- **A refresh that throws synchronously is a failed refresh.** `authRecovery.refreshToken` throwing (rather than rejecting) now calls `onAuthFailure` and surfaces the original 401, like a rejection does.
- **Browser packages compile without Bun's ambient types.** `getRequestHeader` declares `Record<string, string>`; the emitted declarations no longer inline Bun's `Headers`.

## Who is affected

- **Applications that bind `APPLICATION_INSTANCE` or set `SINGLETON` by hand.** No action needed; the manual binding still applies.
- **Code that relied on a transient `service()` binding.** Pass a scope explicitly: `application.bind({ key }).toClass(Class).setScope(BindingScopes.TRANSIENT)`.
- **Code that sent `x-www-form-urlencoded` bodies.** The wire format is now what the content type says; a server that accepted the old multipart body by accident may need checking.
