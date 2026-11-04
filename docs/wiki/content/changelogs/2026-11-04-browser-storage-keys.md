---
title: BrowserStorage.keys and removeWhere list and sweep keys by prefix
description: BrowserStorage.keys lists the keys of a storage area, and BrowserStorage.removeWhere removes the keys with a prefix, keeping the no-throw contract, the session guard and the subscriber notification.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-11-04

## BrowserStorage.keys and removeWhere list and sweep keys by prefix

<Badge type="tip" text="New Feature" />

**In one line.** `BrowserStorage.keys({ prefix })` lists the keys of an area, and `BrowserStorage.removeWhere({ prefix })` removes the keys that start with a prefix. An app that wants to sweep the keys a previous version wrote no longer has to drop to raw `localStorage` and give up what `BrowserStorage` provides.

```ts
import { BrowserStorage } from '@venizia/ardor';

const oldKeys = BrowserStorage.keys({ prefix: '@app/store/v1/' });
const removed = BrowserStorage.removeWhere({ prefix: '@app/store/v1/' });
```

## What changed

- **`keys({ storage?, prefix? })`** answers the keys of the area (`StorageAreas.LOCAL` by default), only those that start with `prefix` when it is given. It answers `[]` where the area is missing or throws.
- **`removeWhere({ storage?, prefix })`** removes every key that starts with `prefix` and answers how many it removed.
- **`prefix` is required, and an empty one removes nothing.** A call cannot clear a whole area by leaving the prefix out, and there is still no `clear()`.
- **The session stays out of reach.** `removeWhere` removes each key through `remove`, so a key under `@app/auth/` is never removed and is not counted, even when the prefix reaches it (`@app/`). `keys` does list the session keys, because listing writes nothing.
- **Subscribers hear about it.** Each removed key notifies the subscribers of that key in this tab, as `remove` does. Other tabs hear it through the `storage` event.
- **Nothing throws.** An area that is missing, throws on access, or refuses a removal gives `[]` or a count without that key.

## Who is affected

- **An app that sweeps its own storage keys with raw `localStorage`.** You can call `BrowserStorage.keys` and `removeWhere` instead.
- **All other apps.** No action needed.

See [Browser storage](../references/index#browser-storage).
