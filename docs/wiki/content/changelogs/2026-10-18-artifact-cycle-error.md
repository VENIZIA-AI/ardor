---
title: start() names a module cycle in the artifact index
description: An artifact index that lists undefined, null or a non-class, which a module cycle leaves behind, makes start() throw an error that names the kind, the position and the cause instead of a TypeError on .name.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-18

## start() names a module cycle in the artifact index

<Badge type="info" text="Bug Fix" />

**In one line.** `start()` fails with `[artifacts] 'services' lists an entry that is not a class (position 1)` and the cause, not with `Cannot read properties of undefined (reading 'name')` (issue #90).

```text
[artifacts] 'services' lists an entry that is not a class (position 1) | Usually an import cycle: the module that imports the index (or @venizia/ignis-boot/auto) must not define decorated classes or be imported by them
```

## What changed

- **The check.** `registerArtifacts()` looks at each entry of each kind of each `artifacts()` index, and of the `content` of a group, before it reads anything from it. An entry that is not a function (`undefined`, `null`, a string, a number) throws the message above, worded as IGNIS's own check is.
- **Why it happens.** In a browser build, the plugin's class list is eager: it imports the module of every decorated class. When the module that imports `@venizia/ignis-boot/auto` also holds a decorated class, or is imported by one, the list is built while that module is still evaluating and the slot is `undefined`. Keep each decorated class in a file of its own and import `AutoArtifacts` from the application module that holds no class.

## Who is affected

- **An application that hit the `TypeError`.** The message now says what to move. Nothing else changes.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `src/base/applications/abstract.ts` | kernel |
