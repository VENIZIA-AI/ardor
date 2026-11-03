---
title: The repository sub-path exports HttpReadShapes
description: The repository sub-path re-exports the HTTP module of IGNIS, so HttpReadShapes and THttpReadShape from IGNIS 0.4.3 are importable from ARDOR.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-26

## The repository sub-path exports HttpReadShapes

<Badge type="tip" text="Enhancement" />

**In one line.** `@venizia/ardor-kernel/repository` and `@venizia/ardor/repository` export two more names, `HttpReadShapes` and `THttpReadShape`, because they re-export the HTTP module of `@venizia/ignis-connectors`. Nothing breaks.

## What changed

- **`HttpReadShapes`** is a const class with `LIST` (`'list'`: a bare array or the `{ count, data }` envelope) and `ONE` (`'one'`: a single record), `SCHEME_SET` and `isValid(value)`. **`THttpReadShape`** is its value type. They name the values of the `shape` option of an HTTP repository `read`; the literals `'list'` and `'one'` still work.
- The peer ranges on `@venizia/ignis-*` stay `^0.4.1`.

## Who is affected

- **An application that imports from `@venizia/ardor/repository` or `@venizia/ardor-kernel/repository`.** No action. To use the two new names, the app needs `@venizia/ignis-connectors` 0.4.3 or newer; on 0.4.1 or 0.4.2 the names are not there.
