---
title: Runtime config in the app preset, one image for every environment
description: The app preset writes config.js from VITE_ variables at container start, getRuntimeConfig reads it, and APP_REQUIRED_ENV stops a container early.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-22

## Runtime config in the app preset, one image for every environment

<Badge type="tip" text="New Feature" />

**In one line.** An app made by `vulcan init --preset ardor` reads its API address when the container starts, so one built image runs in every environment, and it can refuse to start when a variable it needs is missing.

## What changed

- **`config.js` at container start.** The image writes `/config.js` from the container's environment variables that start with `VITE_`, and `index.html` loads it before the app. `docker run -e VITE_API_URL=https://api.example.com image` is enough.
- **`getRuntimeConfig`.** `@venizia/ardor-kernel` (and `@venizia/ardor`) export `getRuntimeConfig({ key, buildTimeEnv, defaultValue })`: the value from `config.js`, else the build-time one you pass (`import.meta.env`), else the default. The preset uses it for `VITE_API_URL`, the address the REST data provider calls (default `/api`).
- **Safe by default.** Only `VITE_` variables are published, every value is escaped, a `VITE_` name with `SECRET`, `PASSWORD` or `TOKEN` stops the container, and `config.js` is never cached. A `VITE_` value is public: every visitor can read it.
- **Required variables.** `APP_REQUIRED_ENV` is a comma-separated list of names, for example `VITE_API_URL,API_UPSTREAM`. Set it in the Dockerfile with `ENV APP_REQUIRED_ENV="VITE_API_URL,API_UPSTREAM"`, or pass `-e APP_REQUIRED_ENV=...` for one environment. A listed variable that is unset or empty stops the container with exit code 1, and no `config.js` is written.
- **A clear message.** It names every missing variable at once, in your order, and never prints a value: `[runtime-config] FATAL: required variable(s) missing or empty: VITE_API_URL, VITE_MAPS_KEY`.
- **Any name.** You can require a variable that is not published, such as `API_UPSTREAM`. Spaces around a name and empty entries are ignored. An entry that is not a variable name stops the container, and the message gives its position in the list.
- **`.env.example`** lists `VITE_API_URL`, and the Dockerfile carries a commented `APP_REQUIRED_ENV` line to uncomment. Nothing is required by default.

## Who is affected

- **A new app.** It has the runtime config. No action needed.
- **An app already generated from the preset.** Nothing changes. To get it, copy `.configs/builders/docker-entrypoint.d/40-runtime-config.sh`, `src/public/config.js`, the `config.js` script tag of `src/index.html`, the `location = /config.js` block of the nginx template and the `COPY --chmod=0755` line of the Dockerfile. To use the required-variable check, also add the `ENV APP_REQUIRED_ENV` line to the Dockerfile.
- **An app that writes its own `config.js`** (for example from a `docker-entrypoint.d` script): it can keep it, or read it with `getRuntimeConfig` if the global is named `window.__APP_CONFIG__`.
- **A mounted `config.js`.** A read-only file that an operator mounts over `config.js` is kept as it is, and the listed variables are not checked, because the operator supplied the configuration.
