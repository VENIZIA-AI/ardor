---
title: A feature library preset
description: vulcan add --preset ardor --lib <name> adds an ARDOR feature package to a monorepo, with a sample feature, a test that mounts it, and the same scripts and lint setup as the app.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-21

## A feature library preset

<Badge type="tip" text="New Feature" />

**In one line.** `vulcan add --preset ardor --lib merchant` adds an ARDOR feature package to a monorepo, next to the app that `--app` adds.

## What changed

- **A library kind.** `@venizia/ardor` now ships a library preset beside its app preset. The package it makes exports `.` from `./src/index.ts`, imports its own modules as `#src/...`, and takes its versions from the monorepo's catalog.
- **Peers, not copies.** `@venizia/ardor`, `react`, `react-dom`, `react-router-dom` and `reflect-metadata` are peer dependencies, so each app decides the versions.
- **A sample feature and its test.** `src/feature.ts` is `Features.define({ name })`, and `src/__tests__/feature.test.ts` mounts it in a small application and reads it back.
- **Five scripts.** `typecheck`, `lint`, `lint:fix`, `test` and `clean`: no bundler, no dev server, no `compile`.
- **Same lint setup as the app.** `scripts/lint.sh`, and the oxlint, oxfmt and eslint configs of the app preset.

## Who is affected

- **A monorepo with ARDOR apps.** Nothing changes. A new library is added only when you run the command; it needs the VULCAN release that supports library presets.
- **A package that used to be copied by hand.** Add one with the command and move the feature into it.
