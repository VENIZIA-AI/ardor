---
title: ARDOR is built on IGNIS 0.4.3, and the repository sub-path exports HttpReadShapes
description: The repository sub-path of the kernel and of the umbrella re-exports the whole HTTP module of IGNIS, so the const class HttpReadShapes and its type THttpReadShape that IGNIS 0.4.3 added are importable from ARDOR.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-26

## ARDOR is built on IGNIS 0.4.3, and the repository sub-path exports HttpReadShapes

<Badge type="tip" text="Enhancement" />

**In one line.** ARDOR's own build, tests and checks now run against IGNIS 0.4.3, and `@venizia/ardor-kernel/repository` and `@venizia/ardor/repository` export two more names, `HttpReadShapes` and `THttpReadShape`, because they re-export the HTTP module of `@venizia/ignis-connectors`. Nothing in ARDOR's code changed, and nothing breaks.

## What changed

- **Two new exports on the repository sub-path.** `HttpReadShapes` is a const class with `LIST` (`'list'`: a bare array or the `{ count, data }` envelope) and `ONE` (`'one'`: a single record), `SCHEME_SET` and `isValid(value)`. `THttpReadShape` is its value type. They name the values of the `shape` option of an HTTP repository `read`; the literals `'list'` and `'one'` still work.
- **ARDOR is tested on IGNIS 0.4.3.** The root dependency catalog moves from 0.4.1 to 0.4.3, so ARDOR's build, tests and checks run against it. The peer ranges on `@venizia/ignis-*` stay `^0.4.1`: no ARDOR code needs a newer IGNIS.

## Who is affected

- **An application that imports from `@venizia/ardor/repository` or `@venizia/ardor-kernel/repository`.** No action. To use the two new names, the app needs `@venizia/ignis-connectors` 0.4.3 or newer; on 0.4.1 or 0.4.2 the names are not there.
- **An application that reads the IGNIS changes.** IGNIS 0.4.3 has changes of its own (among them the removal of deprecated model settings keys and a write guard for `scopeFilter`); they are in the IGNIS changelog, and ARDOR does not use them.

## Details

- The names come from `export * from '@venizia/ignis-connectors/http'` in `packages/kernel/src/base/repositories/index.ts`; the generated reference `.agents/knowledge/reference/public-surface.md` lists them (23 names on that sub-path, 21 before).
