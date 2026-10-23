---
title: One code style, set in one bunfig.toml
description: ARDOR's own code is formatted with bun fmt from one root bunfig.toml, in the node style of IGNIS - no parentheses on a single arrow parameter - and the oxfmt config files are gone.
packages: []
---

# Changelog - 2026-10-23

## One code style, set in one bunfig.toml

<Badge type="info" text="Enhancement" />

**In one line.** The code of ARDOR's packages, wiki and scripts is formatted by `bun fmt` from the `[fmt]` section of the root `bunfig.toml`, in the one style IGNIS uses, and the `oxfmt.config.mts` files are gone.

## What changed

- **One style.** `printWidth` 100, single quotes, and `arrowParens` set to `avoid`: a single arrow parameter has no parentheses (`items.map(item => item.id)`), and the closing `>` of a multi-line JSX element goes on its own line. Backend and frontend code now look alike.
- **One place.** The style lives in the root `bunfig.toml`. `make lint`, `make lint-fix` and `make lint-all` run `bun fmt` in the project folder with a glob, which finds the root file, and no package keeps a formatter config.
- **`flavor = "oxfmt"`.** This line keeps the output of oxfmt. Without it Bun takes the Prettier flavor as soon as `oxfmt` is not in `package.json`, and a file or two come out different.
- **A one-time reformat.** 54 files changed (arrow parentheses and JSX brackets only), in a commit of their own.

## Who is affected

- **A contributor with a branch in progress.** Run `make lint-fix` after you merge `develop`; the reformat can touch the lines you edited.
- **A project generated from the preset.** No action needed. The examples and the presets keep formatting through `devz lint` with their own config until `@venizia/dev-configs` ships a `devz` that reads the bunfig.
