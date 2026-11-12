---
title: Vite setup
description: What an ARDOR app needs in its Vite 8 config - the chunk order flag the preset sets, and buildInfoFile, which writes build-info.json for an About page.
---

# Vite setup

An ARDOR app builds with Vite 8.3.5 or newer. The preset's `vite.config.mts` already has what is below; this page is for an app that wrote its own config, and for the `buildInfoFile` plugin (`@venizia/ardor/vite`), which the preset does not use.

## Run modules in the order they import each other

Rolldown can run a split-off chunk before the module that it depends on. Take a dependency injection (DI) package that needs `Reflect.getMetadata` as it is evaluated, and `reflect-metadata` in another chunk. The production build then fails in the browser with `Reflect.getMetadata is not a function`, while `vite dev` works ([vitejs/vite#21866](https://github.com/vitejs/vite/issues/21866)). One reported case was fixed in Vite 8.0.6. The class is not fixed: the thread ends with the Rolldown team saying that splitting cannot guarantee execution order and that `output.strictExecutionOrder` is the way, and a four-file case still fails on Vite 8.3.5 with the flag off.

Turn on `output.strictExecutionOrder`, as the preset does:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        // ...your codeSplitting groups
      },
    },
  },
});
```

| | Without the flag | With the flag |
|---|---|---|
| JavaScript chunks (`examples/5-mins-qs`, the preset's two groups) | 4 | 4 |
| JavaScript, raw | 593,726 B | 609,757 B (+2.7%) |
| JavaScript, gzip | 185,386 B | 191,757 B (+3.4%) |

The extra weight is in the `vendor` chunk, which the browser caches across deploys. This was measured on Vite 8.3.5 with Rolldown 1.2.14, and the built app loads in a real browser with no console error. An app on Vite 8.1.0 reported `React$12 is not defined` with the flag on. Keep Vite at 8.3.5 or newer, and check the built app in a browser after you turn the flag on.

**The flag costs size, and the cost grows with the number of chunks.** Rolldown wraps modules with runtime helpers and can duplicate shared code. Rolldown's own documentation warns that the option increases bundle size. An app with hundreds of lazy chunks and locale files pays more than the four-chunk example above. One team built six apps twice, with the flag off (their own committed config) and on (that one line added), then loaded each built app once in headless Chromium and summed the JavaScript it fetched (Vite 8.3.5, Rolldown 1.2.15, `vite build --mode development`, one build and one load per cell, each file gzipped by itself):

| App | JavaScript files, off → on | All files, gzip | First screen requests, off → on | First screen, gzip |
|---|---|---|---|---|
| 1 | 33 → 34 | +2.9% | 14 → 15 | +4.3% |
| 2 | 35 → 51 | +3.2% | 21 → 37 | +3.1% |
| 3 | 1,432 → 1,479 | +7.2% | 43 → 76 | +5.3% |
| 4 | 1,815 → 1,887 | +10.0% | 366 → 407 | +4.6% |
| 5 | 2,014 → 2,393 | +12.8% | 142 → 377 | +19.0% |
| 6 | 2,032 → 2,329 | +12.1% | 77 → 343 | +20.1% |

So the "about 3%" of the example holds for an app with a few dozen chunks, and the cost is 3 to 5% of the first screen for most apps. The two largest apps, with about 2,000 chunks each, load 235 and 266 more requests on the first screen and 19 and 20% more gzip. Request counts vary by about one between runs, and the load ran against a local server with no network, so the request count says more than the time. All six apps booted with no module-order error with the flag off, so for them the flag is a guard that costs size, not a fix.

### Decide for your app

The preset keeps the flag on because a new app cannot tell why a production-only failure points at a library. For an app that has grown, decide with a measurement:

1. Build twice, with the flag on and off, and compare the raw and gzip size of `dist` and the number of chunks.
2. Open the built app (`vite preview`, not `vite dev`) in a real browser and read the console.
3. Turn the flag off only if the built app boots clean and you keep a check of the built app in CI: a later import can change how chunks are shared and bring the failure back.

An app that wants no size cost can instead make sure `reflect-metadata` loads before each DI module it owns, for example with a Vite `transform` hook that adds `import 'reflect-metadata'` at the top of the DI package's files. That is measured by the app that uses it, not by ARDOR.

### The preset has no `vendor` group

The preset's `codeSplitting` has one group: `react` (React, its DOM renderer and the scheduler). A second group, `vendor`, with the test `/node_modules/`, would take every module under `node_modules` into one chunk, including the modules that only a rare lazy route uses, so an app with many lazy routes, or with many locale files, ends with one very large chunk that its first screen loads. The table compares six large admin apps. Each was built with those two groups added after its own groups (an `infra` group and an icons chunk), on top of the flag, and compared with the app’s own committed config:

| App | JavaScript files, before → preset | All files, gzip | First screen requests, before → preset | First screen, gzip | Largest chunk, raw |
|---|---|---|---|---|---|
| 1 | 33 → 31 | −7.7% | 14 → 15 | +10.6% | 1.64 MB |
| 2 | 35 → 32 | −4.2% | 21 → 24 | +31.4% | 3.86 MB |
| 3 | 1,432 → 68 | −7.6% | 43 → 38 | +108.0% | 6.48 MB |
| 4 | 1,815 → 143 | −9.1% | 366 → 55 | +53.1% | 4.00 MB |
| 5 | 2,014 → build failed | - | 142 → 274 | +117.2% | 6.57 MB, as reported by the build |
| 6 | 2,032 → build failed | - | 77 → 237 | +118.9% | 6.67 MB, as reported by the build |

The total went down for the four apps that build, and so did the number of requests for the first screen of apps 3 and 4. The first screen still got heavier in every app, by 11% to 119% of its gzip: modules that the first screen does not need now sit in a chunk that it loads. Apps 5 and 6 use `vite-plugin-pwa`, whose build stopped with `assets/vendor-….js is 6.57 MB, and won't be precached` (6.67 MB for the other) because the file was over the 5 MB precache limit; the build still wrote `dist`, and the first-screen figures of those two come from that output. Raising `workbox.maximumFileSizeToCacheInBytes` lets the build pass but leaves the chunk as large. The `react` group on its own added about 4% of first-screen gzip to apps 5 and 6 and nothing to the other four.

Giving the group `minShareCount: 2` makes it take only the modules that two chunks or more import. Apps 5 and 6, the two largest, were rebuilt with it, and with two other shapes of the group. Only the `vendor` group differs between the last three rows; the groups are a copy of the preset's `react` group and a `vendor` group, and the flag is on. First screen is what the page requests (service worker blocked, headless Chromium, nine seconds after `DOMContentLoaded`, `#/login`), JavaScript and CSS only for gzip, production mode, PWA plugins on:

| App | `vendor` group | First screen requests | First screen, gzip vs the app's own config | Largest chunk, raw | Precache failures |
|---|---|---|---|---|---|
| app 5 | a `vendor` group over all of `node_modules` (the table above, matched by file count) | 274 | +117.2% | 6.57 MB | build failed |
| app 5 | `minShareCount: 2` | 108 | +79.5% | 4.70 MB | 0 |
| app 5 | `minShareCount: 2, entriesAware: true` | 165 (+20) | +5.0% | 1.94 MB | 0 |
| app 5 | none (the `react` group only) | 146 (+1) | +4.3% | 2.10 MB | 0 |
| app 6 | a `vendor` group over all of `node_modules` (the table above, matched by file count) | 237 | +118.9% | 6.67 MB | build failed |
| app 6 | `minShareCount: 2` | 63 | +56.3% | 3.65 MB | 0 |
| app 6 | `minShareCount: 2, entriesAware: true` | 96 (+16) | +5.0% | 1.95 MB | 0 |
| app 6 | none (the `react` group only) | 81 (+1) | +4.3% | 2.56 MB | 0 |

`minShareCount: 2` alone still loaded a 3.65 to 4.70 MB chunk on the first screen. Leaving the group out is the closest to the app's own config: the 4.3% is the `react` group, and the build passes the 5 MB precache limit. `entriesAware: true` groups the shared modules by the set of chunks that import them, so the modules of lazy routes stay out of the set of the entry; it kept the first screen near the base too and made the largest chunk a little smaller, for 16 to 20 more requests. So the preset has **no `vendor` group**.

**To cache vendor code across a deploy,** add a group after `react`, in your own `vite.config`:

```ts
// build.rolldownOptions.output of the vite.config.mts
export const output = {
  codeSplitting: {
    groups: [
      { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
      { name: 'vendor', test: /node_modules/, minShareCount: 2, entriesAware: true },
    ],
  },
};
```

**What you give up without it.** The modules of the third-party packages that the entry imports sit in the entry chunk, with your application code, so a deploy that changes your code makes the browser fetch them again. In `examples/5-mins-qs`, which sets its own `vendor` group (test `/node_modules/`, no `minShareCount`), the build is an 11 KB `index` chunk and a 362 KB `vendor` chunk; without it, one 373 KB `index` chunk, under Vite's 500 KB warning. The cost of the lost deploy cache was not measured on the real apps. The opt-in costs the requests in the table.

**What was measured, and what was not.** One run for each cell, and only on apps 5 and 6 for the `react`-only and `entriesAware` rows; the other four apps have the `minShareCount: 2` row only (first screen +7% to +18% gzip against their own configs). The boot harness was not run again for the last two shapes: only the login page was rendered. A test in the ARDOR repository pins the direction on a fixture of one eager entry and six lazy routes: with a catch-all `vendor` group the first screen holds every lazy library; without it, and with the opt-in above, it holds none of them and every library is still built. That fixture did not reproduce the size of the real apps, so the numbers above are the ones to rely on. Measure what the first screen loads in a real browser (`vite preview`, not `vite dev`). The flag and the groups are separate choices: the flag orders modules, and the groups decide the chunk shapes.

The ARDOR repository pins this: a test builds a DI module that guards on `Reflect.getMetadata` in a chunk of its own, and it fails with the flag off and passes with it on. The same test fails the day Rolldown orders that module correctly by itself, which is when the flag can go.

## Write build-info.json for an About page

`buildInfoFile` from `@venizia/ardor/vite` emits `build-info.json` into the build and serves it on the dev server:

```ts
import { buildInfoFile } from '@venizia/ardor/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [buildInfoFile()],
});
```

It needs `@venizia/ignis-boot` (the resolver of the build stamp) and `vite` installed; both are optional peers of `@venizia/ardor`, and the preset already has them.

### What the file holds

The shape is `IBuildInfoFile`, exported by `@venizia/ardor` for the browser code that reads the file:

| Field | Source |
|---|---|
| `service`, `version` | `name` and `version` of the app's `package.json`; the version comes first from `APP_ENV_BUILD_VERSION`, `APP_BUILD_VERSION`, `CI_COMMIT_TAG` or `GITHUB_REF_NAME` |
| `commit` | the first of `APP_ENV_BUILD_COMMIT_TAG`, `APP_BUILD_COMMIT`, `CI_COMMIT_SHA`, `GITHUB_SHA`, `COMMIT_SHA`, cut to 12 characters; else `git rev-parse` |
| `branch` | the first of `APP_BUILD_BRANCH`, `CI_COMMIT_REF_NAME`, `GITHUB_REF_NAME`, `BRANCH_NAME`; else git |
| `builtAt` | `APP_ENV_BUILD_DATE` or `APP_BUILD_DATE`; else the time of the build |
| `frameworks` | the installed version of every dependency of the app whose name starts with `@venizia/`, sorted by name |

The text is the same for the same input: the keys keep one order and the file ends with a newline. The preset's Dockerfile passes `APP_BUILD_COMMIT` and `APP_BUILD_BRANCH`, so an image build needs no git.

> [!WARNING]
> The file is public: every visitor can read it. It tells them the app's version, the commit, the branch name and the versions of the framework packages. The values are copied as the pipeline wrote them, so never put a secret in a variable named above.

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `root` | `string` | the folder Vite runs in | The app folder, where `package.json` is. |
| `fileName` | `string` | `'build-info.json'` | The path under the output folder and under the dev server's base: letters, digits, `.`, `_`, `-` and `/`, ending in `.json`, never `..`. |
| `frameworkScope` | `string` | `'@venizia/'` | Dependencies whose name starts with this are listed under `frameworks`. |
| `onUnresolved` | `'error' \| 'unspecified'` | `'error'` | What a build does when no commit is found in the pipeline or in git. |

A build with no commit fails with a message that says to build inside a git checkout or to set `APP_BUILD_COMMIT`. The dev server never refuses: it serves what it has, with `unspecified` fields, and warns. A missing branch, or a dependency that is not installed, is a warning in both.

The dev server answers `GET` and `HEAD` on the file's path under its `base`, with `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store`. Any other method gets `405`.

If the file cannot be resolved, the cause goes to the terminal and the response is a `500` with no path and no stack; the next request tries again. The server resolves the file once, so restart it after an install.

### Read it in the app

```ts
import type { IBuildInfoFile } from '@venizia/ardor';

const response = await fetch('/build-info.json');
const info: IBuildInfoFile = await response.json();

console.log(`${info.service} ${info.version} (${info.commit} on ${info.branch})`);
```

Serve it under the base of your app (`import.meta.env.BASE_URL`) when the app is not at the root. An About page shows `version`, `commit`, `builtAt` and the `frameworks` list; it reads the file at run time, so one image still serves every environment.

> [!NOTE]
> IGNIS's `BuildInfoResolver` reads git through Bun, so under Node, where Vite runs, it returns `unspecified` for the commit and the branch. The plugin asks git itself for those two when the pipeline gave none. That fallback goes when `@venizia/ignis-boot` reads git under Node ([VENIZIA-AI/ignis#537](https://github.com/VENIZIA-AI/ignis/issues/537)).

## Next steps

- [Create a project](./create-a-project): the generated app and its image, which passes the build variables.
- [Setup](./setup): the TypeScript options an ARDOR app needs.
