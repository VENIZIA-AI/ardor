---
title: ARDOR follows ignis-boot 0.2.1-11
description: The catalog and the two examples move to ignis-boot 0.2.1-11, whose Vite plugin pins only the names of the classes it lists. Docs and examples only, no ARDOR release.
packages: []
---

# Changelog - 2026-10-18

## ARDOR follows ignis-boot 0.2.1-11

<Badge type="tip" text="Enhancement" />

**In one line.** The repository's catalog pins `@venizia/ignis-boot` 0.2.1-11, so the examples build with a Vite plugin that keeps the names of the classes `AutoArtifacts` lists and minifies everything else as usual (issue #96).

```bash
bun add -d @venizia/ignis-boot@0.2.1-11
```

## What changed

- **The catalog entry** `@venizia/ignis-boot` is 0.2.1-11. It is a dev dependency of the two examples only, so nothing a package publishes changes.
- **The examples build with it.** ignis-boot 0.2.1-10 set `output.keepNames` for the whole build, which reached every dependency; 0.2.1-11 pins only the scanned classes (`AdminConfiguration`, `ApiDataSource` and `ProductRepository` in `examples/5-mins-qs`; `AdminConfiguration` and `IdentityService` in `examples/vert-admin`). See [the final IGNIS chain](./2026-10-18-final-pin-and-autoload).

## Who is affected

- **A Vite application on ignis-boot 0.2.1-10.** Move to 0.2.1-11. Nothing else changes.
- **Everyone else.** No action needed.
