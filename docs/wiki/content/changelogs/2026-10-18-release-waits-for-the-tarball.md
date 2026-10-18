---
title: The release script waits for each tarball, and vert-admin splits its vendor chunks
description: scripts/release.ts waits until a package's tarball answers 200 before it dispatches the next package, and examples/vert-admin builds without Vite's 500 KB chunk warning. Nothing changes for an application that uses ARDOR.
packages: []
---

# Changelog - 2026-10-18

## The release script waits for each tarball, and vert-admin splits its vendor chunks

<Badge type="tip" text="Enhancement" />

**In one line.** `bun scripts/release.ts` no longer starts the next package while the previous one is listed on the registry but cannot be installed yet, and `examples/vert-admin` builds in three chunks like `examples/5-mins-qs`.

```bash
bun scripts/release.ts --yes   # kernel, react, admin, ardor - each waits for the one before it
```

## What changed

- **The chain waits for the tarball.** After a run succeeds and `npm view` reports the new version, `release.ts` polls the tarball URL (`https://registry.npmjs.org/<package>/-/<name>-<version>.tgz`) with `HEAD` until it answers 200, for up to 15 minutes, and only then dispatches the next package. The packument and the `next` dist-tag are listed minutes before the tarball: the next package's clean-install gate installs the one before it, and `react` failed once on the `ardor-kernel` 404.
- **vert-admin splits vendor code.** Its `vite.config.ts` sets the same `build.rolldownOptions.output.codeSplitting` groups as 5-mins-qs: an application chunk of 51 KB, React 219 KB and the other vendor code 295 KB, and no chunk-size warning. It also forwards `/api` under `vite preview`, as 5-mins-qs does.

## Who is affected

- **Applications that use ARDOR.** No action needed.
- **Whoever runs a release.** The script is slower by the registry's lag and prints `tarball installable` per package. It throws, naming the package and version, if a tarball is still missing after 15 minutes.
