---
title: Create a Project
description: Scaffold a new ARDOR monorepo or add an admin application to an existing monorepo with VULCAN.
---

# Create a Project

`bun x @venizia/vulcan init --preset ardor` creates a monorepo with one ARDOR admin inside it. To add an admin to a monorepo that already exists, run `bun x @venizia/vulcan add --preset ardor` at its root.

Both commands need VULCAN 0.3.0 or newer.

## Initialize a New Monorepo

In a terminal, `init` asks four questions with nothing pre-filled: project name (the monorepo folder), frontend folder (holds every frontend app), the app name, and shared code folder (empty to skip). Without a terminal, pass each answer as a flag: `--project`, `--frontend-dir`, `--app`, and `--shared-dir` (leave the last one out to skip it). A name is lowercase letters, digits and `-`:

```bash
bun x @venizia/vulcan init --preset ardor --project demo --frontend-dir apps --app admin
```

It prints `created <path>` for each file, runs `bun install`, `vulcan sync`, the app's four checks (`bun run typecheck`, `bun run lint`, `bun run test`, `bun run compile`), `vulcan doctor` and `vulcan x okf check --strict`, and ends with:

```text
Done. Next:
  cd demo && make dev
  open http://localhost:5173
```

### What it Created

The command generates the project folder `demo/`:

```text
demo/
  package.json            workspaces, one catalog with every version
  Makefile  README.md  AGENTS.md  .mcp.json  .gitignore
  .configs/vulcan.config.mts
  .agents/rules.md  .agents/knowledge/{index.md,log.md,packages/admin.md}
  apps/admin/
    package.json  tsconfig.json  index.html  .env.example  README.md
    .configs/lints/{oxlint.config.mts,eslint.config.mjs}  .configs/formatters/oxfmt.config.mts
    .configs/builders/vite.config.mts  scripts/{compile,clean}.sh
    src/main.tsx  src/application.ts  src/application.test.ts
    src/configurations/admin.configuration.ts
    src/pages/{product-list,product-create,product-edit,product-form}.tsx
```

The application is small:

- `src/main.tsx` renders `ArdorApplication` with the `products` resource.
- `src/application.ts` is the application, which lists the decorated classes the Vite plugin found (`AutoArtifacts`).
- `src/configurations/admin.configuration.ts` binds the REST data provider and the i18n provider (the auth provider stays unbound, so every page is public).
- `src/pages/*` are the list, create and edit pages of `products`.
- `src/application.test.ts` is the one test: it starts the container and checks that the configuration binds the REST data provider options.
- `package.json` has the script names every ARDOR and IGNIS app has: `server:dev` (Vite), `compile` (`sh scripts/compile.sh`, which runs `vite build` into `dist/`), `typecheck` (`bun check`), `lint` and `lint:fix` (`devz lint`, the `devz` bin of `@venizia/dev-configs`), `test` (`bun test`) and `clean` (`sh scripts/clean.sh`, which removes `dist/`). There is no `dev` and no `build`.
- `.configs/builders/vite.config.mts` has the dev port from `.env.example` (PORT, default 5173) and the `/api` proxy.

### Expected API

The app has no sign-in and expects an API with a `products` resource: `GET /api/products` returning a JSON array with a `Content-Range` header, `POST /api/products`, `PATCH /api/products/:id`. To use another resource, rename `products` in `src/main.tsx` and the pages. For sign-in, see [Add sign-in](../tutorials/add-sign-in).

## Add an Admin to an Existing Monorepo

To add an admin to a monorepo that already exists (for example one created with `bun x @venizia/vulcan init --preset ignis`), run `bun x @venizia/vulcan add --preset ardor` at its root. It asks the frontend folder (once chosen it is offered as the answer next time), the app name and the backend app to proxy `/api` to (the backend apps of the monorepo, or none: flag `--api <app>` or `--no-api`). The dev server port is 5173, or the next free one when another app already uses it. The proxy target is `http://localhost:<port of that backend app>`, read from the backend's `.env.example`.

The monorepo's catalog keeps its IGNIS versions: a version already in the catalog wins, so every app shares one copy. If the catalog pins an IGNIS version outside the range ARDOR supports, `add` stops before writing anything and names both versions, for example `the monorepo pins @venizia/ignis-kernel 0.1.0, but the preset needs ^0.2.2 - move the catalog first`.

## Add a Feature Library

A feature is a package of routes, resources and messages that more than one app mounts. To add one to the monorepo, run this at its root:

```bash
bun x @venizia/vulcan add --preset ardor --lib merchant --dir libs
```

`--dir` is the folder of the libraries (without it, VULCAN uses the folder of the libraries the monorepo already has), and `--scope @acme` sets the package scope. It needs the VULCAN release that supports library presets. Without `--lib` or `--app` it asks, and with no terminal it stops.

It creates `libs/merchant` as the package `@acme/merchant`:

```text
libs/merchant/
  package.json     name, exports ".", imports #src/*, the scripts, catalog: versions
  tsconfig.json  README.md  scripts/clean.sh
  .configs/lints/{oxlint.config.mts,eslint.config.mjs}  .configs/formatters/oxfmt.config.mts
  src/index.ts  src/feature.ts  src/feature.test.ts
```

- `src/feature.ts` is `Features.define({ name: 'merchant' })`, empty until you add routes, resources and messages to it.
- `src/feature.test.ts` mounts it in a small application and reads it back, so the test runs from the first day.
- The scripts are `typecheck`, `lint`, `lint:fix`, `test` and `clean`. There is no bundler and no dev server: an app that imports the package compiles its source.
- `@venizia/ardor`, `react`, `react-dom`, `react-router-dom` and `reflect-metadata` are peer dependencies, so the app decides the versions.

An app mounts the feature by listing it in `features()`: `import { feature } from '@acme/merchant'`.

## Next Steps

After `init` or `add`: `cd <project>`, `bun run server:dev` in `apps/admin` (or `make dev` at the root) serves the admin.

- Already have a Vite project? See [Set up your environment](./setup) for the manual way.
- For a guided walk through the code, see [5-minute quickstart](./5-minute-quickstart).
