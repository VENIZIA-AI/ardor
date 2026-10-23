---
type: Playbook
title: Build system
description: How ARDOR packages are built, type-checked, tested, sized and version-bumped, and in what order.
resource: Makefile
tags: [build, makefile, typescript, catalog, tsconfig, monorepo]
---

# Build system

ARDOR's build tooling follows the IGNIS layout and lives at two levels: each package has a one-line `Makefile` that includes `make/project.mk` (its build, lint, lint-fix, test and clean targets), and the root `Makefile` includes `make/{build,knowledge,release,lint,test,help}.mk`, which sequence them across the workspace from one `PACKAGES` list. Every per-package root target (`<pkg>`, `update-<pkg>`, `lint-<pkg>`, `lint-fix-<pkg>`, `test-<pkg>`, `purity-<pkg>`, `clean-install-<pkg>`) is generated from that list. Everything runs on Bun; a bare `make` prints `make help`.

## Per-package targets (`make/project.mk`)

The packages (see [kernel](/packages/kernel.md), [react](/packages/react.md), [admin](/packages/admin.md) and [ardor](/packages/ardor.md)) share one target surface (`build`, `typecheck`, `lint`, `lint-fix`, `test` and `clean`, plus `rebuild` and `size`; see [App script standard](/conventions/app-script-standard.md)): `make -C packages/<pkg> <target>`, or the root targets that call it. A package's `package.json` keeps only `force-update` and `prepublishOnly` (`make rebuild`). Every tool runs from the package's `node_modules/.bin` by absolute path, so no recipe depends on `PATH`.

- `build` - `tsc -p .configs/builders/tsconfig.build.json`, then `tsc-alias -p tsconfig.json --resolve-full-paths`. tsc-alias reads the root tsconfig: pointed at the `.configs/builders/` one it resolves `paths` against that folder and rewrites nothing. `--resolve-full-paths` turns `./base` into `./base/index.js`, which Node's ESM loader requires.
- `rebuild` - `typecheck`, then `clean`, then `build`. The order matters: type-checking happens *before* `clean` removes the old `dist`, because if a type error surfaced after cleaning, every downstream consumer would see cascading import failures against an empty `dist` instead of one clear type error.
- `clean` - removes `dist` and every `.tsbuildinfo`, `.configs/builders/*.tsbuildinfo` included: a stale one makes tsc believe it is up to date and emit nothing behind a `DONE` line.
- `typecheck` - `bun check --no-pretty` over `tsconfig.json` (src and tests), then over the build program, which drops the Bun types, so a Bun global in `src` fails there and not in a consumer.
- `lint` / `lint-fix` - see [Lint presets](#lint-presets).
- `test` - `NODE_ENV=test bun test --preload ./src/__tests__/setup.ts $(BUN_TEST_FLAGS)` inside the package. A package with no suite sets `HAS_TESTS := no` (`ardor`): its `make test` says so and passes.
- `size` - runs `size-limit` against the built bundle. Its `ignore` list excludes the peers (like `socket.io-client`) and the runtime dependencies (like `lodash`) from the measurement, so the budget measures only the package's own code.
- `force-update` (a `package.json` script) - runs the one root `scripts/force-update.sh` (a package carries no copy), which bumps this package's own `@venizia/*` peer/dev dependency versions but deliberately skips any dependency that's already pinned through the root catalog.

The root `make test-<pkg>` (`make/test.mk`) calls the package's `make test`. There is no `bunfig.toml` and no package `test` script, so a bare `bun test` inside a package skips the setup and fails.

## tsconfig layering

Packages share config from `@venizia/dev-configs` and layer package-specific tsconfigs on top:

- `kernel` and `ardor` extend `@venizia/dev-configs/tsconfig.browser.json` (bundler resolution, ESNext modules, the DOM lib, `types: []`); `react` and `admin` extend `tsconfig.react.json`, which adds `jsx: react-jsx`. Each package overrides `target` and `lib` to ESNext, since the presets stop at ES2025.
- The package's root `tsconfig.json` is the typecheck program: it covers `src` and the tests and adds Bun's ambient types (`types: ["bun"]`; not in `ardor`, which has no tests). Bun, `oxlint-tsgolint` and editors read it.
- `.configs/builders/tsconfig.build.json` is the emit program: it extends `../../tsconfig.json`, sets `types: []` again and excludes `__tests__`, so `dist` never contains test code or Bun types.
- Each package tsconfig restates `experimentalDecorators`, `emitDecoratorMetadata` and `useDefineForClassFields: false` although the base sets them: Bun ignores an `extends` that names a package (`@venizia/dev-configs/...`), even one level deep, so `bun test` and `bun run` see none of the preset. `tsc` and `bun check` follow the chain, so typecheck and build stay green either way: `bun check` reports the preset-only errors (`strictNullChecks`, `noUnusedLocals`, `noImplicitOverride`) exactly as tsc does. Without the decorator lines `bun test` compiles TC39 decorators and every `@provide` and `@inject` test fails; without `useDefineForClassFields` the tests define class fields while `dist` assigns them.
- The four packages set `verbatimModuleSyntax: true` (ESM only: a type import is written `import type`), and `ardor` and `react` set `noUncheckedIndexedAccess: true`. No package, example or preset overrides `target` or `lib`: they inherit ES2025 (plus DOM and DOM.Iterable from the browser base) from `@venizia/dev-configs`. The app and lib presets are `noEmit` programs.
- The three examples extend the same presets (`5-mins-qs` and `vert-admin` `tsconfig.react.json`, `ipc-data-provider` `tsconfig.browser.json`) and restate the same three options; each adds its own `types` (`vite/client` or `bun`), `noEmit` and `paths`.
- The browser presets set `types: []` to avoid leaking Node or Bun ambient types into the public `.d.ts` surface consumers see - this keeps a browser package's type declarations free of server-only globals.

Because `typecheck` runs both programs, it validates source and test code, while `build` only emits the non-test subset.

## Lint presets

Lint runs three tools, each with its config under the project's `.configs/` and passed explicitly with `-c` (no tool finds that folder on its own): `.configs/lints/oxlint.config.mts`, `.configs/lints/eslint.config.mjs` and `.configs/formatters/oxfmt.config.mts`; the build configs (`tsconfig.build.json`, a Vite config) are in `.configs/builders/`, and `.configs/vulcan.config.mts` stays at `.configs/`. `tsconfig.json` stays at the package root. A pattern a tool must skip goes in `.configs/lints/.ignore` or `.configs/formatters/.ignore` (the shared `scripts/lint.sh` reads them), because the `ignorePatterns` of a config kept in `.configs/` do not apply. Every preset comes from `@venizia/dev-configs/linters` and `/formatters`; ARDOR keeps no lint rule of its own.

- **oxlint** runs every rule but one. `react` and `admin` use `ReactOxlintConfigs.create()`: the base preset plus the React, hooks and accessibility rules, `consistent-type-imports` and the secure-context ban on `crypto.randomUUID`. It is strict - no rule is relaxed for a UI, `no-floating-promises` holds and `exhaustive-deps` is an error. `kernel`, `ardor` and the examples use `BrowserOxlintConfigs.create()`: the base `oxlintConfigs` plus the same secure-context ban. `ReactOxlintConfigs` builds on it. Type-aware rules run through `oxlint-tsgolint`, which reads the project-root `tsconfig.json`.
- **ESLint** runs `@typescript-eslint/naming-convention` only, which oxlint has no port of: `namingConventionConfigs`, or `reactNamingConventionConfigs` (PascalCase components) in `react` and `admin`. `admin` turns it off for `src/common/locales/**`, whose keys are react-admin wire keys. Its config is plain JavaScript (`.mjs`) on purpose: ESLint 10 loads a TypeScript config only through `jiti`, and a `.mjs` one needs no extra dependency.
- **Formatting** runs through `bun fmt` with the oxfmt config: `bun fmt --no-script --config .configs/formatters/oxfmt.config.mts` (`BUN_FMT_FLAGS` in `make/project.mk` and `make/lint.mk`), always with the glob `"**/*.{ts,mts,tsx,js,mjs}"` because a bare `bun fmt` also formats md and json. The config file stays the one decider: `browserOxfmtConfigs` is `oxfmtConfigs` plus `arrowParens: 'always'` and `bracketSameLine: true`, the style ARDOR asked IGNIS to ship (IGNIS #163). `bun fmt` picks its flavor from `package.json`: while `oxfmt` is in the devDependencies it formats in oxfmt style, and without it in Prettier style - so `oxfmt` stays listed, in the root, the packages and the wiki, and the catalog. Measured against `oxfmt --check` on every package and the wiki, the number of differing files is 0, and a planted error fails both. `scripts/` has only this config; `make lint-scripts` runs it from the root. The three examples and the presets still format through `devz lint`, which runs oxfmt itself (`@venizia/dev-configs` 0.3.6, `cli/lint.js`), so they keep their config and `oxfmt` until a `devz` formats with `bun fmt`.

`make lint-<pkg>` runs oxlint with `--deny-warnings`, so a warning fails it as an error would (B-02: zero errors and zero warnings); `make lint-fix-<pkg>` applies the fixes. `make lint-all` covers the packages, `docs/wiki` (`lint-wiki`) and `scripts/` (`lint-scripts`). The examples are not driven by make: they keep their own `lint` and `typecheck` scripts, and `bun scripts/examples.ts check` runs them (pre-commit), `lint` and `build` in CI. An ignore pattern written inside `.configs/` resolves against `.configs/` and matches nothing; `dist` and `node_modules` are skipped through `.gitignore`.

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

## One copy of each: peers

A package whose second copy breaks DI or context identity (React, `react-dom`, `react-redux`, `react-router-dom`, Redux Toolkit, TanStack Query, `ra-core`, `ra-i18n-polyglot`, `reflect-metadata`, every `@venizia/ignis-*`) is a **peer** of every ARDOR package that uses it, never a dependency, with one range across them. The application then owns the single copy and needs no `resolve.dedupe` list. Three rules, pinned by `scripts/__tests__/peer-dependencies.test.ts`:

- An identity package is never in `dependencies`. `ra-i18n-polyglot` was: it depends on `ra-core` itself, so an application pinning an in-range `ra-core` (`5.15.0`) got a second one nested under it (`ra-core 5.15.0 & 5.15.4`), and could not repair it.
- A package that imports one declares it as a peer, and every package names it with the same range.
- A package forwards the required peers of the ARDOR packages it depends on (`ardor-react` and `ardor-admin` forward `ardor-kernel`'s `ignis-filter`, `ignis-helpers`, `ignis-kernel` and `reflect-metadata`; the umbrella forwards all of them). Without it an isolated install gives the dependency a copy of its own.

`make clean-install` proves it per sandbox, hoisted and isolated: `findDuplicateCopies` reads the lock (one version of each identity package and of the ARDOR packages, nested keys included), and `scripts/clean-install/peer-identity.ts` runs inside the sandbox and checks that every ARDOR package resolves each peer to the same file as the application. Mutations that went red: an `ardor-react` that stops forwarding `ignis-helpers`, an `ardor-admin` that carries a pinned `ra-core` dependency.
