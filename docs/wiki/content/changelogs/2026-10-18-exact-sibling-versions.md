---
title: A package depends on its siblings at the exact version released with it
description: ardor, ardor-admin and ardor-react name the other packages of this repository with workspace:*, which bun writes as the sibling's own version when it packs, so a fresh install of one package can no longer pull a newer sibling. IGNIS and third-party dependencies keep their ranges.
packages: ['@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-18

## A package depends on its siblings at the exact version released with it

<Badge type="danger" text="Bug Fix" />

**In one line.** `@venizia/ardor` X now needs `@venizia/ardor-kernel`, `-react` and `-admin` at exactly X, not at `^X` (issue #85).

```bash
bun add @venizia/ardor@0.1.4-3 @venizia/ardor-kernel@0.1.4-3 @venizia/ardor-react@0.1.4-3 @venizia/ardor-admin@0.1.4-3
```

## What changed

- **The cause.** The release wrote the siblings as caret ranges. `@venizia/ardor` 0.1.4-3 asked for `^0.1.4-3` of the others, and a caret on a prerelease accepts a later prerelease of the same patch. A fresh install of `@venizia/ardor@0.1.4-3` therefore pulled 0.1.4-4 of ardor-admin, ardor-kernel and ardor-react, where `DefaultAuthProvider.login` has another type, and failed with `TS2416`.
- **The fix.** The sibling dependencies of ardor-react, ardor-admin and ardor are `workspace:*` in the repository. `bun pm pack` and `bun publish` write the sibling's own version into the tarball (`workspace:*` in the manifest of 0.1.4-5 becomes `0.1.4-5`), so the version a package names is the one released with it and a release chain cannot leave a range behind. Linking in the repository does not change: a workspace member always links to the sibling's source, however the versions are numbered.
- **A test pins it.** `scripts/__tests__/sibling-versions.test.ts` (in `make test-scripts`, so in CI) fails when a sibling is anything but `workspace:*` in any block, and packs every package to check that the published manifest names each sibling at its exact version and carries no protocol. It was red on the caret ranges.
- **What did not change.** Dependencies outside this repository (IGNIS, ra-core, React) keep their caret and peer ranges.

## Who is affected

- **Anyone who installed `@venizia/ardor` 0.1.4-3 or 0.1.4-4 from `next`.** Pin the siblings to the same version as the umbrella (the command above), or move to the next release, where the umbrella pins them for you.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `package.json` | react, admin, ardor |
