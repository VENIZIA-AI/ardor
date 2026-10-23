---
title: Runtime config in the app preset, one image for every environment
description: The ARDOR app preset writes config.js from the container's VITE_ variables at start, and getRuntimeConfig reads it, so an API address no longer needs a new build.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-22

## Runtime config in the app preset, one image for every environment

<Badge type="tip" text="New Feature" />

**In one line.** An app made by `vulcan init --preset ardor` reads its API address when the container starts, so one built image runs in every environment.

## What changed

- **`config.js` at container start.** The image writes `/config.js` from the container's environment variables that start with `VITE_`, and `index.html` loads it before the app. `docker run -e VITE_API_URL=https://api.example.com image` is enough.
- **`getRuntimeConfig`.** `@venizia/ardor-kernel` (and `@venizia/ardor`) export `getRuntimeConfig({ key, buildTimeEnv, defaultValue })`: the value from `config.js`, else the build-time one you pass (`import.meta.env`), else the default. The preset uses it for `VITE_API_URL`, the address the REST data provider calls (default `/api`).
- **Safe by default.** Only `VITE_` variables are published, every value is escaped, a `VITE_` name with `SECRET`, `PASSWORD` or `TOKEN` stops the container, and `config.js` is never cached. A `VITE_` value is public: every visitor can read it.
- **`.env.example`** lists `VITE_API_URL`.

## Who is affected

- **A new app.** It has the runtime config. No action needed.
- **An app already generated from the preset.** Nothing changes. To get it, copy `.configs/builders/docker-entrypoint.d/40-runtime-config.sh`, `src/public/config.js`, the `config.js` script tag of `src/index.html`, the `location = /config.js` block of the nginx template and the `COPY --chmod=0755` line of the Dockerfile.
- **An app that writes its own `config.js`** (for example from a `docker-entrypoint.d` script): it can keep it, or read it with `getRuntimeConfig` if the global is named `window.__APP_CONFIG__`.
