---
title: Repository tooling - ardor tests in CI, a Node-only entry in the build, the shared wiki theme under test
description: The umbrella package has tests that run in CI, its Node-only Vite entry has its own TypeScript program and a place in the purity and clean-install gates, and the shared wiki theme and the home numbers are checked by tests.
packages: []
---

# Changelog - 2026-10-26

## Repository tooling - ardor tests in CI, a Node-only entry in the build, the shared wiki theme under test

<Badge type="tip" text="Enhancement" />

**In one line.** Five changes to how this repository is built and checked. None changes how a published package behaves, so an application has nothing to do; a contributor should read the first two points. Available in 0.4.4.

## What changed

- **CI runs the umbrella's tests.** `make test-ardor` is a step of the build job, after the admin tests. The `ardor` package had none before; it has 62 now, for `@venizia/ardor/vite`.
- **A package can have a second TypeScript program.** `make/project.mk` has `EXTRA_BUILD_TSCONFIGS`: configs that are type-checked and emitted after the main program. `packages/ardor` uses it for `src/vite`, which runs in Node and needs Node's types, while the main program keeps Bun's and the browser's. It also has `TEST_PATHS`, which says where `bun test` looks; `ardor` sets `./src` because its `dist` holds the preset's own test files, which only run inside a generated app.
- **The Node-only entry has a defined place in the gates.** The purity claim of `@venizia/ardor` lists its browser entries (`.` and `./repository`), a test pins that exactly `dist/vite/index.js` is published without a claim, and the clean-install check loads `./vite` in Bun and in Node ESM with `@venizia/ignis-boot` granted.
- **The shared wiki theme is under test.** The folder `docs/wiki/site/.vitepress/theme/shared` is a byte-identical copy of the one in VULCAN. `scripts/checks/__tests__/wiki-shared.test.ts` (in `make test-scripts`) hashes it against its `SHARED.json` and checks that the VitePress pieces it overrides still exist. `make lint-wiki` covers the folder like any other file, and `.gitattributes` keeps git from converting a byte of it.
- **The numbers on the home page are counted.** `scripts/checks/__tests__/wiki-intro-counts.test.ts` counts the packages, the examples, the test files and the Node builtin imports of the browser packages from the repository, checks that the code windows hold only lines of the preset files, that the lede is the description in every meta tag, and that every link is a wiki page. It fails when a number drifts.

## Who is affected

- **An application on ARDOR.** No action needed: no published package changes through this entry.
- **A contributor.** After pulling, run `bun install` (the umbrella gains `vite`, `@types/node` and `@venizia/ignis-boot` as dev dependencies) and `make build-all` once. A change that adds a test file changes a number on the home page: update `COUNTS` in `docs/wiki/site/.vitepress/theme/home-content.ts` when the test says so.
- **A maintainer who releases.** The release gates now include the umbrella's tests through CI; the release command does not change.

## Details

- Issues: #341 (the Vite entry, its build and its gates), #345, #347, #349, #351, #353 and #355 (the shared theme).
