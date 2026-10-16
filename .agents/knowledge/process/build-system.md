---
type: Playbook
title: Build system
description: How ARDOR packages are built, type-checked, tested, sized and version-bumped, and in what order.
resource: Makefile
tags: [build, makefile, typescript, catalog, tsconfig, monorepo]
---

# Build system

ARDOR's build tooling follows the IGNIS layout and lives at two levels: each package has a one-line `Makefile` that includes `make/project.mk` (its build, lint and format targets), and the root `Makefile` includes `make/{build,knowledge,release,lint,test,help}.mk`, which sequence them across the workspace from one `PACKAGES` list. Every per-package root target (`<pkg>`, `update-<pkg>`, `lint-<pkg>`, `fmt-<pkg>`, `test-<pkg>`, `purity-<pkg>`, `clean-install-<pkg>`) is generated from that list. Everything runs on Bun; a bare `make` prints `make help`.

## Per-package targets (`make/project.mk`)

The packages (see [kernel](/packages/kernel.md), [react](/packages/react.md), [admin](/packages/admin.md) and [ardor](/packages/ardor.md)) share one target surface: `make -C packages/<pkg> <target>`, or the root targets that call it. A package's `package.json` keeps only `force-update` and `prepublishOnly` (`make rebuild`). Every tool runs from the package's `node_modules/.bin` by absolute path, so no recipe depends on `PATH`.

- `build` - `tsc -p .configs/tsconfig.build.json`, then `tsc-alias -p tsconfig.json --resolve-full-paths`. tsc-alias reads the root tsconfig: pointed at the `.configs/` one it resolves `paths` against `.configs/` and rewrites nothing. `--resolve-full-paths` turns `./base` into `./base/index.js`, which Node's ESM loader requires.
- `rebuild` - `typecheck`, then `clean`, then `build`. The order matters: type-checking happens *before* `clean` removes the old `dist`, because if a type error surfaced after cleaning, every downstream consumer would see cascading import failures against an empty `dist` instead of one clear type error.
- `clean` - removes `dist` and every `.tsbuildinfo`, `.configs/*.tsbuildinfo` included: a stale one makes tsc believe it is up to date and emit nothing behind a `DONE` line.
- `typecheck` - `tsc --noEmit` over `tsconfig.json` (src and tests), then over the build program, which drops the Bun types, so a Bun global in `src` fails there and not in a consumer.
- `lint` / `fmt` - see [Lint presets](#lint-presets).
- `size` - runs `size-limit` against the built bundle. Its `ignore` list excludes the peers (like `socket.io-client`) and the runtime dependencies (like `lodash`) from the measurement, so the budget measures only the package's own code.
- `force-update` (a `package.json` script) - runs `scripts/force-update.sh`, which bumps this package's own `@venizia/*` peer/dev dependency versions but deliberately skips any dependency that's already pinned through the root catalog.

Tests are a root target: `make test-<pkg>` (`make/test.mk`) runs `bun test --env-file=.env.test --preload ./src/__tests__/setup.ts $(BUN_TEST_FLAGS)` inside the package. There is no `bunfig.toml` and no package `test` script, so a bare `bun test` inside a package skips the setup and fails. `ardor` has no suite.

## tsconfig layering

Packages share config from `@venizia/dev-configs` and layer package-specific tsconfigs on top:

- `kernel` and `ardor` extend `@venizia/dev-configs/tsconfig.browser.json` (bundler resolution, ESNext modules, the DOM lib, `types: []`); `react` and `admin` extend `tsconfig.react.json`, which adds `jsx: react-jsx`. Each package overrides `target` and `lib` to ESNext, since the presets stop at ES2025.
- The package's root `tsconfig.json` is the typecheck program: it covers `src` and the tests and adds Bun's ambient types (`types: ["bun"]`; not in `ardor`, which has no tests). Bun, `oxlint-tsgolint` and editors read it.
- `.configs/tsconfig.build.json` is the emit program: it extends `../tsconfig.json`, sets `types: []` again and excludes `__tests__`, so `dist` never contains test code or Bun types.
- Each package tsconfig restates `experimentalDecorators`, `emitDecoratorMetadata` and `useDefineForClassFields: false` although the base sets them: Bun (1.4.2) ignores an `extends` that names a package (`@venizia/dev-configs/...`), even one level deep, so `bun test` and `bun run` see none of the preset. `tsc` follows the chain, so typecheck and build stay green either way. Without the decorator lines `bun test` compiles TC39 decorators and every `@provide` and `@inject` test fails; without `useDefineForClassFields` the tests define class fields while `dist` assigns them.
- The browser presets set `types: []` to avoid leaking Node or Bun ambient types into the public `.d.ts` surface consumers see - this keeps a browser package's type declarations free of server-only globals.

Because `typecheck` runs both programs, it validates source and test code, while `build` only emits the non-test subset.

## Lint presets

Lint runs three tools, each with its config in the project's `.configs/` folder and passed explicitly with `-c` (no tool finds that folder on its own): `oxlint.config.mts`, `oxfmt.config.mts` and `eslint.config.mjs`. Every preset comes from `@venizia/dev-configs/linters` and `/formatters`; ARDOR keeps no lint rule of its own.

- **oxlint** runs every rule but one. `react` and `admin` use `ReactOxlintConfigs.create()`: the base preset plus the React, hooks and accessibility rules, `consistent-type-imports` and the secure-context ban on `crypto.randomUUID`. It is strict - no rule is relaxed for a UI, `no-floating-promises` holds and `exhaustive-deps` is an error. `kernel`, `ardor` and the examples use `BrowserOxlintConfigs.create()`: the base `oxlintConfigs` plus the same secure-context ban. `ReactOxlintConfigs` builds on it. Type-aware rules run through `oxlint-tsgolint`, which reads the project-root `tsconfig.json`.
- **ESLint** runs `@typescript-eslint/naming-convention` only, which oxlint has no port of: `namingConventionConfigs`, or `reactNamingConventionConfigs` (PascalCase components) in `react` and `admin`. `admin` turns it off for `src/common/locales/**`, whose keys are react-admin wire keys. Its config is plain JavaScript (`.mjs`) on purpose: ESLint 10 loads a TypeScript config only through `jiti`, and a `.mjs` one needs no extra dependency.
- **oxfmt** formats with `browserOxfmtConfigs`: `oxfmtConfigs` plus `arrowParens: 'always'` and `bracketSameLine: true`, the style ARDOR asked IGNIS to ship (IGNIS #163). `scripts/` has only this config; `make lint-scripts` runs it.

`make lint-<pkg>` runs oxlint with `--deny-warnings`, so a warning fails it as an error would (B-02: zero errors and zero warnings); `make fmt-<pkg>` applies the fixes. `make lint-all` covers the packages, `docs/wiki` (`lint-wiki`) and `scripts/` (`lint-scripts`). The examples are not driven by make: they keep their own `lint` and `typecheck` scripts, and `bun scripts/examples.ts check` runs them (pre-commit), `lint` and `build` in CI. An ignore pattern written inside `.configs/` resolves against `.configs/` and matches nothing; `dist` and `node_modules` are skipped through `.gitignore`.

## Makefile dependency order

The build targets in `make/build.mk` (`kernel`, `react`, `admin`, `ardor`) are chained as real Make prerequisites, not just run in sequence, and each one runs the package's own `rebuild`:

```
PACKAGES := kernel react admin ardor
build-all: $(PACKAGES)
react: kernel
admin: react
ardor: admin
$(PACKAGES):          # make -C packages/<pkg> rebuild
```

This order is mandatory and must never be parallelised: a downstream package type-checks against the **dist** of its dependency, never its `src`. If `react` were built before `kernel`'s `dist` existed (or before it was refreshed), `react`'s typecheck would resolve against a stale or missing `dist`. `make build` is an alias for `make build-all`.

Related repository-wide gates - `typecheck-all`, `test-all`, `size-check`, `surface-check`, `purity`, `layer-check`, `cycles-check` - are separate Makefile targets, not folded into `build-all`; see [Makefile targets](/reference/makefile-targets.md) for the full list.

## The catalog and refresh-catalog highest

The root `package.json` defines a `workspaces.catalog` map pinning every `@venizia/*` (IGNIS) dependency to one version, shared across all packages via `catalog:` references (visible in kernel's `dependencies`/`devDependencies` above). This is the single source of truth for IGNIS versions.

ARDOR tracks the **highest** published IGNIS line, prerelease included - never `latest`. The `update` Makefile target runs `scripts/refresh-catalog.ts highest`, which queries the npm registry's `dist-tags.highest` for each catalogued `@venizia/*` package and rewrites the catalog entries accordingly, then runs `bun install`. Per-package `force-update` targets exist too, but they intentionally skip any dependency already governed by the catalog - the catalog is refreshed once, at the root, and every package inherits it. Running `make update` therefore always refreshes the catalog first, then lets per-package `force-update highest` handle anything outside the catalog's scope.
