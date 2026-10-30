---
title: Everything since ARDOR 0.4.1 in one place, with an upgrade checklist
description: A table of every change since 0.4.1 linked to its entry, and the checklist an application follows to move to ARDOR 0.4.3.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-25

## Everything since ARDOR 0.4.1 in one place, with an upgrade checklist

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" /> <Badge type="warning" text="Behavior Change" />

**In one line.** Nothing here breaks an application on ARDOR 0.4.1. Two additions in the kernel (`getRuntimeConfig` can require a value, and its error carries a code) and one in the preset image (nginx). ARDOR 0.4.2 carried the first and the third; ARDOR 0.4.3 adds the error code and the IGNIS 0.4.3 exports, and all four packages are 0.4.3.

```bash
bun add @venizia/ardor
```

## What changed

| Kind | Change | Packages | In | Entry |
|------|--------|----------|----|-------|
| New feature | `getRuntimeConfig({ key, required: true })` returns a `string` and throws, naming the key, when no value is set | `@venizia/ardor-kernel`, `@venizia/ardor` | 0.4.2 | [getRuntimeConfig can require a value](./2026-10-25-runtime-config-required) |
| New feature, security | The preset image gzips text, answers `/health`, sends three security headers on every response, and writes the `/api` proxy only when `API_UPSTREAM` is set | `@venizia/ardor` (the preset) | 0.4.2 | [The preset image compresses, answers /health, sends security headers and can drop /api](./2026-10-25-preset-nginx) |
| Enhancement | The error of `required: true` has the code `RUNTIME_CONFIG_REQUIRED_CODE` and the key in `extra.key` | `@venizia/ardor-kernel`, `@venizia/ardor` | 0.4.3 | [getRuntimeConfig can require a value](./2026-10-25-runtime-config-required) |
| Enhancement | The repository sub-path exports `HttpReadShapes` and `THttpReadShape` from IGNIS 0.4.3 | `@venizia/ardor-kernel`, `@venizia/ardor` | 0.4.3 | [The repository sub-path exports HttpReadShapes](./2026-10-26-ignis-0-4-3-repository-exports) |

| Package | ARDOR 0.4.2 | ARDOR 0.4.3 |
|---------|------------|--------------|
| `@venizia/ardor` | 0.4.2 | 0.4.3 |
| `@venizia/ardor-kernel` | 0.4.2 | 0.4.3 |
| `@venizia/ardor-react`, `@venizia/ardor-admin` | 0.4.2 | 0.4.3 |

The IGNIS peers stay `^0.4.1`: no change in this batch needs a newer IGNIS.

## Who is affected

- **An application on ARDOR 0.4.1.** No action is needed to keep running. The checklist below takes the new behavior.
- **An application generated from the preset.** Optional: copy the nginx files (step 3) to get compression, `/health` and the headers.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `0.4.3`, with the `@venizia/ignis-*` packages you already have (0.4.1 or newer).
2. **Detect the required-value error by its code.** If the app matches the message of the `getRuntimeConfig` error, compare the code instead; the message is unchanged, so this is optional.

   ```typescript
   import { getRuntimeConfig, RUNTIME_CONFIG_REQUIRED_CODE } from '@venizia/ardor';
   import { isApplicationError } from '@venizia/ignis-inversion';

   try {
     getRuntimeConfig({ key: 'VITE_API_URL', required: true });
   } catch (error) {
     if (isApplicationError(error) && error.normalized.code === RUNTIME_CONFIG_REQUIRED_CODE) {
       console.error('missing config key', error.extra?.key);
     }
   }
   ```

   An app with its own "config or throw" helper can replace it with `required: true`.
3. **Copy the preset's nginx files into an app made from the preset.** Replace `nginx.conf.template`, add the folder `nginx-snippets/` and `docker-entrypoint.d/45-api-proxy.sh`, add two `COPY` lines to the `production` stage of the Dockerfile (the second with `--chmod=0755`), and rebuild. Copy all of it: a template without the snippets makes nginx refuse to start. The exact lines are in [the nginx entry](./2026-10-25-preset-nginx).
4. **Check the two behaviors that can surprise an app.** An app behind a gateway empties `API_UPSTREAM` and then has no `/api` in the image. `X-Frame-Options: SAMEORIGIN` stops another site from framing the app: remove the header and set `frame-ancestors` in a Content-Security-Policy if you embed it elsewhere.
