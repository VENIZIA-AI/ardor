---
title: One release run releases all four packages
description: The release workflow now takes the list of packages and one version, and releases kernel, react, admin and ardor in order in a single run; make release sends one dispatch instead of one per package.
packages: []
---

# Changelog - 2026-10-29

## One release run releases all four packages

<Badge type="info" text="Tooling" />

**In one line.** A release used to be four workflow runs, one per package, dispatched one after the other by `make release`. It is now one run that releases the four packages in order, at one version.

## What changed

- **One dispatch.** The workflow takes `packages` (a list in dependency order) in place of `package`, and no longer takes `chain_released`. `make release` resolves a bump mode to an explicit version first, so it prints the version the run publishes, then sends one dispatch.
- **Checks first.** The links, build, artifacts, pack, protocols and registry checks run for every package before the first publish. A failure there publishes nothing.
- **One package at a time after that.** For each package the run installs it with its siblings from the registry, bumps, packs, publishes with a provenance, waits for the tarball to answer 200, moves the dist-tags, then commits, pushes and tags. After any stop, git matches the registry: a package has its commit and its tag, or it was not published.
- **A push is never rebased.** If `develop` moves during a run, the run stops and says so. Merge nothing into `develop` while a release runs.
- **A report that survives.** The state of each package is written after every step, and the last step of the job prints the report, also when the job is cancelled or times out. It names the package, the step, the packages already done and the repair.
- **Resuming.** Naming packages on the command line, with `--version`, releases only the ones still below that version.
- **The test job** runs each gate for every package of the run. The clean-install gate moved into the run, after the sibling it installs is out.

The packed files of the four packages, and their `package.json`, are identical before and after.

## Who is affected

- **An app or a package.** Nothing.
- **Whoever runs a release.** Run `make release-plan` to see the one dispatch, then `make release ARGS="--yes"`. The `npm-release` environment has no reviewers: your dispatch is the approval, and nothing pauses the run before its first publish.
- **A contributor.** The workflow guards in `scripts/release/__tests__/release-gates.test.ts` now read the workflow and `scripts/release/release-chain.ts` together.
