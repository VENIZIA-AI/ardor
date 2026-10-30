---
title: The Actions list shows three workflows with short run titles
description: Checks, Release and Docs replace CI, NPM Release, Deploy Wiki Site and Atlas index; a release run is titled by its version, kind, packages, issue and commit.
packages: []
---

# Changelog - 2026-10-30

## The Actions list shows three workflows with short run titles

<Badge type="info" text="Tooling" />

**In one line.** The Actions tab lists **Checks**, **Release** and **Docs**, and each run says what it is in a few words. No file is renamed, and no package, tag or published file changes.

## What changed

- **Release** (`package-release.yml`): the run is titled `Release · 0.4.6-1 prerelease · kernel,react,admin,ardor · #450 · 207ce41` (version, kind, packages, issue, short commit). `release.ts` sends the title as the optional `label` input, and the plan job refuses a label that is not the one it computes, so a title cannot name a version, kind, issue or commit the run does not use (until the plan job has passed, a queued or refused run shows what was sent). A dispatch by hand has no label and is titled by its inputs and the whole commit. The job `NPM Release`, the environments and the file name are as they were, because npm trusted publishing refers to them.
- **Checks** (`ci.yml`, was CI): still manual only. A run is titled by the pull request title, else by its branch.
- **Docs** (`deploy-docs.yml`, was Deploy Wiki Site): titled `Docs · <branch>`. The Atlas index is now a job of it with the triggers it had (a push to `main`, `develop` or a tag); `atlas-index.yml` is gone. The wiki still deploys on a push to `develop` that changes `docs/wiki/` and on a manual run; the path filter became a check inside the workflow, so it no longer stops the atlas job. The wiki builds and deploys queue in the `pages` group, as the whole workflow did.
- **A stable dispatched before the next Sync** is titled by its inputs: `main` still holds a workflow without the `label` input, and GitHub refuses an input the workflow does not declare, so `release.ts` sends a label only to a branch that declares it.

## Who is affected

- **Whoever runs a release.** `make release` prints `The run is titled: Release · ...` before it dispatches. Nothing else changes.
- **A contributor.** The guards `dispatchedCommit` and `labelVerified` in `scripts/release/__tests__/release-gates.test.ts` pin the title and the verified label; `docs-workflow.test.ts` replaces `atlas-index-workflow.test.ts`.
