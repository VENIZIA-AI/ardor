---
title: Silent first run for the ARDOR preset
description: The ARDOR preset fixes Vite configuration and chunk size warnings on first run, declares its root URL, and tests for silent dev and build output.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## Silent first run for the ARDOR preset
<Badge type="info" text="Bug Fix" />

**In one line.** Applications created by the ARDOR preset start and build without Vite configuration loader or chunk size warnings on first run.

## What changed

- **First-run warnings fixed.** The configuration file is now `vite.config.mts` so Vite does not warn about unsupported native loader features, and `build.rolldownOptions.output.codeSplitting` splits React and vendor libraries into chunks under 500 kB.
- **Root URL and smoke test.** The preset declares `urls: ["/"]` for VULCAN to display, and the preset smoke test starts the development server and builds the application, failing if either output contains `(!)` or a warning line.

## Who is affected

- **New and existing applications.** New projects get a silent first run. Existing applications do not break; to silence warnings, rename `vite.config.ts` to `vite.config.mts` (update `include` in `tsconfig.json`) and copy the `build` block of the new `vite.config.mts`.
