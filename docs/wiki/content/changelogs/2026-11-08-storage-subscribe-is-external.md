---
title: BrowserStorage.subscribe tells a change of this tab from one of another tab
description: The listener of BrowserStorage.subscribe gets { isExternal }, false after a write through BrowserStorage in this tab and true when another tab changed the key.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-11-08

## BrowserStorage.subscribe tells a change of this tab from one of another tab

<Badge type="tip" text="New Feature" />

**In one line.** The listener of `BrowserStorage.subscribe` used to be called with nothing, so it could not tell its own write from a change in another tab. It now gets `{ isExternal }`.

```ts
import { BrowserStorage } from '@venizia/ardor';

const stop = BrowserStorage.subscribe({
  key: '@app/prefs/draft',
  listener: ({ isExternal }) => {
    if (isExternal) {
      console.log('The draft changed in another tab.');
    }
  },
});

stop();
```

## What changed

- **Listener receives change origin.** `BrowserStorage.subscribe` now passes an `{ isExternal }` object to the listener callback, where `isExternal` is `false` for changes made within the current tab (`set`, `remove`, `removeWhere`) and `true` for updates or clears triggered by another tab.
- **Distinguish local and remote updates.** This lets a listener avoid a write-back loop and respond only to actions that come from other tabs, such as showing a banner when data changes elsewhere.
- **Nothing breaks.** A listener that takes no argument keeps working as it did. `IStorageChange` is the new exported type of the argument.

## Who is affected

- **Code that writes from a `BrowserStorage.subscribe` listener, or shows "changed in another tab".** Read `isExternal` to tell the two cases apart.
- **All other apps.** No action needed.

See [Browser storage](../references/index#browser-storage).
