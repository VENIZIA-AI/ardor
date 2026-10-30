---
title: A package depends on its siblings at the exact version released with it
description: ardor, ardor-admin and ardor-react name the other ARDOR packages at the exact version released with them, so a fresh install cannot pull a newer sibling.
packages: ['@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-18

## A package depends on its siblings at the exact version released with it

<Badge type="info" text="Bug Fix" />

**In one line.** `@venizia/ardor` X now needs `@venizia/ardor-kernel`, `-react` and `-admin` at exactly X, not at `^X`.

## What changed

- **The cause.** The siblings were caret ranges. A caret on a prerelease accepts a later prerelease of the same patch, so a fresh install of `@venizia/ardor@0.1.4-3` pulled 0.1.4-4 of the other packages, where `DefaultAuthProvider.login` has another type, and failed with `TS2416`.
- **The fix.** Each published package names its ARDOR siblings at the version released with it.
- **What did not change.** Dependencies outside ARDOR (IGNIS, ra-core, React) keep their caret and peer ranges.

## Who is affected

- **Anyone who installed `@venizia/ardor` 0.1.4-3 or 0.1.4-4 from `next`.** Pin the siblings to the same version as the umbrella, or move to the next release, where the umbrella pins them for you:

  ```bash
  bun add @venizia/ardor@0.1.4-3 @venizia/ardor-kernel@0.1.4-3 @venizia/ardor-react@0.1.4-3 @venizia/ardor-admin@0.1.4-3
  ```

- **Everyone else.** No action needed.
