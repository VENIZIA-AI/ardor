---
title: ARDOR ships a VULCAN preset
description: Create a monorepo with an ARDOR admin, or add an admin to an existing monorepo, with the ARDOR preset for VULCAN 0.3.0 or newer.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-20

## ARDOR ships a VULCAN preset

<Badge type="tip" text="New Feature" />

**In one line.** `vulcan init --preset ardor` creates a monorepo with a working ARDOR admin, and `vulcan add --preset ardor` adds one to a monorepo you already have (VULCAN 0.3.0 or newer).

## What changed

- **Initialize a monorepo.** `bun x @venizia/vulcan init --preset ardor` creates a monorepo with one ARDOR admin (Vite and React, the REST data provider, no sign-in). It runs the app's typecheck, lint, test and compile, then `vulcan doctor`.
- **Add to an existing monorepo.** `bun x @venizia/vulcan add --preset ardor` adds an admin (for example next to an IGNIS app), asks which backend to proxy `/api` to, keeps the monorepo's IGNIS versions, and refuses, naming both versions, when the catalog pins an IGNIS outside the supported range.
- **A styled first page.** The app shows the ARDOR logo, its name and the answer of the backend's `GET /api/hello` in one card, with a placeholder while loading and, when the backend is down, one line with the command that starts it. The call uses the data provider's `send`. Tailwind CSS v4 and shadcn-style components (copied to `src/components/shadcn/`) give a light and a dark theme that follow the system. To add more components with the shadcn CLI, run `bunx shadcn init` first, which writes its own `components.json`.
- **Quiet first run.** `bun run server:dev` and `bun run compile` print no Vite loader or chunk-size warnings. The config file is `vite.config.mts`.
- **One set of scripts.** `server:dev`, `compile`, `typecheck` (`bun check`), `lint`, `lint:fix`, `test` and `clean`. See [Every app has the same scripts](./2026-10-20-app-script-standard).
- **`#src` imports.** The app imports its own modules as `#src/pages/...`, resolved by the `imports` field of its `package.json`, with no Vite alias and no tsconfig `paths` (needs VULCAN 0.3.4 or newer).
- **No formatter config.** `devz lint` formats with `bun fmt` in the style of the `bunfig.toml` at the monorepo root (single quotes, width 100, no parentheses around a single arrow parameter), and `.configs/lints/.ignore` and `.configs/formatters/.ignore` list the files to skip, one gitignore-style pattern per line.
- **A tidy root.** The app root holds only `.configs`, `src`, `package.json`, `tsconfig.json` and `.env.example`. `index.html` is in `src/`. `.env.example` lists `PORT` and `API_URL` (the backend that `/api` is forwarded to). Copy it to `.env` to change them on your machine; an empty value keeps the default.
- **A Dockerfile.** `.configs/builders/Dockerfile` builds the app in three stages (install, compile, serve). nginx serves `dist/` on port 8080, answers every route that is not a file with `index.html`, and sends `/api` to `API_UPSTREAM` (default `http://api:3000`). Build it from the monorepo root: `docker build -f apps/web/.configs/builders/Dockerfile .`.
- **An image that starts without its backend.** nginx looks `API_UPSTREAM` up for each request, so the page loads and `/api` answers `502` until the backend resolves. `API_UPSTREAM` is an origin, with no path, resolved by DNS: a compose or cluster service name and an IP address work, a name from `docker run --add-host` does not.
- **A real commit, or no image.** The build stops unless `APP_BUILD_COMMIT` is a sha of at least seven lowercase hex digits. Pass the output of `git rev-parse HEAD` from a repository that has a commit.
- **Guide.** [Create a project](../guides/get-started/create-a-project).

## Who is affected

- **Existing applications.** Nothing in the runtime API changed, and an app already generated from the preset keeps working. To follow the new layout, copy the files you want from a newly generated app. In short:
  - Rename `vite.config.ts` to `vite.config.mts` (update `include` in `tsconfig.json`) and copy the `build` block of the new one.
  - Add the `imports` field to `package.json`, replace `@/` with `#src/` in your imports, and remove the alias and the `paths` entry.
  - Set `typecheck` to `bun check --no-pretty -p tsconfig.json`; `typescript` stays a dev dependency for the editor and the build config.
  - Move `index.html` to `src/`, set `root: 'src'` in the Vite config, and copy the Dockerfile (with its `ENV` lines), the nginx template (its `resolver` and `set` lines make the image start without its backend), the `API_URL` lines of `.env.example` and of the Vite config, and the two `.ignore` files.
  - Delete `.configs/formatters/oxfmt.config.mts` and the `oxfmt` entry of its `package.json`, then run `devz lint --fix` once (it reformats `(x) => x`). This needs VULCAN 0.3.12 or newer and `@venizia/dev-configs` 0.4.0 or newer. A project's own `.oxfmtrc.json`, `.oxfmtrc.jsonc` or `oxfmt.config.ts` overrides the `bunfig.toml`; remove it to follow the root file.
- **A new app.** It has all of this. It needs VULCAN 0.3.12 or newer and `@venizia/dev-configs` 0.4.0 or newer.
- **A pipeline that builds the image.** Any `APP_BUILD_COMMIT` that is not a sha now stops the build.
