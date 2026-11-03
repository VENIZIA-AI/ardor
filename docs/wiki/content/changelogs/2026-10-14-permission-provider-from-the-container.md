---
title: canAccess reaches an AuthProvider subclass without a fourth super argument
description: DefaultAuthProvider reads the bound permission provider from the container itself, so a subclass with its own constructor gets canAccess without forwarding it.
packages: ['@venizia/ardor-admin']
---

# Changelog - 2026-10-14

## canAccess reaches an AuthProvider subclass without a fourth super argument

<Badge type="info" text="Bug Fix" />

**In one line.** When an application binds `CoreBindings.PERMISSION_PROVIDER`, every `DefaultAuthProvider` subclass now exposes `canAccess`, whatever arguments it passes to `super`.

## What changed

- **The bug.** `DefaultAuthProvider` took the permission provider only as its fourth constructor argument. A subclass with its own constructor that passed three arguments to `super` ended up without `canAccess`, and react-admin then allowed everything with no warning.
- **The fix.** The provider now also reads the bound permission provider from the container. A permission provider passed to `super` still wins over the bound one.
- **Nothing bound, nothing changes.** Without a bound permission provider there is still no `canAccess`, and react-admin allows everything.

## Who is affected

- **Applications with an `AuthProvider` subclass and a bound permission provider.** Their checks now run. Remove any workaround that injected the provider only to forward it to `super`; it keeps working if left in place.
- **Applications that bind no permission provider.** No action needed.

See [Features and permissions](../references/permission).
