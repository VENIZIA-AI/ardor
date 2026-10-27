---
title: The repository gates run from @venizia/dev-configs, and the kernel re-exports its utility types from IGNIS
description: The browser-purity, import-cycle, split-report and catalog gates of this repository are now devz check commands of @venizia/dev-configs 0.4.4, and the kernel's ten utility types are re-exported from @venizia/ignis-helpers/common with the same names.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-27

## The repository gates run from @venizia/dev-configs, and the kernel re-exports its utility types from IGNIS

<Badge type="info" text="Enhancement" />

**In one line.** ARDOR kept its own copies of four repository gates and ten utility types that IGNIS also had. Both now come from IGNIS, so a fix lands once. Nothing changes for an app. Available in 0.4.4.

## What changed

- **Four gates are `devz check` commands.** `devz check purity`, `module-cycles`, `split-report` and `catalog` of `@venizia/dev-configs` 0.4.4 replace the scripts this repository carried. It keeps its data: `scripts/checks/purity/manifest.ts` (the claims) and the catalog globs in `make catalog-check`. `make purity`, `purity-<package>`, `cycles-check`, `split-report` and `catalog-check` print exactly what they printed before, on the same commit.
- **The probes still fail on bad input.** The tests that feed the engines a leaking entry, an import cycle, a drifted range and a preset peer now call the shared engines, so a gate that stopped detecting would fail here.
- **The kernel re-exports ten types.** `AnyObject`, `AnyType`, `TConstValue`, `TNumberConstValue`, `TPrettify`, `TStringConstValue`, `ValueOf`, `ValueOptional`, `ValueOptionalExcept` and `ValueOrPromise` are declared once in `@venizia/ignis-helpers/common` and re-exported by `@venizia/ardor-kernel` and `@venizia/ardor` by the same names. The kernel's bundle size and the public surface are unchanged.

## Who is affected

- **An app.** Nothing to do; import the types from `@venizia/ardor` as before. They now resolve to the IGNIS declarations, whose definitions are identical to the ones the kernel had.
- **A contributor.** The scripts `check-catalog.ts`, `module-cycles.ts`, `split-report.ts` and the purity engine are gone; run the `make` targets, or `bun x --no-install devz check --help`.
