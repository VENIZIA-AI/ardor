---
title: An .env.example that matches the app, ignore files, and a sturdier image
description: The ARDOR app preset lists API_URL next to PORT, ships comment-only lint and format ignore files, and builds an image that starts without its backend and refuses a commit that is not a sha.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-21

## An .env.example that matches the app, ignore files, and a sturdier image

<Badge type="tip" text="Enhancement" /> <Badge type="info" text="Bug Fix" />

**In one line.** An app made by `vulcan init --preset ardor` reads `PORT` and `API_URL` from `.env`, has a place to skip files in `devz lint`, and makes an image that starts when its backend is not there yet.

## What changed

- **`API_URL` in `.env.example`.** The dev server reads `PORT` and `API_URL` (the backend `/api` is forwarded to). Copy `.env.example` to `.env` to change them on your machine; an empty value keeps the default. The file lists only what the app reads.
- **Ignore files.** `.configs/lints/.ignore` and `.configs/formatters/.ignore` hold only comments. Add one gitignore-style pattern per line and `devz lint` skips those files: the first for oxlint and ESLint, the second for the formatter. A library made by the preset gets them too.
- **The image starts without its backend.** nginx looks `API_UPSTREAM` up for each request, so a container whose backend does not resolve yet serves the page and answers `502` on `/api`, instead of stopping with `host not found in upstream`. `API_UPSTREAM` is an origin, with no path, and nginx resolves its host with DNS, not `/etc/hosts`: a compose or cluster service name and an IP address work, a name added with `docker run --add-host` does not.
- **A real commit, or no image.** The build stops unless `APP_BUILD_COMMIT` is a sha of at least seven lowercase hex digits. Before a first commit, `git rev-parse HEAD` prints `HEAD`, and the image used to carry that as its revision label.

## Who is affected

- **An app already generated from the preset.** No action needed. To follow the new files, copy the two `.ignore` files, the `API_URL` lines of `.env.example` and the Vite config, and the `resolver` and `set` lines of the nginx template with the matching `ENV` of the Dockerfile.
- **A pipeline that builds the image.** Pass the output of `git rev-parse HEAD` from a repository that has a commit; any other value now stops the build.
