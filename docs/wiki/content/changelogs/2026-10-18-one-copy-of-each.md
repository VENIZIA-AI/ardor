---
title: One copy of each package that carries identity, owned by the application
description: ra-i18n-polyglot is a peer of ardor-admin and ardor, the packages that forward ardor-kernel's required peers declare them too, and the clean install proves one copy of each. An application needs no resolve.dedupe list.
packages: ['@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-18

## One copy of each package that carries identity, owned by the application

<Badge type="warning" text="Behavior Change" />

**In one line.** A package whose second copy breaks the container or a context is a peer of every ARDOR package that uses it, with one range, so the application owns the one copy (issue #88).

```bash
bun add ra-core ra-i18n-polyglot   # the same version of both
```

## What changed

- **`ra-i18n-polyglot` is a peer** (`>=5.15.0`) of `@venizia/ardor-admin` and `@venizia/ardor`, not a dependency. As a dependency it was hidden from the application, and it depends on `ra-core` itself: an application pinning an in-range `ra-core` (`5.15.0`) got a second one nested under it (`ra-core 5.15.0 & 5.15.4`) and could not repair it.
- **Required peers are forwarded.** `@venizia/ardor-react` and `@venizia/ardor-admin` depend on `@venizia/ardor-kernel`, so they now also declare its required peers (`@venizia/ignis-filter`, `-helpers`, `-kernel` and `reflect-metadata`; admin already had filter). `@venizia/ardor` declares `@venizia/ignis-helpers` too. Under an isolated install a dependency otherwise got a copy of its own.
- **The gate.** `scripts/__tests__/peer-dependencies.test.ts` pins three rules (an identity package is never a dependency, a package that imports one declares it with the same range as the others, a package forwards its ARDOR dependencies' required peers). `make clean-install` checks every sandbox, hoisted and isolated, for one version of each identity package in the lock and for one resolved file per peer from every ARDOR package. 64 checks became 80. The rule tests and the gate each went red on the old manifests and on two mutations.

## Who is affected

- **An application on `@venizia/ardor-admin` or `@venizia/ardor` that did not install `ra-i18n-polyglot` itself.** Install it, at the same version as `ra-core` (bun and npm 7+ install peers on their own; a lock made before still resolves). The quickstart's install line has it.
- **An application with a `resolve.dedupe` list, or package-manager `overrides`, for these packages.** It can drop them: each is a peer with one range, and the install check proves one copy.

| File | Package |
|------|---------|
| `package.json` | react, admin, ardor |
