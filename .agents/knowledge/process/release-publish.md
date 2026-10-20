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
- [Version line](#version-line)
- [Force-update the workspace before install](#force-update-the-workspace-before-install)
- [Gates, bump, publish, record](#gates-bump-publish-record)
- [The VULCAN preset (ardor only)](#the-vulcan-preset-ardor-only)
- [Consumer measurement](#consumer-measurement)
- [Changelog entry required](#changelog-entry-required)
<!-- okf:generated:contents end -->

## What triggers it

The "NPM Release" workflow (`.github/workflows/package-release.yml`) is a `workflow_dispatch` only -
it never runs on push, tag, or PR. It is dispatched from the Actions tab, `gh workflow run`, or
`scripts/release.ts` (below), with these inputs:

- `package`: one of `kernel`, `react`, `admin`, or `ardor`.
- `build_mode`: the semver bump - `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, or
  `prerelease` (default `patch`).
- `version` (optional): an explicit version, `x.y.z` or `x.y.z-pre`. When set it replaces `build_mode`
  (see [Version line](#version-line)).
- `issue` (optional): the issue number the release commit serves; the commit subject is prefixed `[#N]`.
- `chain_released` (optional): comma-separated npm names this chain published earlier; the registry gate trusts their workspace version (`scripts/release.ts` fills it).

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

## Version line

ARDOR and IGNIS share a minor version (Phat's decision, 2026-10-20): ARDOR `X.Y.*` peers IGNIS `^X.Y.0`, so a new IGNIS minor means a new ARDOR minor of the same number, even when that skips one (ARDOR goes 0.1.5 to 0.3.0 with IGNIS 0.3.0, never through 0.2). Patches move independently on each side. `@venizia/vulcan` and `@venizia/dev-configs` version on their own lines. The four ARDOR packages release together on one version, so a minor release is `kernel`, `react`, `admin` and `ardor` at the same number.

`build_mode` only offers the semver bumps (`patch`, `minor`, `major`, the `pre*` forms), and a plain `minor` from 0.1.5 gives 0.2.0, so a release to a given number takes the explicit `version` input: the workflow's `version`, `bun scripts/release.ts --version 0.3.0` or `bun scripts/release-local.ts --version 0.3.0`. `--version` overrides `--mode`. A sweep with `--version` releases every package still below that version, changed or not, in dependency order; a package already at it is skipped, so a chain that stopped half way runs again. The version must be semver and above the package's current one, or the run stops before any build. The rule - the parsing and the dist-tag - lives in `scripts/release-version.ts`, which the workflow calls (`scripts/release-version.ts target` and `tag`) and the two scripts import; `scripts/__tests__/release-version.test.ts` covers it. A stable version publishes to `latest`, one with a pre-release part to `next`. The workflow resolves both in a `Resolve release target` step before the install, so a malformed or too-low version fails before anything is built.

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
- This applies to dependencies outside the repository. The packages of THIS repository name each
  other as `workspace:*` (react -> kernel; admin -> kernel and react; ardor -> all three), which
  `force-update` skips (a protocol specifier) and `bun pm pack` / `bun publish` write as the
  sibling's own version: `@venizia/ardor` X needs `ardor-*` X exactly. A caret here let a fresh install
  of 0.1.4-3 pull 0.1.4-4 of the others and break (issue #85). `scripts/__tests__/sibling-versions.test.ts`
  pins it: the manifests, and the packed manifest of every package.

## Gates, bump, publish, record

The workflow follows IGNIS's release workflow, step for step: gates first, then the bump, then the
publish, and only then any git write. The gates are in `scripts/release-gates.ts` (tested in
`scripts/__tests__/release-gates.test.ts`); the workflow calls its command line and
`release-local.ts` imports the same functions, so the two cannot drift.

Before the bump, after the install (see [Build system](/process/build-system.md) and
[Makefile targets](/reference/makefile-targets.md)):

1. `release-gates.ts links` - every ARDOR sibling the package declares resolves to this workspace, not to a registry tarball.
2. `make $PACKAGE` and `make lint-$PACKAGE` - build and lint.
3. `make purity-test` and `make purity-$PACKAGE` - the browser-purity probe's own tests, then the probe.
4. `make clean-install-$PACKAGE` - pack the package, install it into empty sandboxes (hoisted and
   isolated) with its siblings from the registry, and import every entry with Bun, Node ESM and a
   browser build. A consumer-side packaging bug fails here, before anything is published.
5. `release-gates.ts artifacts` - every file the package's `exports` map names exists (derived from the map, never a hand-written list).
6. `make catalog-check`, and an assertion that the workflow still publishes with `bun publish`.
7. `release-gates.ts pack`, `protocols` and `registry` - the tarball is packed once; its manifest has no
   `catalog:` or `workspace:` left; and every runtime dependency can be installed (some published
   version satisfies its range). A sibling this chain published seconds ago is named in the
   `chain_released` input and checked against its workspace version, because npm can take minutes to list it.
8. `make preset-smoke` for `ardor` (below).

Then the mutations, in this order:

9. `npm version $TARGET --no-git-tag-version --workspaces-update=false` inside the package folder, then
   `git pull` of `develop`, then (ardor) `bun scripts/vulcan-preset.ts`.
10. **Publish first.** `bun publish --access public --tag $NPM_TAG --ignore-scripts`, where `NPM_TAG` is
    `latest` for `patch|minor|major` or a stable explicit version and `next` for any pre-release mode or
    version (`scripts/release-version.ts tag`). `IS_PUBLISHED` is set before the call, because a publish
    that succeeds and loses its response still leaves npm holding the version. Never `npm publish`: npm
    packs `catalog:` and `workspace:` specifiers verbatim and the package cannot be installed.
11. `npm dist-tag add <package>@<version> highest` (non-fatal), then **the `next` tag is kept at or above
    `latest`** for every `@venizia/ardor*` package, not only the one released (`release-gates.ts heal-next --published <name>@<version> --tag <tag>`;
    a missing or semver-lower `next` is moved to `latest`; non-fatal and loud). The package just published is passed
    in and counts as the current value of its tag: npm can serve the old tags for minutes after a publish, and the
    first live release (ardor 0.3.1) moved `next` to the stale `latest` it read back. The other packages are read from the registry. Phat's rule: `bun add pkg@next`
    never installs something older than `bun add pkg`.
12. Commit `package.json` AND `bun.lock` on `develop` with `chore(<package>): release v<version> [<target>]`
    (prefixed `[#N]` when the `issue` input is set). The lockfile is re-synced in a scratch copy of HEAD
    (`bun install --lockfile-only`), so the committed lock matches the bumped manifest without the
    force-updated ranges of the build leaking into the commit. Push; if `develop` moved, rebase and push once more.
13. Create and push an annotated tag `<package>-v<version>`, tried three times, 10 s and 20 s apart.

If a step after the publish fails, nothing is repaired: two report steps say what is left (develop still
records the old version, or only the tag is missing) and how to finish it by hand. The workflow never
force-pushes `develop`; a failure before the publish touched neither the registry nor git.
Only one release runs at a time (`concurrency: npm-release`). A dispatch with the `heal_only` input runs just the
heal (a second job, `Heal next tags`): it publishes nothing, ignores the other inputs (pick any package), and is how
a stale `next` is fixed by hand.

## The VULCAN preset (ardor only)

Only the `ardor` release carries a preset. `make preset-smoke` runs before the version bump (it packs the packages and checks an app created from the packed preset), and `bun scripts/vulcan-preset.ts` writes `packages/ardor/dist/vulcan-preset` after the bump and after the sync that brings in the earlier releases of the chain, before the publish. `release-local.ts` does both for `ardor` too. The smoke runs VULCAN from the registry (`@venizia/vulcan@latest`); a 404 on a `@venizia` tarball just after a publish is registry lag, and the smoke retries only that, six tries over about five minutes. Details: [ardor](/packages/ardor.md).

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
