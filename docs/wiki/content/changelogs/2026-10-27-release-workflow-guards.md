---
title: The release workflow runs only from develop, with a test job and pinned versions
description: The package release workflow now runs only for the develop branch, grants write access only to the job that pushes, publishes only after a test job with no secret, uses an exact bun and actions pinned by commit, and a test fails when one of these guards is removed.
packages: []
---

# Changelog - 2026-10-27

## The release workflow runs only from develop, with a test job and pinned versions

<Badge type="info" text="Tooling" />

**In one line.** The workflow that publishes ARDOR is stricter about where it runs, what it can write and what it must pass first. How a release is started does not change. In ARDOR 0.4.5.

## What changed

- **One branch.** The release and heal jobs run only for `develop`; a dispatch from any other branch runs nothing. `make release` already dispatches `develop`.
- **Minimal permissions.** The workflow is read-only by default; only the job that pushes the release commit and the tag can write.
- **A test job first.** A job with no secret runs the build, the package and script tests and the gates that need no registry credential; the release job needs it.
- **The dispatched commit.** Every job checks out the commit that was dispatched, and the run name shows it. The step that moved the checkout to the branch head is gone.
- **Pinned.** `bun` has an exact version, every action is pinned by its full commit with its tag in a comment, and the preset smoke runs the VULCAN version the repository pins, never the newest.
- **The credential.** The registry credential is read only by the publish and dist-tag steps.
- **The driver waits.** `make release` keeps waiting while a run waits for approval and says so.
- **A guard test.** `scripts/release/__tests__/release-gates.test.ts` fails when one of these guards is removed from a copy of the workflow.

The packed files of the four packages, and their `package.json`, are identical before and after.

## Who is affected

- **An app or a package.** Nothing.
- **A contributor.** Raising the `bun` version or an action is now a deliberate pull request; the guard test names what to change.
