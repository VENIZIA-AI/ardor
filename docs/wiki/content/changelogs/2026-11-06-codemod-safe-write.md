---
title: The codemod writes all files or none, and refuses outside git
description: ardor codemod namespace --write stages every file, names a file it cannot rewrite and writes nothing then, and needs --allow-dirty outside a git repository.
packages: ['@venizia/ardor']
---

# Changelog - 2026-11-06

## The codemod writes all files or none, and refuses outside git

<Badge type="warning" text="Behavior Change" /> <Badge type="info" text="Bug Fix" />

**In one line.** `ardor codemod namespace --write` now reads and rewrites every file in memory first and writes only when all of them went through, so a file it cannot handle no longer leaves the project half rewritten.

## What changed

- **All or none.** A file that cannot be parsed or rewritten, or that is not valid UTF-8 and would change, is listed as `failed <path>: <reason>`; nothing is written and the exit code is 1. Before, the run stopped with a raw error after some files were already written. A file that is not valid UTF-8 and needs no change is not a failure.
- **Outside git it asks first.** In a folder that is not a git repository nothing can undo a write, so `--write` refuses with exit code 1 unless you add `--allow-dirty`. A dry run and `--check` work anywhere.
- **The write itself is staged.** Each changed file is written next to itself first and all are renamed into place only when every one was written, so a full disk or a read-only folder leaves no file changed. A file that is not the file that was read (a symlink swapped in, an edit made meanwhile) is refused as `failed`, a hard link is not written through, and the file mode is kept.
- **Odd input is handled.** A path that does not exist exits 2, a file that is not a TypeScript source file is left alone even when named, and any control, format or line-separator character in a printed path or reason is shown as `?`.

## Who is affected

- **A project that runs `--write` outside a git repository** (a CI step on an exported tree, for example): add `--allow-dirty`.
- **All other projects.** No action needed.
