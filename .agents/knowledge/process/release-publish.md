---
type: Playbook
title: Release and publish
description: How to run the manually-triggered NPM Release workflow for an ARDOR package and validate it against a consumer before publishing.
resource: .github/workflows/npm-release.yml
tags: [process, release, ci]
---

## What triggers it

The "NPM Release" workflow is a `workflow_dispatch` only - it never runs on push, tag, or PR. A
human triggers it from the Actions tab (or `gh workflow run`) and picks two required inputs:

- `package`: one of `kernel`, `react`, `admin`, `ardor`, `ui-kit`.
- `build_mode`: the semver bump - `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, or
  `prerelease` (default `patch`).

There is no fan-out step that releases every package in one dispatch: each package is released with
its own run. See [Monorepo layout](/overview/monorepo-layout.md) for how the packages map to
folders, and [packages/kernel](/packages/kernel.md), [packages/react](/packages/react.md),
[packages/admin](/packages/admin.md), [packages/ardor](/packages/ardor.md) for what each package is.

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
4. `npm version $BUILD_MODE --no-git-tag-version --workspaces-update=false` inside the package
   folder - version bump without touching other workspace manifests.
5. Commit `package.json` on `develop` with message `chore(<package>): release v<version>
   [<build_mode>]`, push.
6. Create and push an annotated tag `<package>-v<version>`.
7. `npm publish --access public --tag <npm_tag> --ignore-scripts` where `npm_tag` is `latest` for
   `patch|minor|major` and `next` for any pre-release mode. Scripts are skipped on publish because
   the build already ran in an earlier step.

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
