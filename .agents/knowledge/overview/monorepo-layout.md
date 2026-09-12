---
type: Concept
title: Monorepo layout
description: What lives where in the ARDOR repository - packages, docs, scripts, the agent bundle - and the build order between them.
resource: Makefile
tags: [overview, layout, packages]
---

# Monorepo layout

One Bun workspace. `packages/*` are the published units, `docs/wiki` is the human-facing site,
`scripts/` holds the repository gates, `.agents/` holds what an agent reads.

## Packages

Built in dependency order - a downstream package type-checks against the `dist` of its dependency,
never its `src` (rule B-05): `kernel -> react -> admin -> ardor`, with `ui-kit` independent.

<!-- okf:generated:packages-table start -->
| Package | npm name | Description |
|---|---|---|
| [`admin`](/packages/admin.md) | `@venizia/ardor-admin` | ARDOR react-admin adapter - the REST data provider, auth provider and i18n provider wired through IGNIS inversion, the ArdorApplication root component, the translate and notify hooks, and the English and Vietnamese message bundles. |
| [`ardor`](/packages/ardor.md) | `@venizia/ardor` | ARDOR - frontend application framework for the VENIZIA family. |
| [`kernel`](/packages/kernel.md) | `@venizia/ardor-kernel` | ARDOR kernel - the isomorphic core of the ARDOR frontend framework: application base on IGNIS inversion, service and CRUD bases, request/auth constants, binding keys, logger, network fetchers and socket client. |
| [`react`](/packages/react.md) | `@venizia/ardor-react` | ARDOR React bindings - the application context, the injectable and logger hooks that read it, typed Redux hook factories, and the framework-agnostic UI hooks (debounce, autosave, confirm, clipboard, sizer, window dimensions). |
| [`ui-kit`](/packages/ui-kit.md) | `@venizia/ardor-ui-kit` | ARDOR - UI Kit |
<!-- okf:generated:packages-table end -->

Every runtime package is ESM only (`dist/index.js` + `dist/index.d.ts`), compiled with
`types: []` so a browser library never inlines Bun's ambient types; tests type-check through
`tsconfig.test.json`, which adds them back.

## Top level

| Path | What it is |
|---|---|
| `packages/` | The five packages above |
| `docs/wiki/` | VitePress site `@venizia/ardor-docs` - `content/` pages, `site/` theme, `scripts/` gates (sidebar, snippet compile) |
| `docs/migration/` | The ra-core-infra migration guide and the roadmap; deleted when the roadmap closes |
| `scripts/` | Repository gates: `public-surface.ts`, `check-catalog.ts`, `purity/`, `layer-boundaries.ts`, `module-cycles.ts`, `split-report.ts`, `wiki-source-links.ts`, `refresh-catalog.ts`, the ra-core-infra codemod |
| `.agents/` | `rules.md`, this knowledge bundle, `knowledge-tools/`, `plugin/` (agent setup, skills, session hook) |
| `.github/workflows/` | `ci.yml` (gates, build, tests, lint), `package-release.yml` (dispatch per package), `deploy-docs.yml` |
| `Makefile` | Every entry point; `make help` lists them |

## Dependency versions

The root `workspaces.catalog` owns every shared range. `@venizia/*` entries track the **highest**
published IGNIS line (prerelease included), refreshed by `bun scripts/refresh-catalog.ts highest`;
`make catalog-check` fails a package that pins a catalogued dependency by hand.

Related: [Build, run, test](/overview/build-run-test.md), [Design decisions](/overview/design-decisions.md).
