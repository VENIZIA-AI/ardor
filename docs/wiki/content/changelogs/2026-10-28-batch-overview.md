---
title: Everything since ARDOR 0.4.4 in one place, with an upgrade checklist
description: A table of every change since 0.4.4 linked to its entry, and the checklist an application follows to move to ARDOR 0.4.5.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-28

## Everything since ARDOR 0.4.4 in one place, with an upgrade checklist

<Badge type="tip" text="New Feature" />

**In one line.** No application changes unless it opts in. The published code differs from 0.4.4 by one option, `fallback` of `useDocumentTitle`.

```bash
bun add @venizia/ardor
```

## What changed

| Kind | Change | Packages | In | Entry |
|------|--------|----------|----|-------|
| New feature | `useDocumentTitle` takes `fallback: true`: a layout's title shows only while no screen title is mounted, so a screen wins on the first mount and the fallback comes back when the screen unmounts | `@venizia/ardor-admin`, `@venizia/ardor` | 0.4.5 | [useDocumentTitle takes fallback](./2026-10-28-document-title-fallback) |

| Package | ARDOR 0.4.4 | ARDOR 0.4.5 |
|---------|------------|--------------|
| `@venizia/ardor` | 0.4.4 | 0.4.5 |
| `@venizia/ardor-kernel` | 0.4.4 | 0.4.5 |
| `@venizia/ardor-react`, `@venizia/ardor-admin` | 0.4.4 | 0.4.5 |

The IGNIS peers do not move: `^0.4.1` on `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin`, and `^0.4.4` on `@venizia/ignis-inversion` for `@venizia/ardor`.

## Who is affected

- **An application on ARDOR 0.4.4.** No action is needed to keep running.
- **An app whose layout and screens both set the tab title.** Step 2.
- **A guest app that builds its own react-admin tree and has no sign-in.** Step 3.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `0.4.5`. The `@venizia/ignis-*` packages stay at `0.4.4` or newer; the peers did not change.
2. **If a layout and a screen both call `useDocumentTitle`:** add `fallback: true` to the layout's call. The screen's title then wins on the first mount, and the layout's shows again when the screen unmounts. Without the flag nothing changes.
3. **If a guest app binds an auth provider it never uses:** delete that `@provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })` method. `ArdorApplication` and `assertArdorApplicationBoots` build a bound auth provider, and one that needs a service the guest does not bind fails the boot test. `skipBindings` of `assertArdorApplicationBoots` reaches the binding check only, so a bound auth provider cannot be skipped: naming `CoreBindings.DEFAULT_AUTH_PROVIDER` there rejects as a skip that matched nothing. A guest app with no sign-in leaves `CoreBindings.DEFAULT_AUTH_PROVIDER` unbound. Keep `DEFAULT_AUTH_SERVICE` if the data provider refreshes a token. See [Providers](../guides/core-concepts/providers#authentication-no-sign-in).

The 0.4.4 changes are in [Everything since ARDOR 0.4.3](./2026-10-26-batch-overview).
