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
| [`kernel`](/packages/kernel.md) | `@venizia/ardor-kernel` | ARDOR kernel - the isomorphic core of the ARDOR frontend framework: application base on IGNIS inversion, service and CRUD bases, request/auth constants, binding keys, logger, network fetchers and socket client. |
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
| `presets/` | The VULCAN preset templates, a sibling of `packages/`: `presets/app/{preset.json,files/}` for the app kind and `presets/lib/{preset.json,files/}` for the library kind. The release writes the built copy into the published package (`packages/ardor/dist/vulcan-preset/app`), so the package's `vulcan` field and `--preset ardor` do not change |
| `examples/` | Consumer apps (`5-mins-qs`, `ipc-data-provider`, `vert-admin`) on `workspace:*` deps, built against the packages' `dist` - gated by `bun scripts/examples.ts` (`check`, `build`), not by make |
| `docs/wiki/` | VitePress site `@venizia/ardor-docs` - `content/` pages, `site/` theme, `scripts/` gates (sidebar, snippet compile) |
| `docs/migration/` | A pointer to the wiki migration guide, kept because the npm deprecation of `@minimaltech/ra-core-infra` links to it |
| `scripts/` | Repository gates: `check-catalog.ts`, `purity/`, `layer-boundaries.ts`, `module-cycles.ts`, `split-report.ts`, `wiki-source-links.ts`, `wiki-anchors.ts`, `refresh-catalog.ts`, `clean-install/`. Atlas: `atlas-smoke.ts` (VULCAN's atlas computes releases and reads symbols itself - see [Atlas MCP server](/reference/atlas-mcp.md)). Release: `release.ts`, `release-local.ts`, `release-scope.ts` (see [Release and publish](/process/release-publish.md)) |
| `.agents/` | `rules.md` (ARDOR's layer over the VULCAN base rules, and the minimap shape the session digest prints), this knowledge bundle, `okf/` (the `providers` and `hooks-and-services` renderers behind two generated reference pages), `vulcan.manifest.json` (written by `make vulcan-sync`, committed so another project's atlas can read ARDOR) |
| `.configs/` | `vulcan.config.mts` - the one VULCAN config (every project of the repository keeps its own `.configs/` with `lints/`, `formatters/` and, where it builds, `builders/`): rule slot, project hooks, knowledge roots, atlas packages |
| `.mcp.json` (gitignored) | Registers the `atlas` MCP server (VULCAN's atlas run against this checkout); `vulcan sync` writes it on each machine - see [Atlas MCP server](/reference/atlas-mcp.md) |
| `.githooks/` | `pre-commit` runs `make lint-all` and `bun scripts/examples.ts check`; enabled by `make setup-hooks` |
| `.github/workflows/` | `ci.yml` (gates, build, tests, lint), `package-release.yml` (dispatch per package), `deploy-docs.yml` |
| `Makefile`, `make/` | Every entry point; one job per `make/*.mk` file, `make/project.mk` is the per-package include; a bare `make` lists them |

## Dependency versions

The root `workspaces.catalog` owns every shared range. `@venizia/*` entries track the **highest**
published IGNIS line (prerelease included), refreshed by `bun scripts/refresh-catalog.ts highest`;
`make catalog-check` fails a package that pins a catalogued dependency by hand.

Related: [Build, run, test](/overview/build-run-test.md), [Design decisions](/overview/design-decisions.md).
