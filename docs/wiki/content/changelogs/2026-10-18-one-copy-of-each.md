---
title: One copy of each package that carries identity, owned by the application
description: ra-i18n-polyglot is a peer of ardor-admin and ardor, so an application needs no resolve.dedupe list.
packages: ['@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-18

## One copy of each package that carries identity, owned by the application

<Badge type="warning" text="Behavior Change" />

**In one line.** A package whose second copy breaks the container or a context is a peer of every ARDOR package that uses it, with one range, so the application owns the one copy.

```bash
bun add ra-core ra-i18n-polyglot   # the same version of both
```

## What changed

- **`ra-i18n-polyglot` is a peer** (`>=5.15.0`) of `@venizia/ardor-admin` and `@venizia/ardor`, not a dependency. As a dependency it was hidden from the application, and it depends on `ra-core` itself: an application pinning an in-range `ra-core` (`5.15.0`) got a second one nested under it (`ra-core 5.15.0 & 5.15.4`) and could not repair it.
- **Required peers are forwarded.** `@venizia/ardor-react` and `@venizia/ardor-admin` depend on `@venizia/ardor-kernel`, so they now also declare its required peers (`@venizia/ignis-filter`, `-helpers`, `-kernel` and `reflect-metadata`). `@venizia/ardor` declares `@venizia/ignis-helpers` too. Under an isolated install a dependency otherwise got a copy of its own.

## Who is affected

- **An application on `@venizia/ardor-admin` or `@venizia/ardor` that did not install `ra-i18n-polyglot` itself.** Install it, at the same version as `ra-core` (bun and npm 7+ install peers on their own; a lock made before still resolves). The quickstart's install line has it.
- **An application with a `resolve.dedupe` list, or package-manager `overrides`, for these packages.** It can drop them: each is a peer with one range.
