---
type: Concept
title: Monorepo layout
description: What lives where in the ARDOR repository - packages, examples, docs, scripts, the agent bundle - and the build order between them.
resource: Makefile
tags: [overview, layout, packages]
---

# Monorepo layout

One Bun workspace. `packages/*` are the published units, `examples/*` are consumer apps inside the
same workspace, `docs/wiki` is the human-facing site, `scripts/` holds the repository gates and
release tooling, `.agents/` holds what an agent reads.

## Packages

Built in dependency order - a downstream package type-checks against the `dist` of its dependency,
never its `src` (rule B-05): `kernel -> react -> admin -> ardor`.

<!-- okf:generated:packages-table start -->
| Package | npm name | Description |
|---|---|---|
| [`admin`](/packages/admin.md) | `@venizia/ardor-admin` | ARDOR react-admin adapter - the REST data provider, auth provider and i18n provider wired through IGNIS inversion, the ArdorApplication root component, the translate and notify hooks, and the English and Vietnamese message bundles. |
| [`ardor`](/packages/ardor.md) | `@venizia/ardor` | ARDOR - frontend application framework for the VENIZIA family. |
| [`kernel`](/packages/kernel.md) | `@venizia/ardor-kernel` | ARDOR kernel - the isomorphic core of the ARDOR frontend framework: application base on IGNIS inversion, service and provider bases, request/auth constants, binding keys, logger, the network request service, runtime config and the HTTP repository (from IGNIS). |
| [`react`](/packages/react.md) | `@venizia/ardor-react` | ARDOR React bindings - the application context, the injectable and logger hooks that read it, typed Redux hook factories, and the framework-agnostic UI hooks (debounce, autosave, confirm, clipboard, sizer, window dimensions). |
<!-- okf:generated:packages-table end -->

Every runtime package is ESM only (`dist/index.js` + `dist/index.d.ts`), emitted by
`.configs/builders/tsconfig.build.json` with `types: []` so a browser library never inlines Bun's ambient
types; the root `tsconfig.json`, which covers the tests, adds them back. Each package builds,
lints and formats through a one-line `Makefile` that includes `make/project.mk`.

## Top level

| Path | What it is |
|---|---|
| `packages/` | The five packages above |
| `presets/` | The VULCAN preset templates, a sibling of `packages/`: `presets/app/{preset.json,files/}` for the app kind and `presets/lib/{preset.json,files/}` for the library kind. The release writes the built copy into the published package (`packages/ardor/dist/presets/app`), so the package's `vulcan` field and `--preset ardor` do not change |
| `examples/` | Consumer apps (`5-mins-qs`, `ipc-data-provider`, `vert-admin`) on `workspace:*` deps, built against the packages' `dist`; no gate builds them - their format is checked by `make lint-files`, and each keeps its own `compile` and `typecheck` scripts for use by hand |
| `docs/wiki/` | VitePress site `@venizia/ardor-docs` - `content/` pages, `site/` theme, `scripts/` gates (sidebar, snippet compile) |
| `docs/migration/` | A pointer to the wiki migration guide, kept because the npm deprecation of `@minimaltech/ra-core-infra` links to it |
| `scripts/` | Root tooling grouped by purpose, with a table in `scripts/README.md`: `release/` (`release.ts`, `release-plan.ts`, `release-chain.ts`, `release-verify.ts`, `release-scope.ts`, `release-version.ts`, `release-wait.ts`, `release-gates.ts` - see [Release and publish](/process/release-publish.md)), `preset/` (`vulcan-preset.ts`, `preset-smoke.ts`), `checks/` (`layer-boundaries.ts`, `atlas-smoke.ts`, `purity/manifest.ts`, `clean-install/`; the catalog, cycles, split-report and purity gates are `devz check` commands of `@venizia/dev-configs`; VULCAN's atlas computes releases and reads symbols itself - see [Atlas MCP server](/reference/atlas-mcp.md)), `build/` (`force-update.sh`, `refresh-catalog.ts`); each group keeps its tests in its own `__tests__/` |
| `.agents/` | `rules.md` (ARDOR's layer over the VULCAN base rules, and the minimap shape the session digest prints), this knowledge bundle, `okf/` (the `providers` and `hooks-and-services` renderers behind two generated reference pages), `vulcan.manifest.json` (written by `make vulcan-sync`, committed so another project's atlas can read ARDOR) |
| `.configs/` | `vulcan.config.mts` - the one VULCAN config (every project of the repository keeps its own `.configs/` with `lints/` and, where it builds, `builders/`; an example and the presets also keep `formatters/`, until `devz` reads the root `bunfig.toml`): rule slot, project hooks, knowledge roots, atlas packages |
| `.mcp.json` (gitignored) | Registers the `atlas` MCP server (VULCAN's atlas run against this checkout); `vulcan sync` writes it on each machine - see [Atlas MCP server](/reference/atlas-mcp.md) |
| `.githooks/` | `pre-commit` runs `make lint-all`; enabled by `make setup-hooks` |
| `.github/workflows/` | `ci.yml` (gates, build, tests, lint), `package-release.yml` (one dispatch releases the packages it names), `deploy-docs.yml` |
| `bunfig.toml` | Bun's config for commands run at the root: only `telemetry = false`. Bun reads it only from the directory a command runs in, and no `minimumReleaseAge`: it would refuse the young versions that the floors at the latest need |
| `Makefile`, `make/` | Every entry point; one job per `make/*.mk` file, `make/project.mk` is the per-package include; a bare `make` lists them |

## Dependency versions

The root `workspaces.catalog` owns every shared range. `@venizia/*` entries track the **highest**
published IGNIS line (prerelease included), refreshed by `bun scripts/build/refresh-catalog.ts highest`;
`make catalog-check` fails a package that pins a catalogued dependency by hand.

Related: [Build, run, test](/overview/build-run-test.md), [Design decisions](/overview/design-decisions.md).
