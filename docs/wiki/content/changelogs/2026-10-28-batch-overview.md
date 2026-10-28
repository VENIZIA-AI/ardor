---
title: Everything since ARDOR 0.4.4 in one place, with an upgrade checklist
description: A table of every change since 0.4.4 grouped by kind and linked to its entry, and the checklist an application and a contributor follow to move to ARDOR 0.4.5.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-28

## Everything since ARDOR 0.4.4 in one place, with an upgrade checklist

<Badge type="tip" text="New Feature" /> <Badge type="info" text="Documentation" /> <Badge type="info" text="Tooling" />

**In one line.** No application changes unless it opts in. The published code differs from 0.4.4 by one option, `fallback` of `useDocumentTitle`, and one comment in `@venizia/ardor/testing`; the rest is the release workflow, a published atlas index, the wiki gates and documentation fixes.

```bash
bun add @venizia/ardor
```

## What changed

| Kind | Change | Packages | In | Entry |
|------|--------|----------|----|-------|
| New feature | `useDocumentTitle` takes `fallback: true`: a layout's title shows only while no screen title is mounted, so a screen wins on the first mount and the fallback comes back when the screen unmounts | `@venizia/ardor-admin`, `@venizia/ardor` | 0.4.5 | [useDocumentTitle takes fallback](./2026-10-28-document-title-fallback) |
| Documentation | `skipBindings` of `assertArdorApplicationBoots` reaches the binding check only; the provider step builds what the application bound, and a bound auth provider cannot be skipped. A guest app with no sign-in leaves `CoreBindings.DEFAULT_AUTH_PROVIDER` unbound | `@venizia/ardor` | 0.4.5 | [assertArdorApplicationBoots says what skipBindings reaches](./2026-10-27-boot-check-skip-bindings-scope) |
| Documentation | The Vite setup guide states what `output.strictExecutionOrder` costs (about +3.4% gzip on a four-chunk app, more with many chunks), how to measure it for your app and when it is safe to turn off; the preset keeps it on | repository only | no package | [The size cost of strictExecutionOrder is documented](./2026-10-27-strict-execution-order-cost) |
| Tooling | The package release workflow runs only from `develop`, is read-only by default, publishes only after a test job with no secret, and uses an exact `bun` and actions pinned by commit; a test fails when a guard is removed | repository tooling | no package | [The release workflow runs only from develop](./2026-10-27-release-workflow-guards) |
| Tooling | A workflow publishes a signed prebuilt atlas index of `main`, `develop` and the release tags; the public key is in the manifest (`atlas.index.keys`) | repository tooling | no package | [ARDOR publishes a signed prebuilt atlas index](./2026-10-27-atlas-prebuilt-index) |
| Tooling | `make wiki-links-check` and `make wiki-anchors-check` run the gates `@venizia/vulcan` 0.4.6 ships; the shared wiki theme is re-copied from VULCAN v0.4.6 | repository tooling | no package | [The wiki link and anchor gates come from @venizia/vulcan](./2026-10-27-wiki-gates-from-vulcan) |
| Documentation | Three corrections: a minified build resolves a pinned datasource without `@inject` (an old warning said otherwise); the binding-key concept says so; the hooks reference says a layout's `useDocumentTitle` wins on first mount and how to set a base title | repository only | no package | [Class identity survives a minifier](./2026-10-07-class-identity-and-container) and [useDocumentTitle](../references/hooks#usedocumenttitle) |

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
- **An app built with Vite that wants the size of the flag back.** Step 4.
- **A project that reads ARDOR through atlas.** Step 5.
- **A contributor of this repository.** Step 6.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `0.4.5`. The `@venizia/ignis-*` packages stay at `0.4.4` or newer; the peers did not change.
2. **If a layout and a screen both call `useDocumentTitle`:** add `fallback: true` to the layout's call. The screen's title then wins on the first mount, and the layout's shows again when the screen unmounts. Without the flag nothing changes.
3. **If a guest app binds an auth provider it never uses:** delete that `@provide({ key: CoreBindings.DEFAULT_AUTH_PROVIDER })` method. `ArdorApplication` and `assertArdorApplicationBoots` build a bound auth provider, and one that needs a service the guest does not bind fails the boot test. Keep `DEFAULT_AUTH_SERVICE` if the data provider refreshes a token. See [Providers](../guides/core-concepts/providers#authentication-no-sign-in).
4. **If the size of `strictExecutionOrder` matters to the app:** build twice, with the flag on and off, compare the raw and gzip size of `dist`, open the built app in a real browser, and turn it off only with a built-app check in CI. The method is "Decide for your app" in [Vite setup](../guides/get-started/vite-setup).
5. **If a project reads ARDOR through atlas:** on `@venizia/vulcan` 0.4.6 or newer it downloads the published index instead of building one; on an older VULCAN nothing changes. The index is rebuilt on a push to `main` or `develop`. A release tag gets none until ARDOR moves to VULCAN 0.4.7, because the release workflow pushes tags with the Actions token, which starts no workflow.
6. **Contributors: pull, then `make vulcan-sync`** if your adapters are older. `scripts/release` and `scripts/build` are tracked and format-checked now (a build-output pattern in `.gitignore` had hidden them), and the `useAutosave` and `useDebounce` tests run on a fake clock instead of sleeping. A release is still started with `make release`.

## Details

- Every row of the table links the entry that holds the detail; this page repeats none of it beyond the steps above.
- The 0.4.4 changes are in [Everything since ARDOR 0.4.3](./2026-10-26-batch-overview).


