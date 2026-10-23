---
title: The keys of package.json are sorted and checked
description: ARDOR's package.json files keep their keys in the standard order, bun fmt sorts them, and make lint fails when one is out of order.
packages: []
---

# Changelog - 2026-10-23

## The keys of package.json are sorted and checked

<Badge type="info" text="Enhancement" />

**In one line.** Every `package.json` of the repository now has its keys in the standard order, and `make lint` fails on one that is out of order.

## What changed

- **Sorted once.** The root, the four packages, the wiki and the three examples were sorted in a commit of their own. Nothing but the order moved: the data, the order of `exports` and the contents of every array stay the same, apart from `keywords`, which is now alphabetical.
- **Checked by lint.** The glob of `make lint` and `make lint-fix` names `package.json` next to the code, and `make lint-root` (part of `make lint-all`) checks the root manifest. `make lint-fix` sorts what is out of order.
- **A release keeps it.** The version bump changes only the `version` line, and the range refresh rewrites ranges in place, so a release leaves the keys where they are.

## Who is affected

- **A contributor.** When you add a dependency by hand, `make lint-fix` puts the key in order; `bun add` already keeps dependencies sorted.
- **A project generated from the preset.** No action needed. The preset's own manifest template follows in a later change.
