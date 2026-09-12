---
type: Playbook
title: Build system
description: How ARDOR packages are built, type-checked, tested, sized and version-bumped, and in what order.
resource: Makefile
tags: [build, makefile, typescript, catalog, tsconfig, monorepo]
---

# Build system

ARDOR's build tooling lives at two levels: per-package `scripts` in each `package.json`, and a root `Makefile` that sequences them across the workspace. Everything runs on Bun.

## Per-package scripts

Every package (see [kernel](/packages/kernel.md), [react](/packages/react.md), [admin](/packages/admin.md), [ardor](/packages/ardor.md), [ui-kit](/packages/ui-kit.md)) exposes the same script surface, illustrated by `packages/kernel/package.json`:

- `build` - runs `scripts/build.sh`, the actual compiler invocation.
- `rebuild` - runs `scripts/rebuild.sh`, which type-checks first, then cleans `dist`, then builds. The order matters: type-checking happens *before* `clean` removes the old `dist`, because if a type error surfaced after cleaning, every downstream consumer would see cascading import failures against an empty `dist` instead of one clear type error.
- `clean` - removes `dist` and build artifacts.
- `typecheck` - `tsc --noEmit -p tsconfig.test.json`, checked against the test tsconfig, not the build one.
- `test` - `bun test` with `NODE_ENV=test` and `.env.test`.
- `size` - runs `size-limit` against the built bundle, with peer dependencies (like `axios`, `lodash`, `socket.io-client`) listed in `ignore` since they're externals, not bundled code.
- `force-update` - runs `scripts/force-update.sh`, which bumps this package's own `@venizia/*` peer/dev dependency versions but deliberately skips any dependency that's already pinned through the root catalog.

## tsconfig layering

Packages share config from `@venizia/dev-configs` and layer package-specific tsconfigs on top:

- A common base tsconfig supplies shared compiler options across all packages.
- The build tsconfig extends the base and excludes test files (`__tests__`, `*.test.ts`) - production `dist` output never contains test code.
- `tsconfig.test.json` extends the build config but adds Bun's ambient types (`@types/bun`) so test files can use `bun:test` APIs without the production build seeing those globals.
- Browser-facing libraries set `types: []` in their tsconfig to avoid leaking Node or Bun ambient types into the public `.d.ts` surface consumers see - this keeps a browser package's type declarations free of server-only globals.

Because `typecheck` runs against `tsconfig.test.json`, it validates both source and test code in one pass, while `build` only emits the non-test subset.

## Makefile dependency order

The root `Makefile` build targets (`kernel`, `react`, `admin`, `ardor`, `ui-kit`) are chained as real Make prerequisites, not just run in sequence:

```
build-all: kernel react admin ardor ui-kit
kernel:
react: kernel
admin: react
ardor: admin
ui-kit:
```

This order is mandatory and must never be parallelised: a downstream package type-checks against the **dist** of its dependency, never its `src`. If `react` were built before `kernel`'s `dist` existed (or before it was refreshed), `react`'s typecheck would resolve against a stale or missing `dist`. `ui-kit` has no dependency on the others and can build independently. `make build` is an alias for `make build-all`.

Related repository-wide gates - `typecheck-all`, `test-all`, `size-check`, `surface-check`, `purity`, `layer-check` - are separate Makefile targets, not folded into `build-all`; see [Makefile targets](/reference/makefile-targets.md) for the full list.

## The catalog and refresh-catalog highest

The root `package.json` defines a `workspaces.catalog` map pinning every `@venizia/*` (IGNIS) dependency to one version, shared across all packages via `catalog:` references (visible in kernel's `dependencies`/`devDependencies` above). This is the single source of truth for IGNIS versions.

ARDOR tracks the **highest** published IGNIS line, prerelease included - never `latest`. The `update` Makefile target runs `scripts/refresh-catalog.ts highest`, which queries the npm registry's `dist-tags.highest` for each catalogued `@venizia/*` package and rewrites the catalog entries accordingly, then runs `bun install`. Per-package `force-update` targets exist too, but they intentionally skip any dependency already governed by the catalog - the catalog is refreshed once, at the root, and every package inherits it. Running `make update` therefore always refreshes the catalog first, then lets per-package `force-update highest` handle anything outside the catalog's scope.
