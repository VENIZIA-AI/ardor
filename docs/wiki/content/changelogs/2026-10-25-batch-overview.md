---
title: Everything since ARDOR 0.4.1 in one place, with an upgrade checklist
description: A table of every change since 0.4.1 grouped by kind and linked to its entry, and the checklist an application and a contributor follow to move to the next ARDOR release.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-25

## Everything since ARDOR 0.4.1 in one place, with an upgrade checklist

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" /> <Badge type="info" text="Bug Fix" />

<!-- Replace X.Y.Z with the release version when the batch is released. -->

**In one line.** Nothing here breaks an application on ARDOR 0.4.1. Two additions in the kernel (`getRuntimeConfig` can require a value, and its error carries a code), one in the preset image (nginx), and repository tooling. The four packages are 0.4.2 on npm today; the changes marked `X.Y.Z` are not released yet.

```bash
bun add @venizia/ardor
```

## What changed

| Kind | Change | Packages | In | Entry |
|------|--------|----------|----|-------|
| New feature | `getRuntimeConfig({ key, required: true })` returns a `string` and throws, naming the key, when no value is set | `@venizia/ardor-kernel`, `@venizia/ardor` | 0.4.2 | [getRuntimeConfig can require a value](./2026-10-25-runtime-config-required) |
| New feature, security | The preset image gzips text, answers `/health`, sends three security headers on every response, and writes the `/api` proxy only when `API_UPSTREAM` is set | `@venizia/ardor` (the preset) | 0.4.2 | [The preset image compresses, answers /health, sends security headers and can drop /api](./2026-10-25-preset-nginx) |
| Enhancement | The error of `required: true` has the code `RUNTIME_CONFIG_REQUIRED_CODE` and the key in `extra.key` | `@venizia/ardor-kernel`, `@venizia/ardor` | `X.Y.Z` | [The required error of getRuntimeConfig has a code](./2026-10-25-runtime-config-required-code) |
| Bug fix | A preset change counts for the release sweep of `ardor` | repository tooling | `X.Y.Z` | [Repository tooling](./2026-10-25-repository-tooling) |
| Tooling | The preset smoke and the clean-install check keep their scratch folders under `.agents/local/tmp` | repository tooling | 0.4.2 | [Repository tooling](./2026-10-25-repository-tooling) |
| Tooling | The preset smoke keeps its Chrome profile in a short folder it removes; script tests use the repository's scratch folder | repository tooling | `X.Y.Z` | [Repository tooling](./2026-10-25-repository-tooling) |
| Tooling | `make docs` keeps the folder of its snippet check in `.agents/local/tmp` and removes it on every exit | repository tooling | `X.Y.Z` | [Repository tooling](./2026-10-25-repository-tooling) |
| Tooling | String unions in the scripts are const classes | repository tooling | `X.Y.Z` | [Repository tooling](./2026-10-25-repository-tooling) |
| Tooling | VULCAN dev dependency 0.4.2 to 0.4.4 | repository tooling | `X.Y.Z` | [Repository tooling](./2026-10-25-repository-tooling) |
| Documentation | Changelog dates, the removed `./socket-io` guidance, neutral minimap labels and the kernel size budget read from `package.json` | repository only | no package | none: pages and rules, no behavior |

| Package | On npm now | Next release |
|---------|------------|--------------|
| `@venizia/ardor` | 0.4.2 | `X.Y.Z` |
| `@venizia/ardor-kernel` | 0.4.2 | `X.Y.Z` |
| `@venizia/ardor-react`, `@venizia/ardor-admin` | 0.4.2 | `X.Y.Z` |

The IGNIS peers stay `^0.4.1`: no change in this batch needs a newer IGNIS.

## Who is affected

- **An application on ARDOR 0.4.1.** No action is needed to keep running. The checklist below takes the new behavior.
- **An application generated from the preset.** Optional: copy the nginx files (step 3) to get compression, `/health` and the headers.
- **A maintainer or a contributor of this repository.** Steps 5 and 6.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `X.Y.Z`, with the `@venizia/ignis-*` packages you already have (0.4.1 or newer).
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
5. **Contributors: run `make vulcan-sync` after pulling,** so your adapters carry the VULCAN 0.4.4 base rules.
6. **Contributors: the preset smoke's Chrome profile is the one exception to "scratch files live in `.agents/local/tmp`".** It is a short folder under `XDG_RUNTIME_DIR` (else the system temp folder), removed in a `finally`, because Chrome's socket path stops working past 107 characters. Do not delete the `com.google.Chrome.*` folders already in your system temp folder.

## Details

- Every row of the table links the entry that holds the detail and the migration; this page repeats none of it.
- Replace `X.Y.Z` here and in the table when the batch is released.
