---
title: Repository tooling - release scope, the smoke's Chrome profile, the docs snippet check, const classes in scripts, VULCAN 0.4.4
description: A preset change now counts as a change of the ardor package for the release sweep, the preset smoke keeps its Chrome profile in a short folder it removes, the docs snippet check keeps its folder in the repository, the script unions become const classes, and the dev tool VULCAN moves to 0.4.4.
packages: []
---

# Changelog - 2026-10-25

## Repository tooling - release scope, the smoke's Chrome profile, const classes in scripts, VULCAN 0.4.4

<Badge type="info" text="Bug Fix" /> <Badge type="tip" text="Enhancement" />

**In one line.** Five changes to how this repository is built and released. None changes a published package, so an application has nothing to do; a maintainer or contributor should read the points about the release sweep, the scratch folders and VULCAN.

## What changed

- **The release sweep sees the preset.** The `ardor` package ships the VULCAN preset (`presets/`, written into `dist/presets` by `scripts/preset/vulcan-preset.ts`), but only `packages/ardor/src` and its manifest counted as a change. A preset change after the last release made `bun scripts/release/release.ts --dry-run` print `ardor 0 file(s)`, and a release without `--version` would have skipped `ardor` and published the old preset. `presets/` and the preset script now count for `ardor` and for no other package. An explicit `--version` was never affected.
- **The preset smoke leaves nothing in the system temp folder.** Its headless Chrome profile is a short folder that the smoke creates (under `XDG_RUNTIME_DIR`, else the system temp folder) and removes in a `finally`; Chrome's own temporary files go there too. The folder is short on purpose: Chrome opens a unix socket inside its profile and stops with `Socket path too long` past 107 characters, which a checkout under a deep home folder exceeds. This is the one exception to "scratch files live in `.agents/local/tmp`", which the smoke and the clean-install check already followed since 0.4.2. The purity probe and nine script tests now use `makeScratch` (`scripts/scratch.ts`) instead of `os.tmpdir()`.
- **The docs snippet check keeps its folder in the repository.** `make docs` compiles every `ts` block of the docs in a scratch folder. It used to make that folder in the system temp folder and removed it only when the run finished; it now uses `makeScratch` (`.agents/local/tmp`) and removes the folder on every exit, so a crash or a failing snippet leaves nothing behind either. The `node_modules` link inside it still resolves the packages.
- **Script unions are const classes.** The npm tag, the release modes, the purity severity, the preset kind, the smoke scenario and the wiki anchor problem are classes with `SCHEME_SET`, `isValid` and a `TConstValue` type (`scripts/const-value.ts`), the same shape as the packages. The values are unchanged. Lists of property names (`Pick`, an `as const satisfies ReadonlyArray<keyof T>` list) are not value domains and stay as they are.
- **VULCAN 0.4.4.** The root dev dependency `@venizia/vulcan` moves from 0.4.2 to 0.4.4. The base rules change: V-P-11 (reports) is reworded, V-B-09 (agent scripting uses bun) and V-C-19 (group options that serve one concern into a named sub-object) are new.

## Who is affected

- **An application on ARDOR.** No action needed: no published package changes.
- **A maintainer who releases.** The sweep now lists `ardor` after a preset change, as it should. No command changes.
- **A contributor.** After pulling, run `make vulcan-sync` so your adapters carry the new base rules. Do not delete the `com.google.Chrome.*` folders already in your system temp folder; the smoke no longer adds to them.

## Details

- The tests: a change under `presets/` or to `vulcan-preset.ts` counts for `ardor` and not for another package, an uncommitted one counts, one before the last `ardor` release commit does not, and the sweep lists `ardor` alone (`scripts/release/__tests__/release-scope.test.ts`, on a real git history). A test pins the seven release modes and the two tags.
- The preset smoke, including the Chrome check, passes in CI with the new profile.
- Issues: #297 (release scope), #284 (Chrome profile and scratch), #310 (docs snippet check), #304 (const classes), #302 (VULCAN pin).
