---
title: The app preset no longer loads the libraries of lazy routes on the first screen
description: The vendor group of the app preset sets minShareCount 2, so a library that one lazy route imports stays in that route's chunk.
packages: ['@venizia/ardor']
---

# Changelog - 2026-11-08

## The app preset no longer loads the libraries of lazy routes on the first screen

<Badge type="warning" text="Behavior Change" />

**In one line.** The `vendor` group in the `vite.config` of a new ARDOR app took every third-party module into one chunk, so the first screen loaded libraries that only a rare lazy route needs. It now takes only the modules that two chunks or more import.

```ts
codeSplitting: {
  groups: [
    { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
    { name: 'vendor', test: /node_modules/, minShareCount: 2 },
  ],
},
```

## What changed

- **A shared vendor chunk needs two or more users.** The `vendor` group of the preset now sets `minShareCount: 2`, so a package that only one lazy route imports stays in that route's chunk instead of the first screen's vendor chunk.
- **The first screen is smaller.** On a test fixture of one entry and 80 lazy routes the first screen went from 2,407 KB to 809 KB raw. It was not measured again on the six apps of the earlier report, where the old group made the first screen 11 to 119% bigger in gzip.
- **Packages that only the entry imports now sit in the entry chunk.** They are fetched again after a deploy that changes your code. In `examples/5-mins-qs` the build is one 373 KB `index` chunk where it was an 11 KB `index` chunk and a 362 KB `vendor` chunk.

## Who is affected

- **New apps** made from the preset get the new group.
- **An existing app** keeps its own `vite.config`. If its first screen loads libraries of lazy routes, add `minShareCount: 2` to the `vendor` group, or remove the group. See [Vite setup](../guides/get-started/vite-setup#the-vendor-group-takes-the-modules-that-two-chunks-share).
