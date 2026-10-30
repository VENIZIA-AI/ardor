---
title: Class identity survives a minifier
description: A pinned datasource resolves in a minified build, and start() refuses two classes that derive one binding key. The IGNIS peer floors rise with it.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-07

## Class identity survives a minifier

<Badge type="warning" text="Behavior Change" />

**In one line.** A repository finds a pinned datasource after a minifier renames it, and `start()` refuses two classes that derive one key instead of letting the second silently replace the first.

## What changed

- **A repository resolves its datasource by class.** Without `@inject` on its first parameter, `@repository` used to ask for `datasources.<ClassName>`, so a datasource with a pinned `binding` broke in a minified build. The key recorded on the class now wins: `@datasource({ binding })`, `bindingList()` and `dataSource(X, { binding })` all hold. A raw `bind({ key }).toClass(X)` falls back to the derived key, as before.
- **`start()` refuses a derived key collision.** It throws `[registerArtifacts] Two classes derive the binding key '<key>' ...` when two different discovered classes derive one key from their name. A pinned `binding` is never counted, nor is a subclass discovered after its same-named parent. The check runs at `start()`, never at decoration, so a hot reload is not an error.
- **Peers.** Every IGNIS peer leaves the caret range, which never admits a prerelease, and the floors rise to the IGNIS releases that carry the container fixes:

| Package | Before | Now |
|---|---|---|
| `@venizia/ignis-inversion` | `^0.2.0` | `>=0.2.1-0 <0.3.0` |
| `@venizia/ignis-kernel` | `>=0.2.1-2 <0.3.0` | `>=0.2.1-3 <0.3.0` |
| `@venizia/ignis-connectors` | `>=0.2.1-4 <0.3.0` | `>=0.2.1-5 <0.3.0` |
| `@venizia/ignis-filter`, `-helpers` | `>=0.2.1-0 <0.3.0` | `>=0.2.1-1 <0.3.0` |

## Who is affected

- **Applications on IGNIS inversion `0.2.0`.** Install kernel `0.2.1-3` and inversion `0.2.1-0` together: the class-first rule lives in inversion, and an older one still reads the derived key first.
- **Applications with two discovered classes of one name and no pinned `binding`.** `start()` now throws. Pin `binding` on one of them, or build with class names kept.

See [Repositories](../references/repository) and [Application](../references/application).
