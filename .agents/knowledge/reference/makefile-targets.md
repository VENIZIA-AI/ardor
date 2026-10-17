---
type: Reference
title: Makefile targets
description: Every make target, its prerequisites, and what it does (generated).
resource: Makefile
tags: [reference, make, build]
---

> Generated from source - do not edit; run `make okf-gen`. Playbook: [build system](/process/build-system.md).

**78 targets.**

| Target | Depends on | Description |
|---|---|---|
| `make admin` | `react` | Rebuild one package, after its dependencies. |
| `make agent-setup` | `vulcan-sync` | Alias of vulcan-sync. |
| `make all` | `build` | Rebuilds all packages (alias for 'build-all'). |
| `make ardor` | `admin` | Rebuild one package, after its dependencies. |
| `make atlas-smoke` | - | Gate: the pinned IGNIS atlas serves this checkout over MCP. |
| `make build` | `build-all` | Rebuilds all packages (alias for 'build-all'). |
| `make build-all` | `kernel react admin ardor` | Rebuilds all packages in dependency order. |
| `make catalog-check` | - | Gate: every catalogued dep is referenced as "catalog:", none drifted. |
| `make clean` | - | Clean build artifacts from all packages. |
| `make clean-install` | - | Load every published sub-path from packed tarballs in an empty project. |
| `make clean-install-admin` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make clean-install-ardor` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make clean-install-kernel` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make clean-install-react` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make cycles-check` | - | Gate: no import cycle in any dist. Needs a build. |
| `make docs` | - | Build the wiki (VitePress) with the sidebar gate. |
| `make fmt` | `fmt-packages` | fmt-<pkg> for every package. |
| `make fmt-admin` | - | Apply oxlint --fix, ESLint --fix and oxfmt to one package. |
| `make fmt-ardor` | - | Apply oxlint --fix, ESLint --fix and oxfmt to one package. |
| `make fmt-kernel` | - | Apply oxlint --fix, ESLint --fix and oxfmt to one package. |
| `make fmt-packages` | `fmt-kernel fmt-react fmt-admin fmt-ardor` | fmt-<pkg> for every package. |
| `make fmt-react` | - | Apply oxlint --fix, ESLint --fix and oxfmt to one package. |
| `make fmt-wiki` | - | Apply the lint fixes and oxfmt to docs/wiki. |
| `make help` | - | Show this help message (a bare 'make' does the same). |
| `make install` | - | Install all dependencies with bun. |
| `make kernel` | - | Rebuild one package, after its dependencies. |
| `make layer-check` | - | Gate: no package imports a layer above it. |
| `make lint` | `lint-packages` | lint-<pkg> for every package. |
| `make lint-admin` | - | oxlint + ESLint (naming-convention) + oxfmt check of one package. |
| `make lint-all` | `lint-packages lint-wiki lint-scripts` | lint-packages, lint-wiki and lint-scripts. |
| `make lint-ardor` | - | oxlint + ESLint (naming-convention) + oxfmt check of one package. |
| `make lint-kernel` | - | oxlint + ESLint (naming-convention) + oxfmt check of one package. |
| `make lint-packages` | `lint-kernel lint-react lint-admin lint-ardor` | lint-<pkg> for every package. |
| `make lint-react` | - | oxlint + ESLint (naming-convention) + oxfmt check of one package. |
| `make lint-scripts` | - | Format check + tsc type-check of scripts/. |
| `make lint-wiki` | - | Lint docs/wiki and check its format. |
| `make okf-check` | - | Gate: frontmatter, links, coverage, freshness. |
| `make okf-check-strict` | - | Same as okf-check in ARDOR (VULCAN's name for the full check). |
| `make okf-coverage` | - | Report bundle coverage against the source inventory. |
| `make okf-gen` | - | Regenerate source-derived reference content. |
| `make okf-viz` | - | Build the offline knowledge-graph explorer. |
| `make purity` | - | Gate: every entry claimed browser-pure has no node builtin or global. |
| `make purity-admin` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-ardor` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-kernel` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-react` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-test` | - | Run the purity probe's own regression tests. |
| `make react` | `kernel` | Rebuild one package, after its dependencies. |
| `make release` | - | Dispatch the release workflow per package, e.g. ARGS="--yes". |
| `make release-plan` | - | Print the release plan (dependency order), dispatch nothing. |
| `make releases-check` | - | Gate: the release table matches the release commits and the changelogs. |
| `make releases-gen` | - | Regenerate .agents/knowledge/reference/releases.json for the Atlas version and changes tools. |
| `make setup-hooks` | - | Configure git to use .githooks directory. |
| `make size-check` | - | Gate: every bundle within its size-limit budget. Needs a build. |
| `make split-report` | - | Report hub files, stray types, missing barrels, long files, cycles (informational). |
| `make surface-check` | - | Gate: the public surface equals the snapshot. |
| `make surface-gen` | - | Snapshot every exported symbol into .agents/knowledge/reference/public-surface.md. |
| `make symbols-check` | - | Gate: the symbol table matches the built .d.ts. |
| `make symbols-gen` | - | Regenerate .agents/knowledge/reference/symbols.json for the Atlas symbol tool. |
| `make test` | `test-all` | test-<pkg> for every package with a suite. |
| `make test-admin` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-all` | `test-kernel test-react test-admin` | test-<pkg> for every package with a suite. |
| `make test-ardor` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-kernel` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-react` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-scripts` | - | Run the repository gate scripts' own regression tests. |
| `make typecheck` | `typecheck-all` | Type-check every package (tests included) without emitting. |
| `make typecheck-all` | - | Type-check every package (tests included) without emitting. |
| `make update` | - | Move every @venizia/* catalog entry to the highest published version. |
| `make update-admin` | - | Force update one package's dependencies from NPM. |
| `make update-all` | `update` | Move every @venizia/* catalog entry to the highest published version. |
| `make update-ardor` | - | Force update one package's dependencies from NPM. |
| `make update-kernel` | - | Force update one package's dependencies from NPM. |
| `make update-react` | - | Force update one package's dependencies from NPM. |
| `make vulcan-doctor` | - | Gate: the project follows VULCAN (config, layout, rules, make, adapters, style). |
| `make vulcan-sync` | - | Write your agent adapters: CLAUDE.md, .claude/settings.json, skill links. |
| `make wiki-anchors-check` | - | Gate: every wiki '#fragment' link resolves. Needs a build (make docs). |
| `make wiki-links-check` | - | Gate: every source path the wiki and knowledge bundle name exists. |
