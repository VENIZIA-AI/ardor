---
title: The preset's typecheck runs bun check
description: The generated admin type-checks with bun check, which reports the same errors as tsc in a fraction of the time. The preset smoke plants a type error to prove the check still fails.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## The preset's typecheck runs bun check

<Badge type="tip" text="Enhancement" />

**In one line.** In an app made by `vulcan init --preset ardor`, `bun run typecheck` runs `bun check --no-pretty -p tsconfig.json` instead of `tsc --noEmit -p tsconfig.json`.

## What changed

- **Same errors, less time.** On the generated admin (React, JSX and decorators) `bun check` reports exactly the errors `tsc` reports: eleven planted errors (a wrong type, an unknown export, a prop that does not exist, a decorator option that does not exist, an unused value) and a decorator on the wrong target produced the same codes at the same positions from both. It finishes in under a tenth of a second where `tsc` takes about a second.
- **The smoke proves it.** The preset smoke plants a type error in the generated app, expects `bun run typecheck` to fail, and removes it again.

## Who is affected

- **An app already generated from the preset.** Nothing breaks. To use the same check, change its `typecheck` script to `bun check --no-pretty -p tsconfig.json`; `typescript` stays a dev dependency for the editor and the build config.
- **A new app.** It uses `bun check` from the start.
