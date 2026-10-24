---
title: scripts/ is grouped by purpose
description: The repository's root scripts live in release, preset, checks, build and wiki folders, each with its own tests, and scripts/README.md says what calls each one.
packages: []
---

# Changelog - 2026-10-24

## scripts/ is grouped by purpose

<Badge type="info" text="Enhancement" />

**In one line.** The root tooling of the repository moved from one flat `scripts/` folder into five groups, with a README table that says what each script does and what calls it. Nothing about how they behave changed.

## What changed

- **Five groups.** `release/` (the release plan, version, scope, tarball wait and the publish gates), `preset/` (writing the VULCAN presets and the preset smoke), `checks/` (the catalog, layer, cycle, purity, clean-install and atlas gates, and the split report), `build/` (`force-update.sh` and the catalog refresh) and `wiki/` (the anchor and source-link checks).
- **Tests next to their group.** Each group keeps its tests in its own `__tests__/` folder; `make test-scripts` runs them, and the purity tests still run under `make purity-test`.
- **A table.** `scripts/README.md` lists every script with its group, what it does and what calls it (a make target, a workflow step or another script).
- **Files moved with history.** Every path in the make files, the workflows, the `package.json` scripts, the scripts' own imports and the docs was rewritten, and a check found no reference that points nowhere.

## Who is affected

- **A maintainer.** The release is still `bun scripts/release/release.ts --version <x.y.z> --issue <N> --yes`, dry run first; the old path `scripts/release.ts` is gone.
- **A contributor.** Use the make targets as before. A local command that named a script by its old path needs the new one from the README table.
