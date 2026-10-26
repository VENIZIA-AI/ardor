---
title: Vite setup
description: What an ARDOR app needs in its Vite 8 config - the chunk order flag the preset turns on, and the buildInfoFile plugin that writes build-info.json for an About page.
---

# Vite setup

An ARDOR app builds with Vite 8.3.5 or newer. The preset's `vite.config.mts` already has what is below; this page is for an app that wrote its own config, and for the `buildInfoFile` plugin, which the preset does not use.

## Run modules in the order they import each other

Rolldown can run a split-off chunk before the module that another module in it depends on. When that module is `reflect-metadata` and the other is a DI package that needs `Reflect.getMetadata` as it is evaluated, a production build fails in the browser with `Reflect.getMetadata is not a function` while `vite dev` works ([vitejs/vite#21866](https://github.com/vitejs/vite/issues/21866)).

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

The extra weight is in the `vendor` chunk, which the browser caches across deploys. Measured on Vite 8.3.5 with Rolldown 1.2.14; the same build loads in a real browser with no console error. An app on Vite 8.1.0 reported `React$12 is not defined` with the flag on, so keep Vite at 8.3.5 or newer and check the built app in a browser after you turn it on.

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

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `root` | `string` | the folder Vite runs in | The app folder, where `package.json` is. |
| `fileName` | `string` | `'build-info.json'` | The path under the output folder and under the dev server's base: letters, digits, `.`, `_`, `-` and `/`, ending in `.json`, never `..`. |
| `frameworkScope` | `string` | `'@venizia/'` | Dependencies whose name starts with this are listed under `frameworks`. |
| `onUnresolved` | `'error' \| 'unspecified'` | `'error'` | What a build does when no commit is found in the pipeline or in git. |

A build with no commit fails with a message that says to build inside a git checkout or to set `APP_BUILD_COMMIT`. The dev server never refuses: it serves what it has, with `unspecified` fields, and warns. A missing branch, or a dependency that is not installed, is a warning in both.

The dev server answers `GET` and `HEAD` on the file's path under its `base`, with `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store`; any other method gets `405`.

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
