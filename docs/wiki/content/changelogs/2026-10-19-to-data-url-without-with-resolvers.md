---
title: toDataUrl no longer needs Promise.withResolvers
description: toDataUrl builds its promise with new Promise, so it runs on a Chrome older than 119.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-19

## toDataUrl no longer needs Promise.withResolvers

<Badge type="info" text="Bug Fix" />

**In one line.** `toDataUrl({ blob })` used `Promise.withResolvers` (ES2024, Chrome 119), so it threw on an older WebView. It builds the promise with `new Promise` now.

```ts no-check
// ... `blob` is any Blob. Same call, same result: a `data:` URL for it.
const dataUrl = await toDataUrl({ blob });
```

## What changed

- **No ES2024 call.** `toDataUrl` resolves from `FileReader.onloadend` and rejects from `onerror`, as before. It was the only use of `Promise.withResolvers` in the four packages.
- **ARDOR states no browser floor.** The packages build with `target: ESNext`, so this change fixes one call and does not promise a minimum Chrome.

## Who is affected

- **An application whose WebView or browser is older than Chrome 119** and that calls `toDataUrl`. It works now. A polyfill for `Promise.withResolvers` is no longer needed for it.
- **Everyone else.** No action needed.
