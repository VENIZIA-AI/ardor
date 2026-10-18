---
title: The quickstart is the 5-mins-qs example, and says what the bundle is made of
description: The quickstart guide includes the files of examples/5-mins-qs instead of a second copy, explains the 590 KB bundle, splits vendor code in the example's Vite config, and tells the reader to move the IGNIS packages together.
packages: []
---

# Changelog - 2026-10-18

## The quickstart is the 5-mins-qs example, and says what the bundle is made of

<Badge type="tip" text="Enhancement" />

**In one line.** `guides/get-started/quickstart.md` shows the files of `examples/5-mins-qs` as they are, so the guide and the example that CI builds are one shape (issues #69, #70 and #71).

## What changed

- **One shape.** The guide had grown its own single-file `main.tsx` while the example split `application.ts`, `main.tsx` and `pages/`, with a login page and a repository resolved in the page. The guide now follows the example and includes each file with a VitePress code import, so there is no copy to drift.
- **The bundle is explained.** The example builds to about 590 KB (186 KB gzipped) and Vite warns above 500 KB. Measured per package, React DOM, the router, `ra-core`, `lodash` and TanStack Query make up most of it; ARDOR and the IGNIS packages it needs in the browser come to about 110 KB. Nothing heavy is pulled in by default.
- **The example splits vendor code.** `vite.config.ts` sets `build.rolldownOptions.output.codeSplitting` groups for React and the other vendor code: three chunks of 49, 219 and 321 KB, the same total, no warning, and a deploy that changes only application code keeps the vendor chunks cached. The built app was loaded in a browser and listed its products.
- **Move the IGNIS packages together.** The install step says so: ARDOR's peer ranges are floors per package, so one package a release behind another installs without a warning.
- **Other APIs.** The guide points to the no-sign-in setup and to the IGNIS JWT auth setup in the [auth provider reference](../references/auth-provider).

## Who is affected

- **Readers of the quickstart.** The steps are different files now; nothing in the packages changed.
- **Applications.** No action needed.
