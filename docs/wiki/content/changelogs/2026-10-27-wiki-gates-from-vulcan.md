---
title: The wiki link and anchor gates come from @venizia/vulcan, and the wiki theme is re-copied
description: make wiki-links-check and make wiki-anchors-check now run the gates VULCAN 0.4.6 ships, replacing this repository's own scripts, and the shared wiki theme folder is re-copied from VULCAN v0.4.6 with its shared base.css and a theme entry stub.
packages: []
---

# Changelog - 2026-10-27

## The wiki link and anchor gates come from @venizia/vulcan, and the wiki theme is re-copied

<Badge type="info" text="Tooling" />

**In one line.** ARDOR kept its own copies of the two wiki gates and a theme entry the three Venizia wikis share. Both now come from VULCAN, so a fix lands once. Nothing changes for an app or a package. Planned for 0.4.5.

## What changed

- **The gates are VULCAN's.** `@venizia/vulcan` moves to 0.4.6; `make wiki-links-check` and `make wiki-anchors-check` are its targets, set up in the `Makefile` with `WIKI_REPO := VENIZIA-AI/ardor` and `WIKI_LINKS_FLAGS` (the four generated reference tables stay unread, as before). `scripts/wiki/` and its tests are gone. On the same tree the output is identical before and after: 295 paths checked and 11 anchors checked, 0 missing and 0 broken.
- **The shared theme folder is re-copied from VULCAN v0.4.6** (fingerprint `0eeddbb2a3e6`, the same as VULCAN `develop` at `2252b81`). Two files are new in it: `shared/base.css`, the rules the three wikis share, and `shared/index.ts`, the theme every wiki loads. ARDOR's `index.ts` is now a stub that re-exports it, and the 17 rules of `style.css` that are identical to `base.css` are deleted from it.
- **No page changed.** The computed style and the box of every element of five wiki pages (guides, philosophy, a reference page, the changelog and extensions), in light and dark, at 1440 and 390 px, are identical before and after. The home page varies from one load to the next even before the change (its own animation), so it is not part of that comparison.

## Who is affected

- **An app or a package.** Nothing.
- **A contributor.** The two gate targets are unchanged; `scripts/wiki/` no longer exists. A rule that every wiki should share goes in VULCAN's `shared/base.css`, not in `style.css`.
