---
title: Everything since ARDOR 0.4.1 in one place, with an upgrade checklist
description: A table of every change since 0.4.1 linked to its entry, and the checklist an application follows to move to ARDOR 0.4.3.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-25

## Everything since ARDOR 0.4.1 in one place, with an upgrade checklist

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" /> <Badge type="warning" text="Behavior Change" />

> [!NOTE]
> Since ARDOR 0.4.7, `getRuntimeConfig` is `RuntimeConfig.get`, with the same arguments and the same result. The code samples below use the old name. See [Utilities move to classes](./2026-11-01-class-namespaces).

**In one line.** Nothing here breaks an application on ARDOR 0.4.1. Two additions in the kernel (`getRuntimeConfig` can require a value, and its error carries a code) and one in the preset image (nginx). ARDOR 0.4.2 carried the first and the third; ARDOR 0.4.3 adds the error code and the IGNIS 0.4.3 exports, and all four packages are 0.4.3.

```bash
bun add @venizia/ardor
```

## What changed

Each change has its own entry in the [changelog list](./), newest first.

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
