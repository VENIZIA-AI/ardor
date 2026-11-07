---
title: The app preset no longer has a vendor chunk that the first screen loads
description: The app preset keeps only the react group in codeSplitting, because its catch-all vendor group put the libraries of lazy routes into the first screen.
packages: ['@venizia/ardor']
---

# Changelog - 2026-11-08

## The app preset no longer has a vendor chunk that the first screen loads

<Badge type="warning" text="Behavior Change" />

**In one line.** The `vite.config` of a new ARDOR app had a `vendor` group that took every third-party module into one chunk, so the first screen loaded libraries that only a rare lazy route needs. The preset now has the `react` group only.

```ts
// build.rolldownOptions.output of the preset's vite.config.mts
export const output = {
  codeSplitting: {
    groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
  },
};
```

## What changed

- **No catch-all vendor group.** New apps configure only the `react` code-splitting group, so a library that only a lazy route imports stays with that route and the first screen does not load it.
- **Measured on two large apps.** One team built its two largest apps with the old preset and with this one. The first screen went from about 117% and 119% bigger in gzip than the team's own config to 4.3% bigger (that is the `react` group), with one more request, and the build passes the 5 MB precache limit of `vite-plugin-pwa` that the 6.5 MB `vendor` chunk had failed. One run for each build, and only on those two apps.
- **Packages that only the entry imports now sit in the entry chunk.** They are fetched again after a deploy that changes your code. To keep a vendor chunk that is cached across deploys, add `{ name: 'vendor', test: /node_modules/, minShareCount: 2, entriesAware: true }` after the `react` group; on the same two apps that kept the first screen 5.0% bigger, for 16 to 20 more requests.

## Who is affected

- **New apps** made from the preset get the `react` group only.
- **An existing app** keeps its own `vite.config`. If its first screen loads libraries of lazy routes, remove its catch-all `vendor` group. See [Vite setup](../guides/get-started/vite-setup#the-preset-has-no-vendor-group).
