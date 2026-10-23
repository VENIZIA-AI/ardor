---
title: The repository formats with bun fmt
description: ARDOR's own make targets format with bun fmt, using the same oxfmt config file, so the formatted result is unchanged.
packages: []
---

# Changelog - 2026-10-23

## The repository formats with bun fmt

<Badge type="info" text="Enhancement" />

**In one line.** `make lint`, `make lint-fix` and `make lint-all` format with `bun fmt` instead of calling `oxfmt`, and every file comes out exactly as before.

## What changed

- **`bun fmt` with the oxfmt config.** The make targets of the packages, the wiki and `scripts/` run `bun fmt --no-script --config .configs/formatters/oxfmt.config.mts` with the glob of the repository. The config file still decides the style: a bare `bun fmt` would format `md` and `json` too, and it picks its flavor from `package.json`, so `oxfmt` stays in the devDependencies.
- **Same result.** On every package and the wiki, `bun fmt --check` and `oxfmt --check` report no difference, and both fail on a planted error.
- **Unchanged.** The three examples and the app and library presets still format through `devz lint`, which runs `oxfmt` itself. They move when `@venizia/dev-configs` ships a `devz` that formats with `bun fmt`.

## Who is affected

- **A contributor.** Nothing to do: `make lint-all` and `make lint-fix` work as before, and the pre-commit hook runs the same gate.
- **A project generated from the preset.** No action needed; its formatter is unchanged.
