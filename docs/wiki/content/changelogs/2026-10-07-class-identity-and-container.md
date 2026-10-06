---
title: Class identity survives a minifier, and the container fixes from IGNIS
description: ARDOR adopts IGNIS kernel 0.2.1-3 and inversion 0.2.1-0 - a pinned datasource resolves minified, start() refuses two classes deriving one key.
---

# Changelog - 2026-10-07

## Class identity survives a minifier, and the container fixes from IGNIS

<Badge type="warning" text="Behavior Change" />

**In one line.** ARDOR moves to IGNIS kernel `0.2.1-3` and inversion `0.2.1-0`. A repository finds a pinned datasource after a minifier renames it, `start()` refuses two classes that derive one key instead of letting the second silently replace the first, and the container gains five correctness fixes.

## What changed

- **A repository resolves its datasource by class.** Without `@inject` on its first parameter, `@repository` used to ask for `datasources.<ClassName>`, read from the class name at decoration, so a datasource with a pinned `binding` broke in a minified build. It now records the class, and the key recorded on it wins: `@datasource({ binding })`, `bindingList()` and `dataSource(X, { binding })` all hold. A raw `bind({ key }).toClass(X)` falls back to the derived key, as before.
- **`start()` refuses a derived key collision.** `registerArtifacts()` throws `[registerArtifacts] Two classes derive the binding key '<key>' ...` when two different discovered classes derive one key from their name. A pinned `binding` is never counted, nor is a subclass discovered after its same-named parent. The check runs at `start()`, never at decoration, so a hot reload is not an error.
- **One key derivation.** `service()`, `repository()`, `dataSource()`, `component()` and `injectable()` derive their key through IGNIS's `ArtifactBindingKeys.resolve`, re-exported from `@venizia/ardor`, instead of two ARDOR copies.
- **The container (inversion `0.2.1-0`).**

| Fix | What it means for an application |
|---|---|
| Property `@inject` is per class | A subclass's injected property no longer becomes a requirement of its parent and siblings. |
| `isOptional` on `{ target }` | An unregistered class resolves to `undefined` instead of throwing. |
| Named cycles | A synchronous cycle throws `Circular dependency \| a -> b -> a` instead of a stack overflow. |
| Falsy singletons | `null`, `false`, `0`, `''` and `undefined` cache, and `clear()` clears them. |
| Symbol keys | Two `Symbol('x')` keys no longer share one binding. |

A rejected singleton promise stays cached until the container is cleared, on purpose. Keep `@provide` methods synchronous, or catch inside them.

- **Peers.** Every IGNIS peer leaves the caret range, which never admits a prerelease:

| Package | Before | Now |
|---|---|---|
| `@venizia/ignis-inversion` | `^0.2.0` | `>=0.2.1-0 <0.3.0` |
| `@venizia/ignis-kernel` | `>=0.2.1-2 <0.3.0` | `>=0.2.1-3 <0.3.0` |
| `@venizia/ignis-connectors` | `>=0.2.1-4 <0.3.0` | `>=0.2.1-5 <0.3.0` |
| `@venizia/ignis-filter`, `-helpers` | `>=0.2.1-0 <0.3.0` | `>=0.2.1-1 <0.3.0` |

## Who is affected

- **Applications on IGNIS inversion `0.2.0`.** Install kernel `0.2.1-3` and inversion `0.2.1-0` together: the class-first rule lives in inversion, and an older one still reads the derived key first.
- **Applications with two discovered classes of one name and no pinned `binding`.** `start()` now throws. Pin `binding` on one of them, or build with class names kept.
- **Code that relied on a parent class not seeing a subclass's property `@inject`, or on `isOptional` being ignored for `{ target }`.** Both now behave as documented.

See [Repositories](../references/repository#registering-a-repository) and [Application](../references/application#preconfigure).
