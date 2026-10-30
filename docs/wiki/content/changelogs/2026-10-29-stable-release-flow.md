---
title: A stable release is planned, approved once and merged back
description: A prerelease still goes from develop with no approval. A stable now goes from main after one approval, and main is merged back into develop; make gates runs the test job locally.
packages: []
---

# Changelog - 2026-10-29

## A stable release is planned, approved once and merged back

<Badge type="info" text="Tooling" />

**In one line.** `make release` picks the branch by the kind of the version: a prerelease goes from `develop` as before, with no approval; a stable goes from `main` and waits for one approval, and the workflow then merges `main` back into `develop`.

## What changed

- **A plan runs first.** The release workflow starts with a `plan` job. It resolves the one version, says whether it is a prerelease or a stable, and refuses a pairing that may not run: a prerelease from `main`, a stable from `develop`, a stable bump over a stable, or an explicit stable version that is not the promotion of a prerelease (`0.4.10` over `0.4.9-1`). It stops before anything is built and before anyone is asked to approve.
- **IGNIS stable first.** A stable is built on the IGNIS `latest` and refused while an IGNIS package the prerelease was built on has no stable at least as new. Each release tag now records that in a `built on:` line, and a stable never ships an IGNIS prerelease range, in a package or in the preset.
- **One approval, stable only.** The `approve` job uses the environment `release-approval` and runs for a stable only. After the click nothing else waits. The `publish` job then runs, and it stops before it publishes if `main` or `develop` moved since the plan.
- **Merge back.** A stable pushes its release commits and tags to `main`. The chain then merges `main` into `develop` in a clean worktree. A conflict on the `version` field of a `package.json` takes the greater version, `bun.lock` is regenerated, and any other conflict stops the run, before the approval when the plan can see it. If the merge back stops after the last tag, the report reads "Report - published, merge back not done" and gives the repair; dispatching the same version again runs only the merge back.
- **`highest` only goes up.** A stable `0.4.9` published after `0.4.10-0` leaves the `highest` tag where it is.
- **`make gates`** runs the checks of the test job locally, in the same order; a test fails when the two lists differ.
- **One copy of every `@venizia/*` package.** The test job runs `release-gates.ts single-copy` after the install and fails, naming the workspace package, when one package resolves to two versions. `packages/ardor` now declares the IGNIS packages as `catalog:` devDependencies like its siblings: the first prerelease run stopped at the build because it got the stable IGNIS copy for its `^0.4.1` peer, beside the prerelease (issue #434).
- **A preset built on a prerelease accepts it.** The Test job builds the preset after refreshing the catalog to the IGNIS prerelease, and `vulcan add` refused the catalog `vulcan init` wrote from it (`^0.4.1` does not meet `0.4.6-0`). The `peers` of the preset now read `<range> || <the exact prerelease>` for such an entry; a stable build and the published `peerDependencies` are unchanged.
- **The `built on:` line holds versions.** The first prerelease tag wrote the catalog ranges (`^0.4.6-0`), which the stable gate cannot compare. New tags carry the bare version, and the plan reads a leading `^` or `~` away, so that first tag still works.
- **The library preset declares the six IGNIS packages.** `vulcan add --preset ardor --lib` now writes `@venizia/ignis-boot`, `-connectors`, `-filter`, `-helpers`, `-inversion` and `-kernel` as `catalog:` devDependencies, as the app preset does, so a new library no longer starts without them (issue #436). The preset smoke asserts them in the generated library and runs `single-copy` after every install.
- **`single-copy` walks any repository layout.** It took the members from `packages/*` only, so in a consumer repo (BANA, 49 members under other folders) it read the root alone and passed while six packages had two copies. It now takes the members from the `workspaces` field of the root `package.json` (issue #443).
- **`single-copy` tells a stale install from a missing declaration.** `bun install` does not prune a symlink an older install left in a member's `node_modules`, and the gate advised a `catalog:` declaration for it. It now checks each version against `bun.lock`: one the lock does not hold is marked `stale install` and the advice is a clean install (remove `node_modules`); a version the lock holds keeps the declaration advice (issue #445).
- **`make gates-refreshed`** runs `make gates` after the Test job's catalog refresh (the IGNIS `highest` line), in a scratch copy of the tree. Run it before every dispatch: a plain `make gates` cannot see what the refresh moves.
- **VULCAN** is pinned at 0.4.7.

## Who is affected

- **An app or a package.** Declare every IGNIS package yourself (see [Setup](../guides/get-started/setup)): a peer range never matches a prerelease, so a package that lists none gets the stable copy next to your prerelease.
- **Whoever runs a release.** `make release-plan` prints the plan and the ref. `make release ARGS="--mode prerelease --yes"` is a prerelease from `develop`. `--mode patch|minor|major`, or an explicit version without a prerelease part, is a stable from `main` and needs the approval in the run on GitHub. Merge nothing into `main` or `develop` while a stable run is open.
- **A contributor.** The workflow guards in `scripts/release/__tests__/release-gates.test.ts` follow the new job graph, and `scripts/release/merge-back.ts` and `sync-pr.ts` are VULCAN's, copied.

## Known limit

A stable can run only after a Sync carries this workflow to `main`. The parts that run only on GitHub, the pause on `release-approval`, the trusted publish from `main` and the merge back on the real history, have not run yet: the first stable run is their first test.
