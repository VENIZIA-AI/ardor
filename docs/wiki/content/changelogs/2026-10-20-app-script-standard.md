---
title: Every app has the same scripts
description: The generated admin and the three examples use one set of package.json script names (server:dev, compile, typecheck, lint, lint:fix, test, clean), and every library package has the same Makefile targets.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## Every app has the same scripts

<Badge type="warning" text="Breaking Change" />

**In one line.** In an app made by `vulcan init --preset ardor`, and in each ARDOR example, you start the dev server with `bun run server:dev` and build with `bun run compile`; the names `dev` and `build` are gone.

## What changed

- **One set of names.** Every app, backend or frontend, has `server:dev`, `compile`, `typecheck`, `lint`, `lint:fix`, `test` and `clean`. `server:dev` runs Vite, `compile` runs `sh scripts/compile.sh` (which runs `vite build` into `dist/`), `typecheck` runs `bun check`, `lint` and `lint:fix` run `devz lint`, `test` runs `bun test` and `clean` runs `sh scripts/clean.sh` (which removes `dist/`).
- **No other names.** `dev`, `start`, `build`, `rebuild`, `preview`, `api` and `server:prod` are not scripts of an app any more.
- **The preset ships a test.** A generated admin has `src/application.test.ts`, which starts the container and checks that the configuration binds the REST data provider options, so `bun run test` runs a real test from the first day. The first-run checks are now `typecheck`, `lint`, `test` and `compile`.
- **The examples follow the same names.** `bun run server:dev` in `examples/5-mins-qs` starts the stub API on :3100 together with Vite, and stops the API when Vite stops. `examples/ipc-data-provider` compiles with `bun build` into `dist/`.
- **A library has the same targets as make targets.** Each package has `build`, `typecheck`, `lint`, `lint-fix`, `test` and `clean`. `make fmt` is now `make lint-fix`, and `make fmt-<package>` and `make fmt-wiki` became `make lint-fix-<package>` and `make lint-fix-wiki`. The `package.json` of a package keeps only `prepublishOnly` and `force-update`.

## Who is affected

- **An app already generated from the preset.** Nothing breaks until you update scripts by hand or by script. To follow the standard, rename `dev` to `server:dev` and `build` to `compile`, add `scripts/compile.sh` (`vite build`) and `scripts/clean.sh` (`rm -rf dist`), and add a `test` script.
- **A new app.** It has the new names. It needs VULCAN 0.3.6 or newer for the root `make dev` to run `server:dev`.
- **A contributor who ran `make fmt`.** Run `make lint-fix` instead.
- **A package consumer.** No effect: the published packages are unchanged.

## Breaking changes

- `bun run dev` and `bun run build` no longer exist in a generated admin or in an example. Use `bun run server:dev` and `bun run compile`.
- `make fmt`, `make fmt-<package>` and `make fmt-wiki` no longer exist. Use `make lint-fix`, `make lint-fix-<package>` and `make lint-fix-wiki`.
