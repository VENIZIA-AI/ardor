---
type: Playbook
title: Build, run, test
description: How to build, lint, test, and gate ARDOR packages using the repo's make targets in the correct dependency order.
resource: Makefile
tags: [build, test, lint, make, ci, gates]
---

ARDOR is built and verified entirely through `make` targets backed by Bun. Never use npm, yarn or pnpm, and never invoke `tsc` through `npx`/`bunx` for compilation - use the repo's own scripts. See [Build system](/process/build-system.md) and [Makefile targets](/reference/makefile-targets.md) for the full command reference.

## Build order is dependency order, not parallel

`make build` (alias `make build-all`) runs targets in a fixed sequence: **kernel -> react -> admin -> ardor -> ui-kit**. This mirrors the package dependency graph - [Kernel](/packages/kernel.md) has no ARDOR dependency, [React](/packages/react.md) depends on kernel, [Admin](/packages/admin.md) depends on react (and transitively kernel), [ARDOR](/packages/ardor.md) (the umbrella entry point) depends on all three, and [UI Kit](/packages/ui-kit.md) builds standalone.

The critical rule: **a downstream package type-checks and resolves its siblings against `dist/`, never `src/`**. There is no source-to-source project reference wiring the packages together at build time. This means the sequence above must never be parallelised - if you build `admin` before `react` has emitted a fresh `dist/`, admin type-checks against stale or missing output. Individual targets exist too (`make kernel`, `make react`, `make admin`, `make ardor`, `make ui-kit`), and `react`, `admin`, `ardor` each declare their upstream target as a prerequisite in the Makefile, so running `make admin` alone still rebuilds `react` and `kernel` first.

The same dist-not-src rule applies to tests: `bun test` for react/admin resolves `@venizia/ardor-kernel` (and react, for admin) through the package's `import` export condition, landing on `dist/index.js`. A test run against stale dist silently tests old behavior. Always rebuild upstream packages before trusting a downstream test run.

## rebuild.sh type-checks before it cleans

Each package's `make <pkg>` target runs `bun run --filter "<pkg>" rebuild`, which invokes `rebuild.sh`. That script **type-checks first**, and only after type-checking succeeds does it clean `dist/` and run `build.sh` to re-emit output. This ordering means a type error stops the process before the old `dist/` is destroyed - you are never left with an empty `dist/` after a failed build. Confirm success by checking for the `DONE` line in the output. Running `sh ./scripts/build.sh` directly, bypassing `rebuild.sh`, fails with `tsc-alias: not found` - always go through `bun run build` or `make`.

## Test, lint, typecheck targets

- `make test` (alias `make test-all`) runs `test-kernel`, `test-react`, `test-admin` in that order, each via `bun run test` inside the package directory. There is no `test-ardor` or `test-ui-kit` target.
- `make lint` (alias `make lint-packages`) lints everything under `packages/*`; per-package variants (`lint-kernel`, `lint-react`, `lint-admin`, `lint-ardor`, `lint-ui-kit`) exist for targeted runs. Zero lint errors and zero warnings is the bar - see [Coding style](/conventions/coding-style.md) and [Testing conventions](/conventions/testing-conventions.md).
- `make typecheck` (alias `typecheck-all`) type-checks every package without emitting.
- `make docs` builds the VitePress wiki, including its sidebar gate.

## Repository gates

Beyond build/test/lint, the Makefile exposes gate scripts that must pass for a change to be considered done:

- `make catalog-check` - guards dependency versions against the root catalog (the mechanism [Design decisions](/overview/design-decisions.md) explains for tracking the highest published IGNIS line).
- `make purity` - probes kernel/react/admin `dist/` for Node builtins and `ra-core` leaks, enforcing that ARDOR ships browser-pure output. Run `make purity-test` to test the purity probe's own regression suite.
- `make layer-check` - enforces package layering boundaries (kernel must not depend upward on react/admin, etc).
- `make surface-check` - compares the built public surface (read from `.d.ts` files) against the committed snapshot; run `make surface-gen` after `make build-all` to regenerate that snapshot when the surface intentionally changes. See [Public surface](/reference/public-surface.md).
- `make size-check` - measures brotli-compressed bundle size against budgets for kernel, react, admin and ardor, run after a build.
- `make okf-check` - validates the agent knowledge bundle (the Open Knowledge Format bundle this document is part of).
- `make wiki-links-check` - validates wiki-to-source links.

These gates are what CI and reviewers hold a change to; running `make build-all` green does not by itself mean the change is mergeable.

## Practical sequence for a change

1. Make the source edit.
2. `make <affected-pkg>` (and its downstream packages, in order) to rebuild through `dist/`.
3. `make test` (or the specific `test-<pkg>` targets) - remember these test `dist/`, so step 2 must have succeeded first.
4. `make lint` for the touched packages.
5. Run the relevant gates (`catalog-check`, `purity`, `layer-check`, `surface-check`, `size-check`, `okf-check`) depending on what changed - a dependency bump needs `catalog-check`, a public API change needs `surface-check`, a docs/bundle change needs `okf-check`.

For the wider workflow this build cycle sits inside, see [Onboarding](/overview/onboarding.md) and [Monorepo layout](/overview/monorepo-layout.md).
