---
type: Reference
title: Makefile targets
description: Every make target, its prerequisites, and what it does (generated).
resource: Makefile
tags: [reference, make, build]
generated:
  by: process:okf-gen
---

> Generated from source - do not edit; run `make okf-gen`. Playbook: [build system](/process/build-system.md).

**84 targets.**

| Target | Depends on | Description |
|---|---|---|
| `make admin` | `react` | Rebuild one package, after its dependencies. |
| `make agent-setup` | `vulcan-sync` | Alias of vulcan-sync. |
| `make ardor` | `admin` | Rebuild one package, after its dependencies. |
| `make atlas-releases` | - | Print the release table atlas computes from the tags. |
| `make atlas-smoke` | - | Gate: VULCAN's atlas serves this checkout over MCP. |
| `make atlas-symbols` | - | Print the symbols atlas reads from the built .d.ts. Needs a build. |
| `make build` | `build-all` | Rebuilds all packages (alias for 'build-all'). |
| `make build-all` | `kernel react admin ardor` | Rebuilds all packages in dependency order. |
| `make catalog-check` | - | Gate: every catalogued dep is referenced as "catalog:", none drifted. |
| `make changelogs-migrate` | - | Write the packages: list into changelog entries that declare none. |
| `make clean` | - | Clean build artifacts from all packages. |
| `make clean-install` | - | Load every published sub-path from packed tarballs in an empty project. |
| `make clean-install-admin` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make clean-install-ardor` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make clean-install-kernel` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make clean-install-react` | - | Load one package's sub-paths from a clean install. Needs a build. |
| `make copies-check` | - | Gate: every @venizia/* package resolves to one version (no stable IGNIS copy next to a prerelease). |
| `make cycles-check` | - | Gate: no import cycle in any dist. Needs a build. |
| `make docs` | - | Build the wiki (VitePress) with the sidebar gate. |
| `make fmt-files` | - | Format those files with bun fmt (part of lint-fix). |
| `make fmt-scripts` | - | Format scripts/ with bun fmt (part of lint-fix; lint-scripts checks it). |
| `make gates` | - | The Test job of the release workflow, locally: links, copies, build, lint, test, scripts, purity, catalog, preset smoke. Run without -j. |
| `make help` | - | Show this help message (a bare 'make' does the same). |
| `make install` | - | Install all dependencies with bun. |
| `make kernel` | - | Rebuild one package, after its dependencies. |
| `make knowledge-symbols-check` | - | Fail when a symbol a concept names is gone or its signature changed |
| `make layer-check` | - | Gate: no package imports a layer above it. |
| `make links-check` | - | Gate: every ARDOR sibling resolves to the workspace, not to the registry. |
| `make lint` | `lint-packages` | lint-<pkg> for every package. |
| `make lint-admin` | - | oxlint + ESLint (naming-convention) + bun fmt check of one package. |
| `make lint-all` | `lint-packages lint-wiki lint-scripts lint-files` | lint-packages, lint-wiki, lint-scripts and lint-files. |
| `make lint-ardor` | - | oxlint + ESLint (naming-convention) + bun fmt check of one package. |
| `make lint-files` | - | Format check of the files outside the projects: the root package.json, workflows, .agents, .configs, the presets, the examples. |
| `make lint-fix` | `lint-fix-packages lint-fix-wiki fmt-files fmt-scripts` | lint-fix-<pkg> for every package. |
| `make lint-fix-admin` | - | Apply oxlint --fix, ESLint --fix and bun fmt to one package. |
| `make lint-fix-ardor` | - | Apply oxlint --fix, ESLint --fix and bun fmt to one package. |
| `make lint-fix-kernel` | - | Apply oxlint --fix, ESLint --fix and bun fmt to one package. |
| `make lint-fix-packages` | `lint-fix-kernel lint-fix-react lint-fix-admin lint-fix-ardor` | lint-fix-<pkg> for every package. |
| `make lint-fix-react` | - | Apply oxlint --fix, ESLint --fix and bun fmt to one package. |
| `make lint-fix-wiki` | - | Apply the lint fixes and bun fmt to docs/wiki. |
| `make lint-kernel` | - | oxlint + ESLint (naming-convention) + bun fmt check of one package. |
| `make lint-packages` | `lint-kernel lint-react lint-admin lint-ardor` | lint-<pkg> for every package. |
| `make lint-react` | - | oxlint + ESLint (naming-convention) + bun fmt check of one package. |
| `make lint-scripts` | - | Format check + bun check type-check of scripts/. |
| `make lint-wiki` | - | Lint docs/wiki and check its format. |
| `make okf-check` | - | Check the knowledge bundle against OKF v0.2. |
| `make okf-check-strict` | - | Gate: okf-check plus links, style, coverage, freshness. |
| `make okf-coverage` | - | Report bundle coverage against the source inventory. |
| `make okf-gen` | - | Regenerate source-derived reference content. |
| `make okf-viz` | - | Build the offline knowledge-graph explorer. |
| `make preset-build` | - | - |
| `make preset-smoke` | - | - |
| `make purity` | - | Gate: every entry claimed browser-pure has no node builtin or global. |
| `make purity-admin` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-ardor` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-kernel` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-react` | - | Gate: one package's browser-pure entries. Needs a build. |
| `make purity-test` | - | Run the purity gate's regression tests (the shared engine on ARDOR's fixtures). |
| `make react` | `kernel` | Rebuild one package, after its dependencies. |
| `make release` | - | Dispatch the release workflow once for the four packages (a prerelease from develop, a stable from main), e.g. ARGS="--yes". |
| `make release-plan` | - | Print the release plan (dependency order), dispatch nothing. |
| `make setup-hooks` | - | Configure git to use .githooks directory. |
| `make size-check` | - | Gate: every bundle within its size-limit budget. Needs a build. |
| `make split-report` | - | Report hub files, stray types, missing barrels, long files, cycles (informational). |
| `make surface-check` | - | Gate: the public surface equals the snapshot. |
| `make surface-gen` | - | Snapshot every exported symbol into .agents/knowledge/reference/public-surface.md. |
| `make test` | `test-all` | test-<pkg> for every package; one with no suite says so and passes. |
| `make test-admin` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-all` | `test-kernel test-react test-admin test-ardor` | test-<pkg> for every package; one with no suite says so and passes. |
| `make test-ardor` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-kernel` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-react` | - | Run one package's suite with BUN_TEST_FLAGS. Needs a build. |
| `make test-scripts` | - | Run the repository gate scripts' own regression tests. |
| `make typecheck` | `typecheck-all` | Type-check every package (tests included) without emitting. |
| `make typecheck-all` | - | Type-check every package (tests included) without emitting. |
| `make typecheck-examples` | - | Type-check every example against the built packages. Needs a build. |
| `make update-admin` | - | Force update one package's dependencies from NPM. |
| `make update-ardor` | - | Force update one package's dependencies from NPM. |
| `make update-kernel` | - | Force update one package's dependencies from NPM. |
| `make update-react` | - | Force update one package's dependencies from NPM. |
| `make vulcan-doctor` | - | Gate: the project follows VULCAN (config, layout, rules, make, adapters, style). |
| `make vulcan-sync` | - | Write your agent adapters: CLAUDE.md, .claude/settings.json, skill links. |
| `make wiki-anchors-check` | - | Gate: every wiki '#fragment' link resolves. Needs a build (make docs). |
| `make wiki-links-check` | - | Gate: every source path the wiki and knowledge bundle name exists. |
