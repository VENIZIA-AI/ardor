---
title: The preset image compresses, answers /health, sends security headers and can drop /api
description: The nginx configuration of an app made from the ARDOR preset gzips text, answers /health, sends three security headers on every response, and writes the /api proxy only when API_UPSTREAM is set.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-25

## The preset image compresses, answers /health, sends security headers and can drop /api

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" /> <Badge type="danger" text="Security" />

**In one line.** The image of an app made from the ARDOR preset now gzips text, answers `/health` from nginx alone, sends safe security headers on every response, and leaves out the `/api` proxy when `API_UPSTREAM` is empty, for an app served behind a gateway.

## What changed

- **Compression.** nginx gzips plain text, JavaScript, CSS, JSON, XML, web manifests and SVG. Images and fonts are left alone.
- **`/health`.** `GET /health` answers `200 ok` from nginx, never cached, without calling the backend. Point a load balancer or an orchestrator probe at it.
- **Security headers.** Every response, errors included, carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: SAMEORIGIN`. A `Content-Security-Policy` is a commented example only: the right one depends on what your app loads.
- **`/api` only when asked for.** The proxy is written at container start, and only when `API_UPSTREAM` is set and not empty. The default is still `http://api:3000`, so nothing changes until you empty it (`ENV API_UPSTREAM=` in the Dockerfile, or `-e API_UPSTREAM=`). A value that is not an address, such as one with a space, a `;` or a quote, stops the container and the message never prints the value.
- **The cache rules are unchanged.** `config.js` is `no-store`, `/assets/` is `immutable` for a year, every other route is `no-cache` with the `index.html` fallback.

## Who is affected

- **A new app.** Nothing to do: the files are generated.
- **An app already generated from the preset.** No action is needed to keep running as it is. To get the new behavior, copy the files below.
- **An app served behind a gateway.** Empty `API_UPSTREAM` after copying, and the image has no `/api`; a request to `/api/...` then reaches the app's `index.html`, not a backend.

## Copy the new files into an existing app

The preset is published inside `@venizia/ardor` at `dist/presets/app/files/.configs/builders/`, after the next release. Until then, copy from the repository, at `presets/app/files/.configs/builders/`. In the files you copy, replace the tokens `{{app}}` and `{{appPath}}` (the app name and its folder) the way the existing Dockerfile has them.

1. **Replace** `nginx.conf.template` with the new one.
2. **Add** the folder `nginx-snippets/` (`security-headers.conf` and `api-proxy.conf`).
3. **Add** `docker-entrypoint.d/45-api-proxy.sh`, next to `40-runtime-config.sh`.
4. **In the Dockerfile**, add these lines in the `production` stage, beside the existing `COPY` lines:

   ```dockerfile
   COPY --from=builder /home/bun/app/<appPath>/.configs/builders/nginx-snippets /etc/nginx/snippets
   COPY --from=builder --chmod=0755 /home/bun/app/<appPath>/.configs/builders/docker-entrypoint.d/45-api-proxy.sh /docker-entrypoint.d/45-api-proxy.sh
   ```

5. **Rebuild** the image.

> [!WARNING]
> Copy all of it. The new template includes `/etc/nginx/snippets/security-headers.conf`, so a template copied without step 2 and the Dockerfile lines makes nginx refuse to start. The `0755` matters: the base image skips a script that is not executable, and then `/api` is never written.

If you changed your template, keep your changes and add four things to it: the `gzip` lines, `location = /health`, the line `include /etc/nginx/snippets/security-headers.conf;` in the server and again in every location that sets `add_header`, and `include /etc/nginx/conf.d/*.locations;` in place of your `location /api/` block (which now lives in `nginx-snippets/api-proxy.conf`).

## Details

- **Why every location includes the headers.** nginx passes `add_header` down from the server only into a location that sets none of its own, and each location here sets `Cache-Control`. One snippet, included everywhere, keeps the headers in one place.
- **Why a script writes `/api`.** A template cannot leave a block out on a condition, and an unset `${API_UPSTREAM}` would reach nginx as an unknown variable. The script renders `api-proxy.conf` into `conf.d/api-proxy.locations` when the variable has a value, and nginx includes whatever `conf.d/*.locations` matches, which may be nothing.
- **Frames.** `X-Frame-Options: SAMEORIGIN` lets the app frame itself. To allow another site, remove the header and set `frame-ancestors` in your Content-Security-Policy.
