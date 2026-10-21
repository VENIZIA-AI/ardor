---
title: A tidy app root and a Dockerfile in the preset
description: An app made by vulcan init --preset ardor keeps only .configs, src, package.json, tsconfig.json and .env.example at its root, and has a Dockerfile that builds it and serves it with nginx.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-21

## A tidy app root and a Dockerfile in the preset

<Badge type="tip" text="Enhancement" />

**In one line.** An app made by `vulcan init --preset ardor` has nothing at its root but what must be there, and `docker build` makes an image of it.

## What changed

- **A short root.** `index.html` is in `src/` (Vite's root is `src/`, and the build still writes `dist/`). The `scripts/` folder and the `README.md` are gone: `compile` is `vite build --config .configs/builders/vite.config.mts` and `clean` is `devz clean`. A library made by the preset loses the same two.
- **A Dockerfile.** `.configs/builders/Dockerfile` builds the app in three stages (install, compile, serve) and `.configs/builders/nginx.conf.template` serves `dist/` with nginx on port 8080: every route that is not a file answers with `index.html`, and `/api` goes to the backend named by `API_UPSTREAM` (default `http://api:3000`).
- **Built from the monorepo root.** `docker build -f apps/web/.configs/builders/Dockerfile .` copies the whole context, so the workspace packages and the lockfile are there, and the root `.dockerignore` keeps it small. A project can list the packages it needs by hand, for a better cache.

## Who is affected

- **An app already generated from the preset.** Nothing changes. To follow the new layout, move `index.html` to `src/`, set `root: 'src'` in the Vite config, and copy the Dockerfile and the nginx template.
- **A new app.** It has the short root and the Dockerfile. It needs `@venizia/dev-configs` 0.3.4 or later for `devz`.
