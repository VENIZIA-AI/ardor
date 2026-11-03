---
title: Chunks keep import order, and buildInfoFile writes build-info.json
description: The preset turns on output.strictExecutionOrder so chunks keep import order, and @venizia/ardor/vite adds buildInfoFile for an About page.
packages: ['@venizia/ardor', '@venizia/ardor-kernel']
---

# Changelog - 2026-10-26

## Chunks keep import order, and buildInfoFile writes build-info.json

<Badge type="tip" text="New Feature" /> <Badge type="warning" text="Behavior Change" />

**In one line.** The preset's `vite.config.mts` sets `output.strictExecutionOrder: true`, so a production build cannot run a split chunk before `reflect-metadata`; and the new Node-only entry `@venizia/ardor/vite` exports `buildInfoFile`, which writes `build-info.json` for an About page. Both need Vite 8.3.5 or newer. Available in 0.4.4.

```ts
import { buildInfoFile } from '@venizia/ardor/vite';
```

## What changed

- **`output.strictExecutionOrder: true` in the preset.** Rolldown can run a split-off chunk before the module a DI package depends on, and a build then fails in the browser with `Reflect.getMetadata is not a function` while `vite dev` works ([vitejs/vite#21866](https://github.com/vitejs/vite/issues/21866)). The flag is the fix the Vite team gives. It costs about 3.4% of the gzip size of a four-chunk app, all in the cached `vendor` chunk. See [Vite setup](../guides/get-started/vite-setup).
- **`buildInfoFile` in `@venizia/ardor/vite`.** It emits `build-info.json` into the build and serves it on the dev server: `service`, `version`, `commit`, `branch`, `builtAt` from the pipeline variables or git, and `frameworks`, the installed version of each `@venizia/*` dependency, sorted. The text is the same for the same input. A build with no commit in the pipeline or in git fails and says how to fix it; the dev server serves what it has and warns.
- **`IBuildInfoFile`** in `@venizia/ardor-kernel` and `@venizia/ardor` is the type of the file, for the code that reads it.
- **Optional peers of `@venizia/ardor`:** `vite` (`>=8.3.5`) and `@venizia/ignis-boot` (`^0.4.1`), needed only by `./vite`.

## Who is affected

- **A new app from the preset.** Nothing to do: the flag is in its config.
- **An app already generated from the preset.** Optional but recommended: add `strictExecutionOrder: true` to `build.rolldownOptions.output` of its `vite.config.mts`, and keep Vite at 8.3.5 or newer.
- **An app with its own Vite plugin that puts `import 'reflect-metadata'` before DI modules (BANA's `reflectMetadataFirst`).** Replace it with the flag; see the steps below.
- **An app that wants an About page.** Use `buildInfoFile`.

## Upgrade steps for an app with its own `reflectMetadataFirst` and `buildInfoFile` (BANA)

1. Bump `vite` to 8.3.5 or newer. An app on Vite 8.1.0 reported `React$12 is not defined` with the flag on; 8.3.5 builds and loads in a real browser.
2. Add `strictExecutionOrder: true` to `build.rolldownOptions.output` of the Vite config.
3. Build, open the built app in a real browser (`vite preview`) and check the console. Then delete the app's `reflectMetadataFirst` plugin and its import.
4. Replace the app's own `buildInfoFile` with `import { buildInfoFile } from '@venizia/ardor/vite'` and delete its copy and its test. Differences to expect: the keys have a fixed order, `frameworks` is sorted, `commit` is the 12-character short form and no longer the 40-character one, the dev server answers only `GET` and `HEAD`, and a build with no commit fails instead of writing `unspecified`; pass `onUnresolved: 'unspecified'` to keep the old behaviour. Pass `root` if Vite does not run in the app folder.
5. Type the About page with `IBuildInfoFile` from `@venizia/ardor`.

The wiki page [Vite setup](../guides/get-started/vite-setup) has the options, the sources of each field and the numbers.
