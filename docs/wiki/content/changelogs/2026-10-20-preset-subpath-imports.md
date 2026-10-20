---
title: The preset app imports its own modules with #src
description: The generated admin resolves its own modules through package.json imports (#src/...) instead of a Vite alias and a tsconfig paths entry. The smoke proves dev, build, type check and lint resolve them.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## The preset app imports its own modules with #src

<Badge type="tip" text="Enhancement" />

**In one line.** In an app made by `vulcan init --preset ardor`, a module of the app is imported as `#src/pages/product-list`, resolved by the `imports` field of the app's `package.json`, not by a Vite alias.

## What changed

- **No alias, no `paths`.** The Vite config no longer sets `resolve.alias` (`@` pointed at `/src`, an absolute file system path) and the tsconfig no longer has a `paths` entry. The app's `package.json` carries `"imports": { "#src/*.json": "./src/*.json", "#src/*": "./src/*.js" }`, written by VULCAN from the preset.
- **Every tool resolves it.** Vite maps `#src/application` to `src/application.ts` in dev and in the build; `bun check` and `tsc`, oxlint, eslint and oxfmt accept it. The class the Ignis artifacts plugin finds (`AdminConfiguration`) is in the built bundle, and the production build starts and shows the list page.
- **The smoke proves it.** It checks the `imports` field, that no source reads `@/` and that nothing sets an alias, that the dev server serves the entry and two `#src` modules, and that the built bundle holds `AdminConfiguration`.

## Who is affected

- **An app already generated from the preset.** Nothing breaks. To use the same layout, add the `imports` field, replace `@/` with `#src/` in the app's imports, and remove the alias and the `paths` entry.
- **A new app.** It starts with `#src` imports. It needs VULCAN 0.3.4 or newer, which adds the preset `imports` field.
