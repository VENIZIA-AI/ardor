---
title: assertArdorApplicationBoots says what skipBindings reaches
description: The docstring and the reference page of assertArdorApplicationBoots now state that skipBindings applies to the binding check only, not to the provider step, and a test pins it; no behavior changes.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-27

## assertArdorApplicationBoots says what skipBindings reaches

<Badge type="info" text="Documentation" />

**In one line.** `skipBindings` leaves bindings of the five checked namespaces unresolved. It does not reach the provider step, and the docs now say so. Nothing changes in the code. Planned for 0.4.5.

## What changed

- **The scope.** `skipBindings` names bindings among `services`, `repositories`, `datasources`, `components` and `configurations`. A key outside them, such as `CoreBindings.DEFAULT_AUTH_PROVIDER`, rejects as a skip that matched nothing.
- **The provider step.** The check builds the data, auth and i18n providers the application bound, as `ArdorApplication` does. A bound auth provider that cannot be built fails the check.
- **A test pins it.** The behavior above is under test in `@venizia/ardor`.

## Who is affected

- **An app that signs in.** Nothing to do.
- **A guest app that builds its own react-admin tree and has no sign-in.** Leave `CoreBindings.DEFAULT_AUTH_PROVIDER` unbound, as [Providers](../guides/core-concepts/providers#authentication-no-sign-in) describes, instead of binding a provider the app never uses.
