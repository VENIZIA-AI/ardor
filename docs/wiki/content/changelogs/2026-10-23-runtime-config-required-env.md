---
title: A container stops when a required variable is missing
description: An app made from the ARDOR preset can list the variables it cannot run without in APP_REQUIRED_ENV, and its container stops at start, naming each one that is missing or empty.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-23

## A container stops when a required variable is missing

<Badge type="tip" text="New Feature" />

**In one line.** An app lists the variables it cannot run without in `APP_REQUIRED_ENV`, and its container refuses to start when one of them is missing or empty, instead of falling back to a build-time value.

## What changed

- **`APP_REQUIRED_ENV`.** A comma-separated list of variable names, for example `VITE_API_URL,API_UPSTREAM`. Put it in the app's Dockerfile with `ENV APP_REQUIRED_ENV="VITE_API_URL,API_UPSTREAM"`, or pass `-e APP_REQUIRED_ENV=...` to override it for one environment.
- **A clear stop.** A listed variable that is unset or empty stops the container with exit code 1. The message names every missing variable at once, in the order you listed them, and never prints a value: `[runtime-config] FATAL: required variable(s) missing or empty: VITE_API_URL, VITE_MAPS_KEY`. No `config.js` is written.
- **Any name.** You can require a variable that is not published, such as `API_UPSTREAM`. Spaces around a name and empty entries are ignored. An entry that is not a variable name stops the container too, and the message gives its position in the list.
- **The preset Dockerfile** carries a commented example line to uncomment.

## Who is affected

- **A new app.** Nothing is required by default, so the container behaves as before until you list variables.
- **An app already generated from the preset.** No action needed. To use the check, copy the new `.configs/builders/docker-entrypoint.d/40-runtime-config.sh` and add the `ENV APP_REQUIRED_ENV` line to the Dockerfile.
- **A mounted `config.js`.** A read-only file that an operator mounts over `config.js` is kept as it is, and the listed variables are not checked, because the operator supplied the configuration.
