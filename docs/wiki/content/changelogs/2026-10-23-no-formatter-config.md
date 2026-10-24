---
title: No project keeps a formatter config any more
description: The examples and the app and library presets format with bun fmt like the rest of ARDOR, from the root bunfig.toml, and a generated app no longer carries an oxfmt config.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-23

## No project keeps a formatter config any more

<Badge type="info" text="Enhancement" />

**In one line.** An app made from the ARDOR preset has no formatter config file: `devz lint` formats it with `bun fmt`, in the style of the `bunfig.toml` at the root of the monorepo.

## What changed

- **No `oxfmt.config.mts`.** The app preset no longer ships `.configs/formatters/oxfmt.config.mts`, the three examples lost theirs, and no `package.json` or catalog lists a formatter package. `.configs/formatters/.ignore` stays: its patterns still go to `bun fmt` as paths to skip.
- **One style.** The examples and every generated app follow the root `bunfig.toml`: single quotes, a print width of 100, and no parentheses around a single arrow parameter. The examples were reformatted once, in a commit of their own (arrow parentheses and the closing `>` of JSX elements).
- **More than code.** `bun fmt` also covers json, yaml, css, html and vue, markdown excepted: the lint of ARDOR's own projects checks them, and the tracked files outside any project (the CI and release workflows, the agent files, the presets) are checked by two new targets, `make lint-files` and `make fmt-files`. A one-time reformat touched eleven files; the workflows only changed their quotes, and their parsed content is identical.
- **Smaller installs.** The lockfile drops `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier` and the `oxfmt` bindings.

## Who is affected

- **A new app.** Nothing to do: the monorepo that `vulcan init` creates has the `bunfig.toml`, and the app has no formatter config.
- **An app already generated from the preset.** Run `devz lint --fix` after you move to the `@venizia/dev-configs` and VULCAN releases that format with `bun fmt`, then delete `.configs/formatters/oxfmt.config.mts` and the `oxfmt` entry of its `package.json`. The first run reformats code that used `(x) => x`.
- **A project that keeps its own formatter config.** A `.oxfmtrc.json`, `.oxfmtrc.jsonc` or `oxfmt.config.ts` is read by `bun fmt` and overrides the `bunfig.toml`; remove it to follow the root file.
