---
title: The codemod never writes through a symlink
description: ardor codemod namespace skips a tracked symlink, so --write cannot change a file outside the project that the link points to.
packages: ['@venizia/ardor']
---

# Changelog - 2026-11-06

## The codemod never writes through a symlink

<Badge type="info" text="Bug Fix" />

**In one line.** `ardor codemod namespace` listed a tracked symlink to a source file as a file of the project, so `--write` could rewrite the file the link points to, even outside the project. It now skips every symlink, whatever it points to.

## What changed

- **A symlink is not a file to rewrite.** Inside a git repository the list git gives is filtered with `lstat`, and a symlink given as the target is skipped. A link to a folder is still entered when you name it.
- **Nothing else changes.** A real file is listed and written as before.

## Who is affected

- **A project that links source files from elsewhere** (a shared file linked into several apps): run the codemod in the folder that owns the file.
- **All other projects.** No action needed.
