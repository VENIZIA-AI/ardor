---
title: The wiki changelog is a filterable list with an RSS feed
description: The changelog opens on a list of every entry with the latest set apart, filter tabs and a feed at /changelog.xml; its Introduction and Template pages are gone.
packages: []
---

# Changelog - 2026-10-27

## The wiki changelog is a filterable list with an RSS feed

<Badge type="tip" text="Enhancement" />

**In one line.** The changelog page lists every entry, newest first, with filter tabs and a feed. It changes the wiki only: no package changes, so an application has nothing to do. Available in 0.4.4.

## What changed

- **A list instead of a table.** The newest entry is set apart as Latest; the rest are grouped by year, each with its date, type, title, a short summary and the packages and version. Tabs filter by type (All, Releases, Features, Fixes, Security, Breaking). The list is built from the entries themselves, so a new entry needs no row.
- **A feed.** `/changelog.xml` carries every entry as RSS 2.0, and the pages link it in their head.
- **An entry page opens with a title block**: a link back to the list, the date, the type chips, the title, the packages and the version. The entry's own heading and badge line are hidden on the page and stay in the source.
- **No sidebar under Changelogs, no Introduction page, no Template page.** The list is the way in. The template to copy is the knowledge page `.agents/knowledge/process/writing-a-changelog-entry.md`.
- **Optional frontmatter.** `summary:` replaces the description on the card, `type: release` marks a release overview, and `release:` places a backfilled entry.

## Who is affected

- **An application on ARDOR.** No action needed.
- **A contributor who writes an entry.** Copy the template from the knowledge page; there is no table row and no sidebar link to add, and `docs/wiki/scripts/changelogs.mts` is gone.

## Details

- The components and the parser are the shared theme folder, copied from VULCAN and covered by the same drift test as the rest of it.
