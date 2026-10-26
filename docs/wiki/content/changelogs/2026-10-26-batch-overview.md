---
title: Everything since ARDOR 0.4.3 in one place, with an upgrade checklist
description: A table of every change since 0.4.3 grouped by kind and linked to its entry, and the checklist an application and a contributor follow to move to ARDOR 0.4.4.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-26

## Everything since ARDOR 0.4.3 in one place, with an upgrade checklist

<Badge type="tip" text="New Feature" /> <Badge type="warning" text="Behavior Change" /> <Badge type="tip" text="Enhancement" />

**In one line.** Nothing here breaks an application on ARDOR 0.4.3. A Vite plugin for the build stamp (`@venizia/ardor/vite`), one build flag in the preset, and text changes in the published files; the rest is repository tooling and the wiki. ARDOR 0.4.4 pairs with IGNIS 0.4.4, which runs on Bun >= 1.4 and ships ESM only.

```bash
bun add @venizia/ardor
```

## What changed

| Kind | Change | Packages | In | Entry |
|------|--------|----------|----|-------|
| New feature | `buildInfoFile` in the new Node-only entry `@venizia/ardor/vite` writes `build-info.json` (service, version, commit, branch, build time, installed `@venizia/*` versions) into the build and serves it on the dev server; `IBuildInfoFile` types the file | `@venizia/ardor`, `@venizia/ardor-kernel` | 0.4.4 | [The preset keeps chunks in import order, and buildInfoFile writes build-info.json](./2026-10-26-vite-build-info) |
| Behavior change | The preset's `vite.config.mts` sets `output.strictExecutionOrder: true`, so a split chunk never runs a DI package before `reflect-metadata`; it costs about 3 percent of the gzip size | `@venizia/ardor` (the preset) | 0.4.4 | [The preset keeps chunks in import order, and buildInfoFile writes build-info.json](./2026-10-26-vite-build-info) |
| Enhancement | The kernel's npm description and keywords match its code; the LICENSE files name Venizia Co., Ltd. and list only the libraries ARDOR uses; each README ends with the VENIZIA credit | all four packages | 0.4.4 | [The kernel description says what the kernel holds](./2026-10-26-package-metadata) |
| Tooling | CI runs the umbrella's tests; a package can have a second TypeScript program; the shared wiki theme and the home numbers are under test | repository tooling | 0.4.4 | [Repository tooling](./2026-10-26-repository-tooling) |
| Documentation | The wiki has a new home page, a footer, a Venizia switcher, a smoother light and dark switch and a Vite setup guide | repository only | no package | [Wiki: a new home page](./2026-10-26-wiki-new-look) |

| Package | ARDOR 0.4.3 | ARDOR 0.4.4 |
|---------|------------|--------------|
| `@venizia/ardor` | 0.4.3 | 0.4.4 |
| `@venizia/ardor-kernel` | 0.4.3 | 0.4.4 |
| `@venizia/ardor-react`, `@venizia/ardor-admin` | 0.4.3 | 0.4.4 |

The IGNIS peers stay `^0.4.1`: no change in this batch needs a newer IGNIS. IGNIS 0.4.4 ships ESM only and needs Bun 1.4 or newer; an app built with Vite takes ARDOR as ESM already, so this changes nothing for it.

## Who is affected

- **An application on ARDOR 0.4.3.** No action is needed to keep running. The checklist below takes the new behavior.
- **An application generated from the preset.** Optional and recommended: step 3.
- **An application with its own `reflectMetadataFirst` or `buildInfoFile` plugin (BANA).** Steps 2 to 4.
- **A contributor of this repository.** Step 5.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `0.4.4`, with the `@venizia/ignis-*` packages at `0.4.4` (0.4.1 or newer still satisfies the peers).
2. **If the app builds with Vite and orders `reflect-metadata` itself:** bump `vite` to 8.3.5 or newer, add `strictExecutionOrder: true` to `build.rolldownOptions.output`, build, open the built app in a real browser (`vite preview`) and check the console, then delete the app's `reflectMetadataFirst` plugin and its import.
3. **An app made from the preset:** add `strictExecutionOrder: true` to the same place in its `vite.config.mts`. A new app has it.
4. **If the app has its own `buildInfoFile`:** replace it with `import { buildInfoFile } from '@venizia/ardor/vite'`, delete its copy and its test, and type the About page with `IBuildInfoFile` from `@venizia/ardor`. The keys now have a fixed order, `frameworks` is sorted and `commit` is the 12-character short form; a build with no commit fails unless `onUnresolved: 'unspecified'` is set. The entry lists every difference.
5. **Contributors: run `bun install` and `make build-all` after pulling** (the umbrella has new dev dependencies and a second TypeScript program), and `make vulcan-sync` if your adapters are older. When the home page test says a number drifted, update `COUNTS` in `docs/wiki/site/.vitepress/theme/home-content.ts`.

## Details

- Every row of the table links the entry that holds the detail and the migration; this page repeats none of it beyond the steps above.
- The wiki page [Vite setup](../guides/get-started/vite-setup) has the options of `buildInfoFile` and the measured cost of the flag.
