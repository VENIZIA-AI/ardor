---
title: toDataUrl no longer needs Promise.withResolvers
description: toDataUrl builds its promise with new Promise, so it runs on a Chrome older than 119. A test now removes Promise.withResolvers and a stub FileReader proves it.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-19

## toDataUrl no longer needs Promise.withResolvers

<Badge type="tip" text="Bug Fix" />

**In one line.** `toDataUrl({ blob })` used `Promise.withResolvers` (ES2024, Chrome 119), so it threw on an older WebView; it builds the promise with `new Promise` now (issue #103, reported by BANA, whose POS WebView is Chrome 101).

```ts no-check
// ... `blob` is any Blob. Same call, same result: a `data:` URL for it.
const dataUrl = await toDataUrl({ blob });
```

## What changed

- **No ES2024 call.** `toDataUrl` resolves from `FileReader.onloadend` and rejects from `onerror`, as before. It was the only use of `Promise.withResolvers` in the four packages.
- **A real test.** The old test was marked `failing` because Bun has no `FileReader`. The new one stubs `FileReader`, deletes `Promise.withResolvers` for the run, and checks a resolved data URL and a rejection. It fails on the previous code with `Promise.withResolvers is not a function`.
- **ARDOR states no browser floor.** The packages build with `target: ESNext`, so this change fixes one call and does not promise a minimum Chrome. Pinning the `lib` to ES2022 does not catch an ES2023 API here, because the Bun and Node type packages load ESNext library files, so there is no compile-time guard.

## Who is affected

- **An application whose WebView or browser is older than Chrome 119** and that calls `toDataUrl`. It works now; a polyfill for `Promise.withResolvers` is no longer needed for it.
- **Everyone else.** No action needed.

| File | Package |
|------|---------|
| `src/utilities/file.ts` | kernel |
