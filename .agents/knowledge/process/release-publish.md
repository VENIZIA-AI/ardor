---
type: Playbook
title: Release and publish
description: How to run the manually-triggered NPM Release workflow for an ARDOR package and validate it against a consumer before publishing.
resource: .github/workflows/package-release.yml
tags: [process, release, ci]
---

<!-- okf:generated:contents start -->
**Contents**

- [What triggers it](#what-triggers-it)
- [Driving a chain](#driving-a-chain)
- [Release order](#release-order)
- [Force-update the workspace before install](#force-update-the-workspace-before-install)
- [Build, lint, bump, tag, publish](#build-lint-bump-tag-publish)
- [Consumer measurement](#consumer-measurement)
- [Changelog entry required](#changelog-entry-required)
<!-- okf:generated:contents end -->

## What triggers it

The "NPM Release" workflow (`.github/workflows/package-release.yml`) is a `workflow_dispatch` only -
it never runs on push, tag, or PR. It is dispatched from the Actions tab, `gh workflow run`, or
`scripts/release.ts` (below), with two required inputs:

- `package`: one of `kernel`, `react`, `admin`, or `ardor`.
- `build_mode`: the semver bump - `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, or
  `prerelease` (default `patch`).

**The dispatch names the ref.** GitHub runs a `workflow_dispatch` from the copy of the workflow on
the dispatched ref, checks out that ref, and validates the inputs against it. `gh workflow run`
defaults to the DEFAULT branch, `main`, so an unpinned run builds `main` even though its bump commit
lands on `develop`. `scripts/release.ts` passes `--ref develop`, and a hand-run dispatch needs it
too.

There is no fan-out step that releases every package in one dispatch: each package is released with
its own run. See [Monorepo layout](/overview/monorepo-layout.md) for how the packages map to
folders, and [packages/kernel](/packages/kernel.md), [packages/react](/packages/react.md),
[packages/admin](/packages/admin.md), [packages/ardor](/packages/ardor.md) for what each package is.

## Driving a chain

`bun scripts/release.ts [pkg...]` dispatches `package-release.yml` for one package at a time, in
dependency order, and waits for each run to finish before the next - the workspace-wide
force-update below cannot overlap. With no package names it releases every package that needs one.
`--mode` defaults to `prerelease`. There is no prompt: without `--yes` the script prints the plan and
dispatches nothing, and `--dry-run` prints the plan even from a dirty or unpushed tree. A package counts as changed when its `src`, `package.json`, `tsconfig.json` or `.configs/tsconfig.build.json` changed since its last release commit (`scripts/release-scope.ts`), so a manifest-only change such as the umbrella's peers is released too. After each run the script waits for a version that was not on the registry before dispatch, so a stable release to `latest` verifies the same way as a prerelease to `next`. The chain ends there: it refreshes and commits no table. atlas computes its release table from the
`<package>-v<version>` tags the workflow pushes, so there is nothing to regenerate (see
[Atlas MCP server](/reference/atlas-mcp.md)).

After each run the script checks the registry twice: `npm view` must report the new version, and then the **tarball** URL (`scripts/release-wait.ts`, `HEAD` every 5 s for up to 15 minutes) must answer 200. The packument and the dist-tag are listed minutes before the tarball, and the next package's clean-install gate installs the one before it; a chain that went on at the dist-tag failed `react` once on the `ardor-kernel` 404.

`bun scripts/release-local.ts` publishes from the machine instead, without Actions minutes. It runs
the workflow's force-update, build, lint, version bump and `bun publish`, but not
`refresh-catalog.ts`, and it checks the files the `exports` map names rather than `dist/index.js`.
It adds gates CI lacks - `make catalog-check`, no `catalog:`/`workspace:` left in the packed
manifest, every internal dependency on the registry - and a `Continue? [y/N]` prompt that `--yes`
skips. It is stricter than CI: it refuses a dirty tree or a HEAD that is not `origin/develop`, and
it publishes before any git write, so a rejected publish leaves nothing to roll back.

## Release order

Because `admin` depends on `react`, `react` depends on `kernel`, and `ardor` bundles all three, a
release chain runs in dependency order: **kernel, then react, then admin, then ardor**. Releasing
out of order means a downstream package builds against a stale floor for its own dependency, and the
force-update step below cannot invent a published version that does not exist yet.

## Force-update the workspace before install

The job resolves the folder for the chosen package (`packages/<name>`), reads its current
`package.json` name and version, then runs the version-refresh step **before** `bun install`, and
across the **whole workspace**, not just the package being released:

```
bun scripts/refresh-catalog.ts highest
bun run --filter "@venizia/*" force-update highest
```

- Before the install: `force-update` rewrites internal `@venizia/*` version ranges to the highest
  published line. An install that ran first has already resolved the old ranges, so the build would
  compile against a package one release behind.
- Across the whole workspace: the root catalog owns every `@venizia/*` range, so it is refreshed
  first; the per-package force-update step then refreshes any range the catalog does not own.
- ARDOR always tracks the highest published line, prerelease included - never `npm`'s `latest` tag
  directly - because a release chain in progress needs the just-published prerelease of an earlier
  package before the later package's own release runs.

## Build, lint, bump, tag, publish

After install, the job uses the Makefile dependency chain (see
[Build system](/process/build-system.md) and [Makefile targets](/reference/makefile-targets.md)):

1. `make $PACKAGE` - build.
2. `make lint-$PACKAGE` - lint.
3. Validate that `dist/index.js` and `dist/index.d.ts` exist for the package.
4. `make clean-install-$PACKAGE` - pack the package, install it into empty sandboxes (hoisted and
   isolated) with its siblings from the registry, and import every entry with Bun, Node ESM and a
   browser build. A consumer-side packaging bug fails here, before anything is published.
5. `npm version $BUILD_MODE --no-git-tag-version --workspaces-update=false` inside the package
   folder - version bump without touching other workspace manifests.
6. Commit `package.json` AND `bun.lock` on `develop` with message `chore(<package>): release
   v<version> [<build_mode>]`, push. The lockfile is re-synced in a scratch copy of HEAD
   (`bun install --lockfile-only`), so the committed lock matches the bumped manifest without the
   force-updated ranges of the build leaking into the commit.
7. Create and push an annotated tag `<package>-v<version>`. The push is tried up to three times, 10 s
   and 20 s apart: GitHub has rejected a tag push with a bare `(failed)` and no reason, and without the
   retry that one error rolls back a release commit already on `develop`.
8. `bun publish --access public --tag <npm_tag> --ignore-scripts` where `npm_tag` is `latest` for
   `patch|minor|major` and `next` for any pre-release mode. Scripts are skipped on publish because
   the build already ran in an earlier step. Never `npm publish`: npm packs `catalog:` and
   `workspace:` specifiers verbatim and the package cannot be installed; only bun resolves them
   while packing.

If any step fails, a rollback step deletes the tag if it was created, and hard-resets and
force-pushes `develop` if the commit was pushed - but a package already published to npm is not
un-published; the rollback step prints an `npm deprecate` reminder instead.

## Consumer measurement

Before trusting a release chain, measure the downstream consumer - the material refers to this
project internally as BANA - rather than relying on the package's own test suite alone:

1. Symlink the consumer's `node_modules` entries for `@venizia/*` packages to the freshly built
   `packages/<name>` folders, keeping every other dependency pinned to the consumer's own resolved
   versions (mismatched `react` or other shared trees inside one program produce runtime errors that
   have nothing to do with the release).
2. Run `tsc --noEmit` for each consumer app against that symlinked tree.
3. Any new type error introduced by the release must map to an intentional, documented breaking
   change - see [Design decisions](/overview/design-decisions.md) and
   [Application lifecycle](/architecture/application-lifecycle.md) for what a compatible
   `IGNIS`/`Application` surface looks like. An undocumented error is a signal to fix the package,
   not the consumer.

## Changelog entry required

Every release - regardless of package or bump size - needs a changelog entry describing what
changed and why, before or alongside the version bump commit. This is what lets a later `tsc` error
in the consumer be traced back to an intended change instead of a regression. See
[Git workflow](/process/git-workflow.md) for where that entry lives in the commit flow and
[Testing](/process/testing.md) for the test expectations a package must meet before it is a release
candidate.
