---
title: The knowledge log is gone
description: The knowledge bundle no longer keeps a log.md of its changes; history lives in git and the changelogs, and a generated project does not get one either.
packages: []
---

# Changelog - 2026-10-24

## The knowledge log is gone

<Badge type="info" text="Enhancement" />

**In one line.** `.agents/knowledge/log.md` is deleted, and rule P-03 no longer asks for a log line with each change.

## What changed

- **No log file.** The log was a long list that every pull request had to edit, which made merge conflicts constant. What changed and why is in git history and in the changelog entries.
- **P-03 keeps what mattered.** It now only says that generated content is never edited by hand and comes from `make okf-gen` and `make surface-gen`; updating a concept in the same change as the code is the VULCAN base rule V-P-04.
- **VULCAN 0.3.13.** The repository pins it. A project made by `vulcan init` or `vulcan add` has no `log.md` in its knowledge bundle, and the knowledge-sync skill no longer needs one.

## Who is affected

- **A contributor.** Update the concept page that documents a fact when you change it; do not add a log entry.
- **A project generated before 0.3.13.** It may still hold a `log.md`; nothing reads it, and it can be deleted.
