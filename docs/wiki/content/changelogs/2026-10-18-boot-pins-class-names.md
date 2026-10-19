---
title: The Vite plugin pins the listed class names, not every name in the bundle
description: ignis-boot 0.2.1-11 no longer sets output.keepNames. IgnisArtifactsVitePlugin pins the name of each class it lists, and the quickstart bundle is back to about 595 KB. Docs and examples only; no ARDOR release.
packages: []
---

# Changelog - 2026-10-18

## The Vite plugin pins the listed class names, not every name in the bundle

<Badge type="tip" text="Enhancement" />

**In one line.** With `@venizia/ignis-boot` 0.2.1-11 a Vite build keeps the names of the classes `AutoArtifacts` lists and minifies everything else as usual, so the autoload no longer adds about 105 KB to the bundle (issue #${N}).

```bash
bun add -d @venizia/ignis-boot@0.2.1-11
```

## What changed

- **No `output.keepNames`.** 0.2.1-10 set it for the whole build because binding keys come from `Class.name`; it reached React, `ra-core` and every other dependency. 0.2.1-11 injects `static { Object.defineProperty(this, 'name', ...) }` into the scanned classes, which runs before the decorators.
- **Measured on the examples.** `examples/5-mins-qs` builds to 594 KB (187.5 KB gzipped), down from 698 KB (202 KB). The minified bundle carries a name pin for exactly the three listed classes (`AdminConfiguration`, `ApiDataSource`, `ProductRepository`); `examples/vert-admin` for its two (`AdminConfiguration`, `IdentityService`).
- **Both examples ran again in a browser, minified.** 5-mins-qs: sign-in, 27 products, roles stored. vert-admin: sign-in, the list, and the 401 refresh through `VertNetworkService`, one refresh call for two 401s.
- **The catalog entry** `@venizia/ignis-boot` is 0.2.1-11. It is a dev dependency of the two examples only, so nothing a package publishes changes.

## Who is affected

- **A Vite application on ignis-boot 0.2.1-10.** Move to 0.2.1-11 to get the smaller bundle. Nothing else changes.
- **Everyone else.** No action needed.
