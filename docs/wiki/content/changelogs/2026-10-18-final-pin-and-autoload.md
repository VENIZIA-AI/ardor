---
title: A Vite application autoloads its classes with IgnisArtifactsVitePlugin
description: A Vite application registers its decorated classes with IgnisArtifactsVitePlugin and AutoArtifacts instead of listing them; the IGNIS peer floors move.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-18

## A Vite application autoloads its classes with IgnisArtifactsVitePlugin

<Badge type="warning" text="Behavior Change" />

**In one line.** A Vite application registers its decorated classes with `IgnisArtifactsVitePlugin` and `AutoArtifacts` instead of listing or importing them, and the IGNIS peer floors move to `@venizia/ignis-kernel` and `-connectors` `^0.2.2-14`.

```ts no-check
import AutoArtifacts from '@venizia/ignis-boot/auto';
import { BaseArdorApplication, type IArtifactIndex } from '@venizia/ardor';

// application.ts holds only the application: no decorated class, and none imports it.
export class Application extends BaseArdorApplication {
  override artifacts(): Array<IArtifactIndex> {
    return [AutoArtifacts];
  }
  // ... getAppInfo() and bindContext() as usual.
}
```

## What changed

- **A Vite build autoloads.** `IgnisArtifactsVitePlugin.create()` from `@venizia/ignis-boot/vite` (ignis-boot 0.2.1-10) builds the list of decorated classes under `src/` into the bundle. `artifacts()` returns `AutoArtifacts`, and nothing is listed or imported for its side effect.
- **One decorated class per file.** The module that imports `AutoArtifacts` must hold no decorated class and must not be imported by one. `start()` stops with `[artifacts] '<kind>' lists an entry that is not a class (position N)` when it happens.
- **`keepNames` in ignis-boot 0.2.1-10 made the bundle larger.** The plugin turned it on for the whole build, dependencies included. ignis-boot 0.2.1-11 removes it.
- **The peer floors moved.** `@venizia/ignis-kernel` and `@venizia/ignis-connectors` need `^0.2.2-14`, `@venizia/ignis-helpers` `^0.2.2-9`, `@venizia/ignis-inversion` and `@venizia/ignis-filter` `^0.2.2-6`.
- **`getAuth` stops logging an error for an absent token.** `DefaultAuthService.getAuth` treated "nothing stored" like corrupt data and logged `Failed to parse stored auth token` on every visit of a user who had not signed in. It returns `null` silently. A stored value that is empty or not JSON still logs.

## Who is affected

- **An application on an older IGNIS prerelease.** Move every `@venizia/ignis-*` package to the versions above, together.
- **A Vite application that registers its classes by hand or by import.** It can switch to the plugin. Nothing forces it to.
- **Everyone else.** No action needed.
