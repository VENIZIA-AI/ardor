---
type: Playbook
title: Build, run, test
description: How to build, lint, test, and gate ARDOR packages using the repo's make targets in the correct dependency order.
resource: Makefile
tags: [build, test, lint, make, ci, gates]
---

ARDOR is built and verified entirely through `make` targets backed by Bun. Never use npm, yarn or pnpm, and never invoke `tsc` through `npx`/`bunx` for compilation - use the repo's own scripts. See [Build system](/process/build-system.md) and [Makefile targets](/reference/makefile-targets.md) for the full command reference.

## Build order is dependency order, not parallel

`make build` (alias `make build-all`) runs targets in a fixed sequence: **kernel -> react -> admin -> ardor**. This mirrors the package dependency graph - [Kernel](/packages/kernel.md) has no ARDOR dependency, [React](/packages/react.md) depends on kernel, [Admin](/packages/admin.md) depends on react (and transitively kernel), [ARDOR](/packages/ardor.md) (the umbrella entry point) depends on all three.

The critical rule: **a downstream package type-checks and resolves its siblings against `dist/`, never `src/`**. There is no source-to-source project reference wiring the packages together at build time. This means the sequence above must never be parallelised - if you build `admin` before `react` has emitted a fresh `dist/`, admin type-checks against stale or missing output. Individual targets exist too (`make kernel`, `make react`, `make admin`, `make ardor`), and `react`, `admin`, `ardor` each declare their upstream target as a prerequisite in the Makefile, so running `make admin` alone still rebuilds `react` and `kernel` first.

The same dist-not-src rule applies to tests: `bun test` for react/admin resolves `@venizia/ardor-kernel` (and react, for admin) through the package's `import` export condition, landing on `dist/index.js`. A test run against stale dist silently tests old behavior. Always rebuild upstream packages before trusting a downstream test run.

## `make <pkg>` type-checks before it cleans

Each package's `make <pkg>` target runs `make -C packages/<pkg> rebuild` (`make/project.mk`). That target **type-checks first**, and only after type-checking succeeds does it clean `dist/` and run `build` to re-emit output. This ordering means a type error stops the process before the old `dist/` is destroyed - you are never left with an empty `dist/` after a failed build. Confirm success by checking for the `DONE` line in the output. Always build through make: the recipe runs `tsc-alias` after `tsc`, and a bare `tsc` leaves every `@/` import unrewritten in `dist`.

## Test, lint, typecheck targets

- `make test` (alias `make test-all`) runs `test-kernel`, `test-react`, `test-admin` in that order, each running `bun test` with `.env.test` and the setup preload inside the package directory. `make test-ardor` says there is no suite and passes.
- `make lint` runs `lint-packages` (`lint-kernel`, `lint-react`, `lint-admin`, `lint-ardor`); `make lint-all` adds `lint-wiki` and `lint-scripts`, and `make fmt-<pkg>` applies the fixes. The examples run through `bun scripts/examples.ts check` (lint and typecheck) and `build`. Zero lint errors and zero warnings is the bar - see [Coding style](/conventions/coding-style.md) and [Testing conventions](/conventions/testing-conventions.md).
- `make typecheck` (alias `typecheck-all`) type-checks every package without emitting.
- `make docs` builds the VitePress wiki, including its sidebar gate.

## Repository gates

Beyond build/test/lint, the Makefile exposes gate scripts that must pass for a change to be considered done:

- `make catalog-check` - guards dependency versions against the root catalog (the mechanism [Design decisions](/overview/design-decisions.md) explains for tracking the highest published IGNIS line).
- `make purity` - bundles every runtime entry in the `exports` maps of kernel, react, admin and ardor for the browser and fails on a Node builtin import or an unguarded Node global such as `process.`, enforcing that ARDOR ships browser-pure output. The row set is derived from `exports`, so a new sub-path is claimed pure automatically; for what may be exempted, see [Gotchas](/conventions/gotchas.md). Run `make purity-test` to test the purity probe's own regression suite.
- `make layer-check` - enforces package layering boundaries on the built output: the kernel's `dist` may not import React, Redux or react-admin packages (`ra-core`, `ra-i18n-polyglot`), and react's `dist` may not import `ra-core`, `react-admin` or `ra-i18n-polyglot`. Only kernel and react are scanned. This, not `make purity`, is where an `ra-core` leak into kernel or react is caught.
- `make cycles-check` - fails on an import cycle in any built `dist`; bun turns every member of a cycle into a lazy initializer, so a barrel `export *` over one can publish an undefined export.
- `make surface-check` - compares the built public surface (read from `.d.ts` files) against the committed snapshot; run `make surface-gen` after `make build-all` to regenerate that snapshot when the surface intentionally changes. See [Public surface](/reference/public-surface.md).
- `make size-check` - measures brotli-compressed bundle size against budgets for kernel, react, admin and ardor, run after a build.
- `make okf-check-strict` - validates the agent knowledge bundle (the Open Knowledge Format bundle this document is part of) and adds the house rules: links, style, coverage, freshness and a `packages:` list on every changelog entry. This is the CI gate; `make okf-check` alone checks OKF v0.2 conformance only.
- `make wiki-links-check` - validates wiki-to-source links.
- `make atlas-symbols` and `make atlas-releases` - print what atlas reads: the symbols from the built `.d.ts` (build first) and the release table computed from the git tags. There is nothing to regenerate or commit, so no freshness gate; CI still checks out with `fetch-depth: 0` so the tags exist. `make atlas-smoke` is a manual smoke test, not a CI gate: it starts the atlas MCP server against this repository (`vulcan x atlas mcp`, or the local CLI named by `ARDOR_ATLAS_CLI`) and checks that it answers.

These gates are what CI and reviewers hold a change to; running `make build-all` green does not by itself mean the change is mergeable.

## Practical sequence for a change

1. Make the source edit.
2. `make <affected-pkg>` (and its downstream packages, in order) to rebuild through `dist/`.
3. `make test` (or the specific `test-<pkg>` targets) - remember these test `dist/`, so step 2 must have succeeded first.
4. `make lint-all`, and `bun scripts/examples.ts check` when an example or a public API changed.
5. Run the relevant gates (`catalog-check`, `purity`, `layer-check`, `cycles-check`, `surface-check`, `size-check`, `okf-check-strict`) depending on what changed - a dependency bump needs `catalog-check`, a public API change needs `surface-check`, a docs/bundle change needs `okf-check-strict`.

For the wider workflow this build cycle sits inside, see [Onboarding](/overview/onboarding.md) and [Monorepo layout](/overview/monorepo-layout.md).
