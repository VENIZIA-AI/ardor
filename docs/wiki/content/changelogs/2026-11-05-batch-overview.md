---
title: Everything since ARDOR 0.4.7 in one place, with an upgrade checklist
description: A table of every change since 0.4.7 linked to its entry, the IGNIS peer versions, and the ordered checklist an application follows to move to ARDOR 0.4.8.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-05

## Everything since ARDOR 0.4.7 in one place, with an upgrade checklist

<Badge type="warning" text="Breaking Change" /> <Badge type="warning" text="Behavior Change" /> <Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" /> <Badge type="info" text="Bug Fix" />

**In one line.** ARDOR 0.4.8 removes `useSizer`, renames `useInjectableContainer` to `useApplicationContainer`, and stops depending on `lodash`, so an application on 0.4.7 changes a few names. The prerelease ARDOR 0.4.8-4 also peers on prerelease IGNIS ranges, so it changes its IGNIS versions too. The release adds new hooks and helpers and a default token refresh.

```bash
bun add @venizia/ardor
```

## What changed

| Kind | Change | Packages | Entry |
|------|--------|----------|-------|
| Breaking Change | `useSizer` is removed; `useElementSize` does its job | `@venizia/ardor-react`, `@venizia/ardor` | [useSizer is removed](./2026-11-04-remove-use-sizer) |
| Breaking Change | `useInjectableContainer` is `useApplicationContainer`, with no alias | `@venizia/ardor-react`, `@venizia/ardor` | [useApplicationContainer](./2026-11-04-application-container) |
| Behavior Change | A `refreshTokenPath` now refreshes the token without a subclass, so an app that set the path only to stop a loop sends a refresh request | `@venizia/ardor-kernel`, `@venizia/ardor-admin`, `@venizia/ardor` | [Default token refresh](./2026-11-04-default-token-refresh) |
| Enhancement | `@venizia/ardor-react` and `@venizia/ardor-admin` no longer depend on `lodash` | `@venizia/ardor-react`, `@venizia/ardor-admin` | [No lodash](./2026-11-04-drop-lodash) |
| New feature | `useResizeEffect` runs one callback when any of several elements resizes | `@venizia/ardor-react`, `@venizia/ardor` | [useResizeEffect](./2026-11-04-resize-effect-hook) |
| New feature | `useIntersection` tells whether an element is in view | `@venizia/ardor-react`, `@venizia/ardor` | [useIntersection](./2026-11-04-intersection-hook) |
| New feature | `useMediaQuery`, `useDocumentVisibility` and `useOnlineStatus` | `@venizia/ardor-react`, `@venizia/ardor` | [Browser state hooks](./2026-11-04-browser-state-hooks) |
| New feature | `useCopyToClipboard` returns `isCopied` and takes `resetMs` | `@venizia/ardor-react`, `@venizia/ardor` | [isCopied](./2026-11-04-copy-is-copied) |
| New feature | `useStoredState` takes `writeDelayMs`, one storage write after a burst | `@venizia/ardor-react`, `@venizia/ardor` | [writeDelayMs](./2026-11-04-stored-state-write-delay) |
| Bug fix | `useStoredState` updaters compose, and the sign-out order is documented | `@venizia/ardor-react`, `@venizia/ardor` | [Chained updaters](./2026-11-04-stored-state-chained-updaters) |
| New feature | `BrowserStorage.keys` and `removeWhere` list and sweep keys by prefix | `@venizia/ardor-kernel`, `@venizia/ardor` | [Storage keys](./2026-11-04-browser-storage-keys) |
| New feature | `StorageCodecs.text` reads and writes a bare string | `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor` | [Text codec](./2026-11-04-storage-text-codec) |
| New feature | `BrowserClipboard.writeText` and `readText` work outside React and never throw | `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor` | [Clipboard helper](./2026-11-04-clipboard-helper) |
| New feature | `useUntypedTranslate` translates a key that exists only at run time | `@venizia/ardor-admin`, `@venizia/ardor` | [useUntypedTranslate](./2026-11-04-untyped-translate-hook) |
| Breaking Change | `ISendResponse` and `IListFilter.offset` are removed; use `INetworkResponse` and `skip` | `@venizia/ardor-kernel`, `@venizia/ardor-admin`, `@venizia/ardor` | [Aliases removed](./2026-11-05-remove-aliases) |
| Enhancement | The packages no longer ship source maps or declaration maps; the kernel tarball goes from 127 to 69 files | all four | this entry |
| Breaking Change | ARDOR 0.4.8-4 (prerelease) peers on IGNIS `^0.4.8-3` and `^0.4.7-2`, so IGNIS 0.4.7 and the earlier IGNIS prereleases do not satisfy them; the stable 0.4.8 takes stable IGNIS ranges | all four | this entry |

The `Ardor` namespace holds 30 hooks (25 in 0.4.7), and `ardor codemod namespace --hooks` knows each of them.

| Package | ARDOR 0.4.7 | ARDOR 0.4.8 |
|---------|-------------|-------------|
| `@venizia/ardor`, `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor-admin` | 0.4.7 | 0.4.8 |

| Peer | ARDOR 0.4.7 | ARDOR 0.4.8-4 (prerelease) |
|------|-------|-------|
| `@venizia/ignis-helpers`, `-kernel`, `-connectors`, `-boot` | `^0.4.7` | `^0.4.8-3` |
| `@venizia/ignis-inversion`, `-filter` | `^0.4.6` | `^0.4.7-2` |

In ARDOR 0.4.8-4, a range that starts at a prerelease (`^0.4.8-3`) matches 0.4.8-3 and every later 0.4.8 version, and it does not match IGNIS 0.4.7 or 0.4.8-2. IGNIS inversion and filter are published as 0.4.7-2, so `^0.4.7-2` is the range that matches them. Install the IGNIS versions that satisfy these ranges before you install ARDOR 0.4.8-4. (ARDOR 0.4.8-1 to 0.4.8-3 peer on `^0.4.8-0` / `^0.4.7-0`, `^0.4.8-1` / `^0.4.7-1` and `^0.4.8-2` / `^0.4.7-2`.) The stable 0.4.8 takes stable IGNIS ranges, refreshed by the stable release run; these are not its ranges.

## Who is affected

- **An application that moves to 0.4.8-4 on IGNIS 0.4.7 or an earlier prerelease.** Step 1.
- **An application that calls `useSizer`.** Step 2.
- **An application that calls `useInjectableContainer`, or `Ardor.useInjectableContainer`.** Step 3.
- **An application that imported `lodash` and relied on ARDOR to install it.** Step 4.
- **An application that set `authRecovery.refreshTokenPath`.** Step 5.
- **A tool that reads the source maps of an ARDOR package in `node_modules`.** Step 6.
- **An application that names `ISendResponse` or sets `offset` on a list filter.** Step 7.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `0.4.8`, and every `@venizia/ignis-*` package to a version that satisfies the peers of the ARDOR version you install. For 0.4.8-4 they are in the table above.
2. **If you call `useSizer`,** give the element a `ref` and call `useElementSize({ ref, box: 'border-box', round: true })`. The value is close to what `useSizer` read, not the same, and the hook also returns `measured`. See [useSizer is removed](./2026-11-04-remove-use-sizer).
3. **If you call `useInjectableContainer`,** find and replace it with `useApplicationContainer`. The codemod does not rename it. See [useApplicationContainer](./2026-11-04-application-container).
4. **If you import `lodash` in your own code,** add it to your `package.json`; ARDOR no longer installs it. A `useDeepEqualSelector` selector that returns a `Map`, a `Set` or a class instance now re-renders whenever the instance changes. See [No lodash](./2026-11-04-drop-lodash).
5. **If you set `authRecovery.refreshTokenPath` and the auth service is bound,** a `401` now sends a POST with no body to that path. The expired token is attached only when the path is not in `noAuthPaths`. If the path is not a refresh endpoint, remove the setting or override `refreshToken`. If your own `refreshToken` subclass only posts to the path and saves the token, delete it. See [Default token refresh](./2026-11-04-default-token-refresh).
6. **If a tool reads the source maps of an ARDOR package** (a source-map loader warning, a debugger that opens `node_modules/@venizia/ardor-*/dist/**/*.map`), it finds none; stack traces point into `dist`.
7. **If you name `ISendResponse` or set `offset` on a list filter,** run `ardor codemod namespace src --write`: it renames `ISendResponse` to `INetworkResponse`, and `--check` lists each `.offset` to change to `skip`. See [Aliases removed](./2026-11-05-remove-aliases).
8. **Optional: use the new hooks and helpers** in place of your own subscribe-and-cleanup code. Each entry in the table has an example.

An application on 0.4.6 or older follows the earlier overviews first: see [Upgrading ARDOR](../guides/migrations/upgrading-ardor).
