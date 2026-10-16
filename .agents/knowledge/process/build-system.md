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

The packages (see [kernel](/packages/kernel.md), [react](/packages/react.md), [admin](/packages/admin.md) and [ardor](/packages/ardor.md)) share a script surface, illustrated by `packages/kernel/package.json`. All four define `build`, `rebuild`, `clean`, `force-update`, `prepublishOnly` (which runs `rebuild`) and the lint scripts (`lint`, `lint:fix`). The rest vary: `ardor` has no `test` script - `test-all` runs kernel, react and admin only.

- `build` - runs `scripts/build.sh`, the actual compiler invocation.
- `rebuild` - runs `scripts/rebuild.sh`, which type-checks first, then cleans `dist`, then builds. The order matters: type-checking happens *before* `clean` removes the old `dist`, because if a type error surfaced after cleaning, every downstream consumer would see cascading import failures against an empty `dist` instead of one clear type error.
- `clean` - removes `dist` and build artifacts.
- `typecheck` - `tsc --noEmit -p tsconfig.test.json`, checked against the test tsconfig, not the build one. `ardor` has no `tsconfig.test.json`, so its `typecheck` (and its `rebuild.sh`) use `tsconfig.json` instead.
- `test` - `bun test` with `--env-file=.env.test` and `--preload ./src/__tests__/setup.ts`. The preload lives in the script, not in a `bunfig.toml`, so a bare `bun test` inside a package skips the setup and fails.
- `size` - runs `size-limit` against the built bundle. Its `ignore` list excludes the peers (like `socket.io-client`) and the runtime dependencies (like `lodash`) from the measurement, so the budget measures only the package's own code.
- `force-update` - runs `scripts/force-update.sh`, which bumps this package's own `@venizia/*` peer/dev dependency versions but deliberately skips any dependency that's already pinned through the root catalog.

## tsconfig layering

Packages share config from `@venizia/dev-configs` and layer package-specific tsconfigs on top:

- A common base tsconfig supplies shared compiler options across all packages.
- The build tsconfig extends the base and excludes test files (`__tests__`, `*.test.ts`) - production `dist` output never contains test code.
- `tsconfig.test.json` extends the build config but adds Bun's ambient types (`@types/bun`) so test files can use `bun:test` APIs without the production build seeing those globals.
- Each package tsconfig restates `experimentalDecorators`, `emitDecoratorMetadata` and `useDefineForClassFields: false` although the base sets them: Bun (1.4.2) ignores an `extends` that names a package (`@venizia/dev-configs/...`), even one level deep, so `bun test` and `bun run` see none of the preset. `tsc` follows the chain, so typecheck and build stay green either way. Without the decorator lines `bun test` compiles TC39 decorators and every `@provide` and `@inject` test fails; without `useDefineForClassFields` the tests define class fields while `dist` assigns them.
- Browser-facing libraries set `types: []` in their tsconfig to avoid leaking Node or Bun ambient types into the public `.d.ts` surface consumers see - this keeps a browser package's type declarations free of server-only globals.

Because `typecheck` runs against `tsconfig.test.json`, it validates both source and test code in one pass, while `build` only emits the non-test subset.

## Lint presets

Lint runs three tools, each with its config in the project's `.configs/` folder and passed explicitly with `-c` (no tool finds that folder on its own): `oxlint.config.mts`, `oxfmt.config.mts` and `eslint.config.mjs`. Every preset comes from `@venizia/dev-configs/linters` and `/formatters`; ARDOR keeps no lint rule of its own.

- **oxlint** runs every rule but one. `react` and `admin` use `ReactOxlintConfigs.create()`: the base preset plus the React, hooks and accessibility rules, `consistent-type-imports` and the secure-context ban on `crypto.randomUUID`. It is strict - no rule is relaxed for a UI, `no-floating-promises` holds and `exhaustive-deps` is an error. `kernel`, `ardor` and the examples use the base `oxlintConfigs` plus `NoRestrictedPropertiesRule.build()` for the same secure-context ban. Type-aware rules run through `oxlint-tsgolint`, which reads the project-root `tsconfig.json`.
- **ESLint** runs `@typescript-eslint/naming-convention` only, which oxlint has no port of: `namingConventionConfigs`, or `reactNamingConventionConfigs` (PascalCase components) in `react` and `admin`. `admin` turns it off for `src/common/locales/**`, whose keys are react-admin wire keys. Its config is plain JavaScript (`.mjs`) on purpose: ESLint 10 loads a TypeScript config only through `jiti`, and a `.mjs` one needs no extra dependency.
- **oxfmt** formats with `oxfmtConfigs` and two ARDOR overrides: `arrowParens: 'always'` and `bracketSameLine: true`. `scripts/` has only this config; `make lint-scripts` runs it.

The `lint` script runs oxlint with `--deny-warnings`, so a warning fails it as an error would (B-02: zero errors and zero warnings). An ignore pattern written inside `.configs/` resolves against `.configs/` and matches nothing; `dist` and `node_modules` are skipped through `.gitignore`.

## Makefile dependency order

The root `Makefile` build targets (`kernel`, `react`, `admin`, `ardor`) are chained as real Make prerequisites, not just run in sequence:

```
build-all: kernel react admin ardor
kernel:
react: kernel
admin: react
ardor: admin
```

This order is mandatory and must never be parallelised: a downstream package type-checks against the **dist** of its dependency, never its `src`. If `react` were built before `kernel`'s `dist` existed (or before it was refreshed), `react`'s typecheck would resolve against a stale or missing `dist`. `make build` is an alias for `make build-all`.

Related repository-wide gates - `typecheck-all`, `test-all`, `size-check`, `surface-check`, `purity`, `layer-check`, `cycles-check` - are separate Makefile targets, not folded into `build-all`; see [Makefile targets](/reference/makefile-targets.md) for the full list.

## The catalog and refresh-catalog highest

The root `package.json` defines a `workspaces.catalog` map pinning every `@venizia/*` (IGNIS) dependency to one version, shared across all packages via `catalog:` references (visible in kernel's `dependencies`/`devDependencies` above). This is the single source of truth for IGNIS versions.

ARDOR tracks the **highest** published IGNIS line, prerelease included - never `latest`. The `update` Makefile target runs `scripts/refresh-catalog.ts highest`, which queries the npm registry's `dist-tags.highest` for each catalogued `@venizia/*` package and rewrites the catalog entries accordingly, then runs `bun install`. Per-package `force-update` targets exist too, but they intentionally skip any dependency already governed by the catalog - the catalog is refreshed once, at the root, and every package inherits it. Running `make update` therefore always refreshes the catalog first, then lets per-package `force-update highest` handle anything outside the catalog's scope.
