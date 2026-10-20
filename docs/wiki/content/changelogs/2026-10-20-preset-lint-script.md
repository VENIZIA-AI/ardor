---
title: The preset app's lint scripts are short
description: The generated admin's package.json runs sh scripts/lint.sh for lint and lint:fix. The logic is a shipped, readable shell file, and the preset smoke proves it checks and fixes.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## The preset app's lint scripts are short

<Badge type="tip" text="Enhancement" />

**In one line.** In an app made by `vulcan init --preset ardor`, `lint` is `sh scripts/lint.sh` and `lint:fix` is `sh scripts/lint.sh --fix`; the commands live in `scripts/lint.sh`.

## What changed

- **One readable file.** `scripts/lint.sh` runs oxlint, eslint (with a cache in `node_modules/.cache/eslint/`) and oxfmt: the check by default, the fixes with `--fix`. Each tool is one line, so changing a flag no longer means editing a long chained command in `package.json`.
- **The smoke proves it.** The preset smoke plants a badly formatted file in the generated app, expects `bun run lint` to fail, runs `bun run lint:fix`, and expects `bun run lint` to pass again.

## Who is affected

- **An app already generated from the preset.** Nothing breaks. To use the same layout, copy `scripts/lint.sh` from a newly generated app and set `lint` and `lint:fix` as above.
- **A new app.** It starts with the short scripts.
