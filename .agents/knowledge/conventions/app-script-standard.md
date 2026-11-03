---
type: Convention
title: App script standard
description: Every app, backend or frontend, has the same package.json script names (server:dev, compile, typecheck, lint, lint:fix, test, clean) and keeps a script of more than one command in scripts/*.sh; a library package has the same targets in its Makefile instead.
resource: presets/app/preset.json
tags: [conventions, scripts, build]
---

One set of script names for every app in the VENIZIA family, so `cd <app> && bun run <name>` means the
same thing in a backend, in the generated admin and in an example. The standard is Phat's (VULCAN rule
`V-B-05`); this page records how ARDOR follows it.

## The apps

| Script | Runs | Notes |
|---|---|---|
| `server:dev` | the dev server | Vite for a frontend; `bun run src/index.ts` for a Bun script |
| `compile` | `vite build --config .configs/builders/vite.config.mts` | a frontend builds into `dist/`; the ipc example bundles with `bun build` |
| `typecheck` | `bun check --no-pretty -p tsconfig.json` | `tsconfig.json` is the only tsconfig at a project root; a project with more than one program (`5-mins-qs`: the app and its stub API) keeps a solution `tsconfig.json` (`"files": []` and `references`) and the programs in `.configs/builders/`, and `bun check` follows the references |
| `lint`, `lint:fix` | `devz lint`, `devz lint --fix` | the `devz` bin of `@venizia/dev-configs` (0.3.4 and later): oxlint, eslint with a cache, then `bun fmt` (its style is the root `bunfig.toml`), from `.configs/lints/` and `.configs/formatters/.ignore`; `devz lint [--fix] <files>` handles only those files |
| `test` | `bun test` | an example with no test passes with `--pass-with-no-tests`; the preset ships one test |
| `clean` | `devz clean` | the `devz` bin of `@venizia/dev-configs`: removes `dist` and the tool caches |

No app has `dev`, `start`, `build`, `rebuild`, `preview`, `api` or `server:prod`. The presets keep nothing at the
app root but `.configs/`, `src/`, `package.json`, `tsconfig.json` and `.env.example`: every script is one command (`vite`, `vite build --config ...`, `bun check`, `devz lint`,
`bun test`, `devz clean`), so there is no `scripts/` folder. An example whose script is more than one command still
has `scripts/<name>.sh` (POSIX `sh`, `set -eu`, `cd "$(dirname "$0")/.."`) and the `package.json` entry
`sh scripts/<name>.sh`.

`examples/5-mins-qs` has a script `scripts/server-dev.sh` that starts its stub API (`api/server.ts`, :3100)
next to Vite and stops the API when Vite stops; there is no separate `api` script, run `bun run
api/server.ts` for the API alone.

## The preset

`presets/app/` writes the standard into every generated admin: `preset.json` has the seven
scripts and `files/scripts/{lint,compile,clean}.sh`, with `src/application.test.ts` as the one test (it
starts the container and checks that `AdminConfiguration` binds the REST data provider options). The
preset's `checks` are `typecheck`, `lint`, `test` and `compile`. `scripts/preset/preset-smoke.ts` runs `server:dev`
(not `dev`), `compile` and `clean`, and fails when a script is missing or a forbidden name is present.

## The library packages

A library package (`kernel`, `react`, `admin`, `ardor`) keeps Makefile targets, not scripts: `build`,
`typecheck`, `lint`, `lint-fix`, `test` and `clean`, all from `make/project.mk`, plus `rebuild` (what
`prepublishOnly` runs) and `size`. The root targets (`make lint-fix`, `make test`,
`make lint-fix-<pkg>`, `make test-<pkg>`) call these. A library's `package.json` keeps only `force-update`
and `prepublishOnly`.

## Related

- [Build system](/process/build-system.md)
- [Build, run, test](/overview/build-run-test.md)
- [ardor](/packages/ardor.md)
