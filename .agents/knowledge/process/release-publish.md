---
type: Playbook
title: Release and publish
description: How to run the manually-triggered NPM Release workflow, which releases the ARDOR packages in one run, and validate it against a consumer before publishing.
resource: .github/workflows/package-release.yml
tags: [process, release, ci]
---

<!-- okf:generated:contents start -->
**Contents**

- [What triggers it](#what-triggers-it)
- [Driving a run](#driving-a-run)
- [Release order](#release-order)
- [The plan (kind, branch, promotion)](#the-plan-kind-branch-promotion)
- [Version line](#version-line)
- [Force-update the workspace before install](#force-update-the-workspace-before-install)
- [Gates, bump, publish, record](#gates-bump-publish-record)
- [Trusted publishing (no npm token)](#trusted-publishing-no-npm-token)
- [The VULCAN preset (ardor only)](#the-vulcan-preset-ardor-only)
- [Consumer measurement](#consumer-measurement)
- [Changelog entry required](#changelog-entry-required)
<!-- okf:generated:contents end -->

## What triggers it

The "NPM Release" workflow (`.github/workflows/package-release.yml`) is a `workflow_dispatch` only -
it never runs on push, tag, or PR. It is dispatched from the Actions tab, `gh workflow run`, or
`scripts/release/release.ts` (below). **One dispatch is one run: it releases every package it names, in
dependency order, at one version.** The inputs:

- `packages`: the packages of the run, comma-separated and in dependency order (`kernel,react,admin,ardor`, the default). A list out of order, with a repeat or with an unknown name fails before any build.
- `build_mode`: the semver bump - `patch`, `minor`, `major`, `prepatch`, `preminor`, `premajor`, or
  `prerelease` (default `prerelease`; `patch`, `minor` and `major` are stables and need `main`). A bump mode needs the named packages at one current version.
- `version` (optional): an explicit version, `x.y.z` or `x.y.z-pre`. When set it replaces `build_mode`
  (see [Version line](#version-line)).
- `issue` (optional): the issue number the release commits serve; each commit subject is prefixed `[#N]`.
- `heal_only` (optional): run only the `next` tag heal, publish nothing.

The run name is `packages: <list> | release: <version or mode> | <commit>`.

**The dispatch names the ref.** GitHub runs a `workflow_dispatch` from the copy of the workflow on
the dispatched ref, checks out that ref, and validates the inputs against it. `gh workflow run`
defaults to the DEFAULT branch, `main`, so an unpinned run would build `main`: a prerelease dispatched there is refused by the plan job, and a stable needs it. `scripts/release/release.ts` passes `--ref develop` for a prerelease and `--ref main` for a stable, and a hand-run dispatch needs the right one
too. Every job checks out the dispatched commit (`github.sha`), never a branch name, and the run name carries it.

**The jobs of the workflow.** A release is four jobs and a heal is one.

| Job | Runs | What it does |
|---|---|---|
| `plan` | unless `heal_only`; `contents: read`, full history | `release-plan.ts plan --merge-trial`: the version, the kind, the npm tag, the IGNIS line (`catalog_tag`); refuses a pairing that may not run (see [The plan](#the-plan-kind-branch-promotion)); for a stable also tries the merge back and outputs `develop_sha`. |
| `test` | after `plan` | The gates that need no registry credential: build, lint, package tests, repository script tests, purity, catalog, and the preset smoke against the pinned VULCAN when the run holds `ardor`, each looped over the packages of the run. It refreshes the catalog with the plan's `catalog_tag`. It holds no secret and cannot write. |
| `approve` | only for a stable; after `plan` and `test` | The one human stop: environment `release-approval` (reviewer: the owner; branch: `main` only), `permissions: {}`, one `echo`. Its name carries the version. A prerelease skips it and nobody is asked. |
| `publish` | after `plan`, `test` and `approve` (skipped only for a prerelease) | Environment `npm-release` (no reviewers), `contents: write`, `id-token: write`. For a stable its first step stops the run when `main` is not at the dispatched commit or `develop` is not at the `develop_sha` the plan tested. It takes the plan's version and kind, never works them out again, and passes them to the chain with `--target-branch "$GITHUB_REF_NAME"`; the chain stops when they disagree. The `if` is written out so that a skipped `approve` on a stable stops the job. |
| `heal-next` | only for `heal_only`, on `develop` or `main` | Moves a stale `next` tag; publishes nothing. Same environment and `id-token` as `publish`. |

The clean-install gate is not in the `test` job: it installs a package with its siblings from the registry, and before the bump those are the old versions. The chain runs it after the sibling is out. Workflow permissions are read-only; only `publish` has `contents: write`, and only `publish` and `heal-next` hold `id-token: write` and name `npm-release` (see [Trusted publishing](#trusted-publishing-no-npm-token)). There is no npm token and no secret in the workflow. `bun`, Node and npm have exact versions and every action is pinned by its full commit with the tag in a comment: a bump is a deliberate pull request. `scripts/release/__tests__/release-gates.test.ts` reads the workflow and `release-chain.ts` as text and fails when one guard is removed (one mutation per guard, among them the job graph, the single approval, the publish condition, the branch check and the plan's merge trial); it stops accidents, not an author who removes the guard and the test together. Known limit: the `test` and `publish` jobs each refresh the catalog once, so the tested tree is the published tree only if no IGNIS version appears between them.

**The approval.** A prerelease needs none: the owner's dispatch is the only act. A stable waits for one approval on `release-approval`, given in the run on GitHub (`gh run view <id> --web`); nothing else waits after the click, not the chain and not the merge back. `release-approval` and `npm-release` are GitHub settings that only the owner writes, and the workflow line is what makes a job subject to them. Merge nothing into `main` or `develop` while a stable run is open: if either moves between the plan and the publish, the first step of `publish` stops it before anything is published, and the next dispatch needs a second click.

See [Monorepo layout](/overview/monorepo-layout.md) for how the packages map to
folders, and [packages/kernel](/packages/kernel.md), [packages/react](/packages/react.md),
[packages/admin](/packages/admin.md), [packages/ardor](/packages/ardor.md) for what each package is.

## Driving a run

`bun scripts/release/release.ts [pkg...]` plans one run, sends exactly one `gh workflow run package-release.yml`, waits for the run to finish, then reads the registry for every package of the plan and brings the local `develop` up to date once. With no package names the plan is all four. `--mode` defaults to `prerelease`; the script resolves a mode to an explicit version before it dispatches, so the plan prints the version the run will publish (`kernel,react,admin,ardor` at `0.4.6-0`). There is no prompt: without `--yes` the script prints the plan and the one dispatch and sends nothing, and `--dry-run` prints them even from a dirty or unpushed tree. **The kind of the version picks the branch.** A prerelease (`prerelease`, `prepatch`, `preminor`, `premajor`, or a version with a prerelease part) is dispatched with `--ref develop`; a stable (`patch`, `minor`, `major`, or a version without one) with `--ref main`. The script reads the versions and the workflow files from `origin/<branch>`, so a stable needs no local checkout of `main`, and it refuses, with every reason, a pairing the plan refuses (a stable over a stable, a version that is not the promotion of a prerelease; see [The plan](#the-plan-kind-branch-promotion)). A stable then waits for one approval in the run on GitHub, and afterwards the script fast-forwards the local `develop`, which the workflow's merge back moved. When every package is already at the stable version but `main` is not in `develop`, the same version dispatched again runs only the merge back. Until the workflow and the chain of the stable flow are on `main`, a stable dispatch is refused by the preflight: `origin/main` holds no workflow that runs the chain. Naming packages resumes a run that stopped half way: it needs `--version`, plans the packages below it and leaves the ones already at it. After the run the script waits for a version that was not on the registry before the dispatch, so a stable release to `latest` verifies the same way as a prerelease to `next`. It refreshes and commits no table: atlas computes its release table from the
`<package>-v<version>` tags the run pushes, so there is nothing to regenerate (see
[Atlas MCP server](/reference/atlas-mcp.md)).

A run can wait in the queue behind another release (one at a time, repository-wide); the script keeps waiting, with no deadline, and says so on the first poll and every five minutes (`waitForCompletion` in `scripts/release/release-wait.ts`). The wait for each package's **tarball** to answer 200 (`HEAD` every 5 s for up to 15 minutes) is the chain's, between the publish and the next package: the packument and the dist-tag are listed minutes before the tarball, and the next package's clean-install gate installs the one before it.

A release always goes through this script and the workflow: there is no way to publish from a developer machine.

## Release order

Because `admin` depends on `react`, `react` depends on `kernel`, and `ardor` bundles all three, the
packages of a run release in dependency order: **kernel, then react, then admin, then ardor**. Releasing
out of order means a downstream package builds against a stale floor for its own dependency, and the
force-update step below cannot invent a published version that does not exist yet.

## The plan (kind, branch, promotion)

`bun scripts/release/release-plan.ts plan --packages <list> (--version <x.y.z> | --mode <mode>) --ref <refs/heads/...>` decides, before anything is built, what a dispatch would release and whether it may. `ReleasePlan.plan` is the tested core; the command adds the reads of the repository and the registry.

| Rule | Detail |
|---|---|
| Kind | A version with a prerelease part is a prerelease (npm tag `next`, IGNIS line `highest`, no approval). Any other is a stable (`latest`, IGNIS `latest`, one approval). |
| Branch | A prerelease runs only from `refs/heads/develop`, a stable only from `refs/heads/main`. Any other ref is refused. |
| Promotion (main only) | A stable bump mode (`patch`, `minor`, `major`) needs every package at a prerelease. An explicit stable version `X` needs every package at a prerelease whose `patch`, `minor` or `major` increment is `X`, or already at `X` (a run that stopped half way). A stable nobody tested on `next` is refused. |
| One version | The four packages share one version: a mode over packages at different versions is refused. All four already at the version is an empty plan, which is accepted. |
| IGNIS stable first | For a stable, the tag of the prerelease (`ardor-v<version>`, the last tag of its run) carries a `built on: <package>=<version>, ...` line. The plan refuses when a listed package has no `latest`, or a `latest` below the version in the line, or when the tag has no such line (a prerelease made before the line existed: publish a new one). |

The command prints `plan: <version> (<kind>) from <target> on <ref>`, writes `version`, `kind`, `npm_tag` and `catalog_tag` to `GITHUB_OUTPUT` and a summary to `GITHUB_STEP_SUMMARY`, and prints every reason with `ERROR |` before it exits 1. With `--merge-trial`, a stable also rehearses the merge back (see below) and `develop_sha` holds the head of `develop` it read. The `plan` job runs it with `--merge-trial`, and the chain writes the `built on:` line into every tag.

### The merge back into develop

After a stable, `main` holds the release commits and `develop` does not, so `main` is merged back into `develop`. The script is `scripts/release/merge-back.ts`, copied from VULCAN (`fe4c6771`, header names it); a defect is fixed in VULCAN first. ARDOR changes the scratch root only (the runner temp folder, else `.agents/local/tmp`).

- **`trial`** runs in the plan job, before the approval. In throwaway worktrees it makes the release commit the run would make (the four manifests at the version, `bun.lock`), merges it into `develop` and reports. The checkout is untouched. `--versions kernel=X,react=X,admin=X,ardor=X` names the four packages; each manifest needs a two-space top-level `"version"`.
- **`apply --from <commit> --repo <worktree of develop>`** runs in the publish job, from a copy of the script taken from the dispatched `main` checkout, so no file of `develop` (a `bunfig.toml`, a `.env`) configures it.
- **The conflict rule.** A conflict is resolved only when it is the `version` field of a `package.json` (the semver-greater wins: stable `0.4.9` beats `0.4.9-3`, `0.4.10-0` beats `0.4.9`) or `bun.lock`, which is regenerated after the manifests and checked to differ from `develop`'s only in workspace versions. Anything else stops the merge, names the file, and leaves the checkout as it was. Nothing is force-pushed.
- **`sync-pr.ts`** cuts the Sync (`open --tag ardor-v<prerelease>`, a real tag only; it reads the version at the tag from `packages/ardor/package.json`) and `verify` checks the tree of `main` equals the tree of the tag. The Sync PR body ends with one `Closes #N` for each issue the commits it brings serve (the leading `[#N]` tokens of their subjects): feature PRs say `Refs #N`, and only the Sync PR, which merges into `main`, closes issues. It pushes a branch and opens a pull request, so it runs on the owner's word.

## Version line

ARDOR and IGNIS share a minor version (Phat's decision, 2026-10-20): ARDOR `X.Y.*` peers IGNIS `^X.Y.0`, so a new IGNIS minor means a new ARDOR minor of the same number, even when that skips one (ARDOR goes 0.1.5 to 0.3.0 with IGNIS 0.3.0, never through 0.2). Patches move independently on each side. `@venizia/vulcan` and `@venizia/dev-configs` version on their own lines. The four ARDOR packages release together on one version, so a minor release is `kernel`, `react`, `admin` and `ardor` at the same number.

`build_mode` only offers the semver bumps (`patch`, `minor`, `major`, the `pre*` forms), and a plain `minor` from 0.1.5 gives 0.2.0, so a release to a given number takes the explicit `version` input: the workflow's `version`, `bun scripts/release/release.ts --version 0.3.0`. `--version` overrides `--mode`. With `--version` the plan holds every package still below that version, in dependency order; a package already at it is left alone, so a run that stopped half way runs again for the rest. The version must be semver and above the package's current one, or the run stops before any build. The rule - the parsing and the dist-tag - lives in `scripts/release/release-version.ts`, which the workflow calls (`scripts/release/release-version.ts target` and `tag`) and `release.ts` imports; `scripts/release/__tests__/release-version.test.ts` covers it. A stable version publishes to `latest`, one with a pre-release part to `next`. Both jobs resolve the one version of the run in a `Plan the run` step (`scripts/release/release-plan.ts resolve`, which reads the manifests of the named packages) before the install, so a malformed version, a package above it, or packages at different versions under a bump mode fail before anything is built.

## Force-update the workspace before install

Each of the `test` and `publish` jobs runs the version-refresh step once, **before** `bun install`, and
across the **whole workspace**, not just the packages being released:

```
bun scripts/build/refresh-catalog.ts highest
bun run --filter "@venizia/*" force-update highest
```

- Before the install: `force-update` rewrites internal `@venizia/*` version ranges to the highest
  published line. An install that ran first has already resolved the old ranges, so the build would
  compile against a package one release behind.
- Across the whole workspace: the root catalog owns every `@venizia/*` range, so it is refreshed
  first; the per-package force-update step then refreshes any range the catalog does not own.
- ARDOR always tracks the highest published line, prerelease included - never `npm`'s `latest` tag
  directly - because a run in progress needs the just-published prerelease of an earlier
  package before the later package's own release runs.
- This applies to dependencies outside the repository. The packages of THIS repository name each
  other as `workspace:*` (react -> kernel; admin -> kernel and react; ardor -> all three), which
  `force-update` skips (a protocol specifier) and `bun pm pack` writes as the
  sibling's own version: `@venizia/ardor` X needs `ardor-*` X exactly. A caret here let a fresh install
  of 0.1.4-3 pull 0.1.4-4 of the others and break (issue #85). `scripts/release/__tests__/sibling-versions.test.ts`
  pins it: the manifests, and the packed manifest of every package.

## Gates, bump, publish, record

The workflow follows IGNIS's release workflow, step for step: gates first, then the bump, then the
publish, and only then any git write. The `publish` job does its own setup (checkout, Node, bun, the branch check of a stable, npm, the catalog refresh, the install) and then runs one step, `bun scripts/release/release-chain.ts`, which holds every per-package command as data (`ReleaseChain.plan`), so a test reads the exact sequence and can fail each step (`scripts/release/__tests__/release-chain.test.ts`). The gates are in `scripts/release/release-gates.ts` (tested in
`scripts/release/__tests__/release-gates.test.ts`); the chain calls its command line, and
`scripts/preset/preset-smoke.ts` imports the same functions.

**Before anything runs**, the chain reads each package fresh (the registry with `--prefer-online`, and `git ls-remote` for the tag): a package whose manifest and registry and tag are all at the version is skipped; a version on npm while the manifest is below it, a manifest at the version that is not on npm, or a version on npm without its tag stops the run before anything changes, and the report names the repair.

**Phase A, before the first publish, for every package of the run** (see [Build system](/process/build-system.md) and [Makefile targets](/reference/makefile-targets.md)):

1. `release-gates.ts links` - every ARDOR sibling the package declares resolves to this workspace, not to a registry tarball.
2. `make <package>` - the build.
3. `release-gates.ts artifacts` - every file the package's `exports` map names exists (derived from the map, never a hand-written list).
4. `release-gates.ts pack` - the tarball is packed once, as a check before any mutation (the tarball that is published is packed again in phase B).
5. `release-gates.ts protocols` - its manifest has no `catalog:` or `workspace:` left.
6. `release-gates.ts registry` - every runtime dependency can be installed (some published version satisfies its range). The packages of the run are named in `--chain-released` and checked against their workspace version, because npm can take minutes to list a sibling the run publishes seconds earlier.

For a **stable** a seventh check follows `protocols`: `release-gates.ts stable-deps <packed manifest>` fails when a non-ARDOR `@venizia/*` range has a prerelease part (a stable never ships an IGNIS prerelease). The run also stops before it builds when its version, its kind and its branch disagree with each other or with the plan job (`--plan-version`, `--plan-kind`, `--target-branch`): a stable is released from `main`, a prerelease from `develop`.

The preset smoke for `ardor` is not a step of the `publish` job: the `test` job runs it first (below). A phase A failure publishes nothing.

**Phase B, one package at a time** (the first one also makes the tarball folder, because `bun pm pack --filename` does not):

1. `make clean-install-<package>` - pack the package, install it into empty sandboxes (hoisted and isolated) with its siblings from the registry, and import every entry with Bun, Node ESM and a browser build. It runs after the previous package's tarball answered 200, so it installs the sibling versions this run published.
2. `npm version <version> --no-git-tag-version --workspaces-update=false` inside the package folder, then (ardor) `bun scripts/preset/vulcan-preset.ts`, and for a stable `release-gates.ts stable-deps packages/ardor/dist/presets` (the preset names only stable versions).
3. **Pack the tarball to publish.** `bun pm pack --quiet --filename <tarballs>/<package>.tgz` (one folder, `.agents/local/tmp/release-tarballs`, absolute because npm reads a relative `.agents/x/y.tgz` as a package spec), after the bump and the preset write so it carries both. Its manifest goes through `release-gates.ts protocols` and must carry the version this run releases; the sha256 of the file is recorded and checked again just before the publish. Only `bun pm pack` resolves `catalog:` and `workspace:`: npm packs those specifiers verbatim and the package cannot be installed.
4. **Publish first.** `npm publish <tarball> --access public --tag <npm tag> --ignore-scripts --provenance`, where the tag is `latest` for a stable version and `next` for one with a pre-release part (`scripts/release/release-version.ts tag`). The package is marked "publish attempted" before the call, because a publish that succeeds and loses its response still leaves npm holding the version. There is no `bun publish`: bun has no trusted publishing.
5. Wait until the tarball answers 200 (`waitForTarball`).
6. `release-gates.ts tag-highest --published <name>@<version>` (non-fatal, over OIDC) runs `npm dist-tag add` for `highest` only when the version is semver-greater than the current `highest`: a stable `0.4.9` published after `0.4.10-0` leaves it alone. Then **the `next` tag is kept at or above
   `latest`** for every `@venizia/ardor*` package, not only the one released (`release-gates.ts heal-next --published <name>@<version> --tag <tag>`;
   a missing or semver-lower `next` is moved to `latest`; non-fatal and loud). The package just published is passed
   in and counts as the current value of its tag: npm can serve the old tags for minutes after a publish, and the
   first live release (ardor 0.3.1) moved `next` to the stale `latest` it read back. The other packages are read from the registry. Phat's rule: `bun add pkg@next`
   never installs something older than `bun add pkg`. A failure of either is a warning in the report, never a stop.
7. Commit `package.json` AND `bun.lock` with `chore(<package>): release v<version> [<version>]` (prefixed `[#N]` when the `issue` input is set), on a branch `release-<run id>` made before the first commit. The lockfile is re-synced in a scratch copy of HEAD
   (`bun install --lockfile-only`), so the committed lock matches the bumped manifest without the
   force-updated ranges of the build leaking into the commit. Push `HEAD:<target branch>` (`develop` for a prerelease, `main` for a stable). **The chain never rebases:** a push rejected because the branch moved stops the run, since a rebase would pull commits the tests never saw into the tree that later packages are built and published from.
8. Create and push an annotated tag `<package>-v<version>`, tried three times, 10 s and 20 s apart. Its message is `<name> v<version>` and a line `built on: <@venizia/* catalog entry>=<version>, ...`, read from the refreshed catalog: the stable plan reads that line of the prerelease it promotes to check that IGNIS has a stable at least as new.

**Phase C, a stable only: the merge back.** After the last package is tagged (or when every package was already released), one run-level step merges `main` back into `develop`. It fetches `develop` and is **skipped** when `develop` already holds the last release commit. Otherwise it adds a throwaway worktree of `origin/develop`, copies `scripts/release/merge-back.ts` from this checkout, runs `apply --from <last release commit> --repo <worktree>` (see [The merge back into develop](#the-merge-back-into-develop)), pushes `HEAD:develop` from the worktree and removes it. A rejected push stops the run; nothing is rebased or forced.

So after any stop git equals the registry: a package has its commit and its tag, or it was not published. One run leaves one commit and one tag per package.

**When a run stops**, nothing is repaired. The chain writes the state of every package to a file after each step and the last step of the job, `Report the run`, runs `release-chain.ts report` with `if: always()`: it prints the report and adds it to the step summary, also when the job was cancelled or timed out. The report names the package, the step, the packages already done and the repair for one of five states: nothing published (fix the cause and dispatch again with `--version`); a publish attempted with an unknown outcome (confirm with `npm view <name> versions`); published but not committed or not pushed (bump the manifest by hand, or pull and push); committed and pushed but not tagged (create the tag by hand); and, for a stable, **"Report - published, merge back not done"**: every package is released and tagged, only the merge back is missing, and the report gives the repair (dispatch the same version again, which runs only the merge back, or the three commands by hand). Every report names the branch the run pushes to. The workflow never force-pushes `develop` or `main`. The state file also records `mergeBack` (`none` until it is done or found already done).

Only one release runs at a time (`concurrency: npm-release`). A dispatch with the `heal_only` input runs just the
heal (a second job, `Heal next tags`): it publishes nothing, ignores the other inputs, and is how
a stale `next` is fixed by hand. It moves a dist-tag, so it is a trusted-publisher action too: the same environment, `id-token: write` and `contents: read`, and the same exact npm.

## Trusted publishing (no npm token)

The workflow holds no npm token. npm exchanges the identity of the `release` or `heal-next` job for a short-lived credential, which needs three things in the workflow and one on npmjs.com:

- **In the workflow.** The environment `npm-release` on `publish` and `heal-next` (its ref rule, develop and main, is a GitHub setting that only the owner writes; it has no reviewers: a prerelease needs none, and a stable's one approval is the `approve` job's on `release-approval`; the workflow line is what makes the job subject to the rule), `id-token: write` on both and on nothing else, and an exact npm of at least 11.21.0 (11.5.1 can publish, 11.21.0 is the first that can move a dist-tag over OIDC; the npm that ships with Node 24 is older), installed and asserted next to an exact Node.
- **On npmjs.com.** Each of `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor-admin` and `@venizia/ardor` has a **trusted publisher** (package Settings, Trusted Publisher, GitHub Actions): organisation `VENIZIA-AI`, repository `ardor`, workflow filename `package-release.yml`, environment `npm-release`, and the allowed actions `npm publish` and `npm dist-tag`. The owner makes the entries; npm does not validate one when it is saved, so a typo shows only at the first publish, and an entry that has seen no successful publish within two days expires.
- **In each `package.json`.** `repository.url` must match this repository (`git+https://github.com/VENIZIA-AI/ardor.git`, with the package `directory`), and the repository and the packages must be public. Provenance is then automatic and npmjs.com shows "Built and signed on GitHub Actions".

A failed first run is safe: nothing is published before the first package authenticates. The repository secret `NPM_ACCESS_TOKEN` is already deleted, so there is no token to fall back to: the four trusted-publisher entries are all the owner still has to make before the first release. After a release has passed, the owner may set each package's Publishing access to "Require two-factor authentication and disallow tokens". `scripts/release/__tests__/release-gates.test.ts` keeps the workflow side: no token in any form and no secret, the environment and `id-token` where they belong, `npm publish --provenance` of a tarball packed by `bun pm pack`, the sha256 check before the publish, exact Node and npm, and that npm is installed before the first step that uses it. `scripts/release/release.ts` refuses to dispatch when the workflow no longer runs the chain, or the chain no longer packs with bun and publishes with a provenance. VULCAN's own release workflow (#537) is the model.

## The VULCAN preset (ardor only)

Only the `ardor` release carries a preset. `make preset-smoke` runs in the `test` job, before the `publish` job and so before any bump (it packs the packages and checks an app created from the packed preset), and `bun scripts/preset/vulcan-preset.ts` writes `packages/ardor/dist/presets` in the chain, after the bump and before the pack. The smoke runs the VULCAN the root `package.json` pins (the workflow sets `VULCAN_CMD` to `bun x @venizia/vulcan@<that version>`; `preset-smoke.ts` defaults to the same), never `latest`. A VULCAN bump moves the pin in four places in one change: the root `package.json`, the lockfile, `VULCAN_CMD` and the commit with its `# v<version>` comment of the VULCAN action in `atlas-index.yml` (two tests read them). A 404 on a `@venizia` tarball just after a publish is registry lag, and the smoke retries only that, six tries over about five minutes. Details: [ardor](/packages/ardor.md).

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
