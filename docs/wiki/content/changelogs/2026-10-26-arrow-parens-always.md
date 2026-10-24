---
title: An arrow function parameter always has parentheses
description: The bun fmt style sets arrowParens to always, and the repository is reformatted once.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-26

## An arrow function parameter always has parentheses

<Badge type="tip" text="Enhancement" />

**In one line.** `bunfig.toml` sets `arrowParens = "always"`, so `(item) => item.id` replaces `item => item.id`, and every file of the repository is formatted that way.

## What changed

- **The style.** The `[fmt]` section of the root `bunfig.toml` keeps `printWidth = 100`, `singleQuote = true` and `flavor = "oxfmt"`, and `arrowParens` goes from `"avoid"` to `"always"`.
- **One reformat.** Every file that had an arrow function with a bare parameter was rewritten in one commit; the rest is untouched, and the lines that grew past the print width were wrapped.

## Who is affected

- **A project created from a preset.** It formats with the same `bun fmt` and the same root style; run `bun fmt` once to get the new form.
- **A branch with open changes.** Rebase onto the reformat commit and run `bun fmt`; the conflicts are only parentheses.
