---
title: The final IGNIS chain, and the examples autoload with the Vite plugin
description: ARDOR builds on IGNIS 0.2.2-14 (ignis-boot 0.2.1-10, dev-configs 0.3.1-4) and VULCAN 0.2.0-8. The examples register their classes with AutoArtifacts and IgnisArtifactsVitePlugin, one decorated class per file, and the quickstart is rewritten around it.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-18

## The final IGNIS chain, and the examples autoload with the Vite plugin

<Badge type="warning" text="Behavior Change" />

**In one line.** ARDOR's peer floors move to the final prerelease chain, and a Vite application registers its decorated classes with `IgnisArtifactsVitePlugin` and `AutoArtifacts` instead of listing or importing them (issue #94).

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

- **The peer floors moved.** `@venizia/ignis-kernel` and `@venizia/ignis-connectors` need `^0.2.2-14`, `@venizia/ignis-helpers` `^0.2.2-9`, `@venizia/ignis-inversion` and `@venizia/ignis-filter` `^0.2.2-6`. The toolchain is `@venizia/dev-configs` 0.3.1-4 and `@venizia/vulcan` 0.2.0-8. No source of the packages changed.
- **A Vite build autoloads.** `IgnisArtifactsVitePlugin.create()` from `@venizia/ignis-boot/vite` (ignis-boot 0.2.1-10) builds the list of decorated classes under `src/` into the bundle, imports it eagerly so the bundle stays tree-shakeable, and, in ignis-boot 0.2.1-10, turns `output.keepNames` on for the whole build, because binding keys come from `Class.name` ([0.2.1-11 pins only the listed classes](./2026-10-18-boot-pins-class-names)). `artifacts()` returns `AutoArtifacts` and nothing is listed or imported for its side effect.
- **One decorated class per file.** The module that imports `AutoArtifacts` must hold no decorated class and must not be imported by one: the list imports the module of every class, so a class in that module is still being evaluated when the list is built. `start()` stops with `[artifacts] '<kind>' lists an entry that is not a class (position N)` when it happens.
- **The examples follow.** `examples/5-mins-qs` and `examples/vert-admin` have a file per decorated class and an `application.ts` with the application alone. Both ran in a browser, minified: sign-in, the list, and in vert-admin the 401 refresh.
- **The quickstart is rewritten** around that layout, and the application reference states the Vite result it used to call "not measured".
- **The bundle grew with `keepNames` in ignis-boot 0.2.1-10.** About 105 KB (14 KB gzipped) on the quickstart, 595 KB to 700 KB, because it applied to the whole build, dependencies included. ignis-boot 0.2.1-11 removes it.
- **`getAuth` stops logging an error for an absent token.** `DefaultAuthService.getAuth` treated "nothing stored" like corrupt data and logged `Failed to parse stored auth token` on every visit of a user who had not signed in. It returns `null` silently; a stored value that is empty or not JSON still logs.
- **The lint presets are adopted.** ESLint runs `houseConfigs` and `reactHouseConfigs` (the naming convention, `no-leaked-render`, `max-params-own`, `no-new-error`, `const-class-values`), and `bun check` runs under `noImplicitAny` and `useUnknownInCatchVariables`. ARDOR needed no source change for them.

## Who is affected

- **An application on an older IGNIS prerelease.** Move every `@venizia/ignis-*` package to the versions above, together.
- **A Vite application that registers its classes by hand or by import.** It can switch to the plugin; nothing forces it to.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `package.json` | kernel, react, admin, ardor |
