---
title: Every app has the same scripts
description: The generated admin and the examples use one set of script names (server:dev, compile, typecheck, lint, test, clean). The names dev and build are gone.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## Every app has the same scripts

<Badge type="warning" text="Breaking Change" />

**In one line.** In an app made by `vulcan init --preset ardor`, and in each ARDOR example, you start the dev server with `bun run server:dev` and build with `bun run compile`; the names `dev` and `build` are gone.

## What changed

- **One set of names.** Every app has `server:dev` (runs Vite), `compile` (runs `vite build` into `dist/`), `typecheck` (runs `bun check`), `lint` and `lint:fix` (run `devz lint`), `test` (runs `bun test`) and `clean` (removes `dist/`).
- **No other names.** `dev`, `start`, `build`, `rebuild`, `preview`, `api` and `server:prod` are not scripts of an app any more.
- **A real test from day one.** A generated admin has `src/application.test.ts`, which starts the container and checks that the configuration binds the REST data provider options. The first-run checks are `typecheck`, `lint`, `test` and `compile`.
- **The examples follow the same names.** `bun run server:dev` in `examples/5-mins-qs` starts the stub API on :3100 together with Vite, and stops the API when Vite stops. `examples/ipc-data-provider` compiles with `bun build` into `dist/`.

## Who is affected

- **An app already generated from the preset.** Nothing breaks until you change the scripts. To follow the standard, rename `dev` to `server:dev` and `build` to `compile`, add a `compile` command (`vite build`) and a `clean` command (`rm -rf dist`), and add a `test` script.
- **A new app.** It has the new names. It needs VULCAN 0.3.6 or newer for the root `make dev` to run `server:dev`.

## Breaking changes

- `bun run dev` and `bun run build` no longer exist in a generated admin or in an example. Use `bun run server:dev` and `bun run compile`.
