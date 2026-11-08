---
title: Everything since ARDOR 0.4.7 in one place, with an upgrade checklist
description: A table of every change since 0.4.7 linked to its entry, the IGNIS peer versions, and the ordered checklist an application follows to move to ARDOR 0.4.8.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-05

## Everything since ARDOR 0.4.7 in one place, with an upgrade checklist

<Badge type="warning" text="Breaking Change" /> <Badge type="warning" text="Behavior Change" /> <Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" /> <Badge type="info" text="Bug Fix" />

**In one line.** ARDOR 0.4.8 removes `useSizer`, renames `useInjectableContainer` to `useApplicationContainer`, and stops depending on `lodash`, so an application on 0.4.7 changes a few names. The prerelease ARDOR 0.4.8-8 also peers on prerelease IGNIS ranges, so it changes its IGNIS versions too. The release adds new hooks and helpers and a default token refresh.

```bash
bun add @venizia/ardor
```

## What changed

Each change has its own entry in the [changelog list](./), newest first.

The `Ardor` namespace holds 30 hooks (25 in 0.4.7), and `ardor codemod namespace --hooks` knows each of them.

| Package | ARDOR 0.4.7 | ARDOR 0.4.8 |
|---------|-------------|-------------|
| `@venizia/ardor`, `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor-admin` | 0.4.7 | 0.4.8 |

| Peer | ARDOR 0.4.7 | ARDOR 0.4.8-8 (prerelease) |
|------|-------|-------|
| `@venizia/ignis-helpers`, `-kernel`, `-connectors`, `-boot` | `^0.4.7` | `^0.4.8-7` |
| `@venizia/ignis-inversion` | `^0.4.6` | `^0.4.7-3` |
| `@venizia/ignis-filter` | `^0.4.6` | `^0.4.7-4` |

In ARDOR 0.4.8-8, a range that starts at a prerelease (`^0.4.8-7`) matches 0.4.8-7 and every later version below 0.5.0, and it does not match IGNIS 0.4.7 or 0.4.8-6. IGNIS inversion is published as 0.4.7-3 and filter as 0.4.7-4, so `^0.4.7-3` matches inversion and `^0.4.7-4` matches filter. Install the IGNIS versions that satisfy these ranges before you install ARDOR 0.4.8-8. (ARDOR 0.4.8-1 to 0.4.8-7 peer on `^0.4.8-0` / `^0.4.7-0`, `^0.4.8-1` / `^0.4.7-1`, `^0.4.8-2` / `^0.4.7-2`, `^0.4.8-3` / `^0.4.7-2`, `^0.4.8-4` / `^0.4.7-2` and `^0.4.8-5` / `^0.4.7-3` (filter) and `^0.4.7-2` (inversion), then `^0.4.8-6` / `^0.4.7-4` (filter) and `^0.4.7-3` (inversion).) The stable 0.4.8 takes stable IGNIS ranges, refreshed by the stable release run; these are not its ranges.

## Who is affected

- **An application that moves to 0.4.8-8 on IGNIS 0.4.7 or an earlier prerelease.** Step 1.
- **An application that calls `useSizer`.** Step 2.
- **An application that calls `useInjectableContainer`, or `Ardor.useInjectableContainer`.** Step 3.
- **An application that imported `lodash` and relied on ARDOR to install it.** Step 4.
- **An application that set `authRecovery.refreshTokenPath`.** Step 5.
- **A tool that reads the source maps of an ARDOR package in `node_modules`.** Step 6.
- **An application that names `ISendResponse` or sets `offset` on a list filter.** Step 7.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `0.4.8`, and every `@venizia/ignis-*` package to a version that satisfies the peers of the ARDOR version you install. For 0.4.8-8 they are in the table above.
2. **If you call `useSizer`,** give the element a `ref` and call `useElementSize({ ref, box: 'border-box', round: true })`. The value is close to what `useSizer` read, not the same, and the hook also returns `measured`. See [useSizer is removed](./2026-11-04-remove-use-sizer).
3. **If you call `useInjectableContainer`,** find and replace it with `useApplicationContainer`. The codemod does not rename it. See [useApplicationContainer](./2026-11-04-application-container).
4. **If you import `lodash` in your own code,** add it to your `package.json`; ARDOR no longer installs it. A `useDeepEqualSelector` selector that returns a `Map`, a `Set` or a class instance now re-renders whenever the instance changes. See [No lodash](./2026-11-04-drop-lodash).
5. **If you set `authRecovery.refreshTokenPath` and the auth service is bound,** a `401` now sends a POST with no body to that path. The expired token is attached only when the path is not in `noAuthPaths`. If the path is not a refresh endpoint, remove the setting or override `refreshToken`. If your own `refreshToken` subclass only posts to the path and saves the token, delete it. See [Default token refresh](./2026-11-04-default-token-refresh).
6. **If a tool reads the source maps of an ARDOR package** (a source-map loader warning, a debugger that opens `node_modules/@venizia/ardor-*/dist/**/*.map`), it finds none; stack traces point into `dist`.
7. **If you name `ISendResponse` or set `offset` on a list filter,** run `ardor codemod namespace src --write`: it renames `ISendResponse` to `INetworkResponse`, and `--check` lists each `.offset` to change to `skip`. See [Aliases removed](./2026-11-05-remove-aliases).
8. **Optional: use the new hooks and helpers** in place of your own subscribe-and-cleanup code. Each entry in the table has an example.

An application on 0.4.6 or older follows the earlier overviews first: see [Upgrading ARDOR](../guides/migrations/upgrading-ardor).
