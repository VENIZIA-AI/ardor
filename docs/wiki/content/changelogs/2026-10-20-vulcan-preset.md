---
title: ARDOR ships a VULCAN preset
description: Scaffold a new monorepo or add an admin application to an existing monorepo with the new ARDOR preset for VULCAN 0.3.0 or newer.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## ARDOR ships a VULCAN preset

<Badge type="tip" text="New Feature" />

**In one line.** Scaffold a new monorepo or add an admin application to an existing monorepo using the `@venizia/ardor` preset with VULCAN 0.3.0 or newer.

## What changed

- **Initialize a monorepo.** `bun x @venizia/vulcan init --preset ardor` creates a monorepo with one ARDOR admin (Vite and React, a `products` resource with list, create and edit pages, the REST data provider and i18n, no sign-in) and runs the application's typecheck, lint and build, then `vulcan doctor`.
- **Add to an existing monorepo.** `bun x @venizia/vulcan add --preset ardor` adds an admin to an existing monorepo (such as one made with the IGNIS preset), asks which backend application to proxy `/api` to, keeps monorepo IGNIS versions, and refuses, naming both versions, when the catalog pins an IGNIS outside the supported range.
- **Preset release and smoke gate.** Releases write the preset with the versions they ship with, and a smoke gate creates an application from the packed preset outside the repository before release.
- **Documentation.** New guide: [Create a project](../guides/get-started/create-a-project).

## Who is affected

- **Existing applications.** Applications already running need no action; nothing in the runtime API changed.
