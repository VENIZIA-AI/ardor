---
title: useStoredState writeDelayMs writes the storage once after a burst of changes
description: useStoredState writeDelayMs updates the UI at once and writes localStorage once after the delay, for a value that changes many times a second.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useStoredState writeDelayMs writes the storage once after a burst of changes

<Badge type="tip" text="New Feature" />

**In one line.** `useStoredState({ key, defaultValue, writeDelayMs })` changes `value` at once and writes the storage once, `writeDelayMs` milliseconds after the last `setValue`. The default is `0`: write at once, as before.

```tsx
import { useStoredState } from '@venizia/ardor';

export function SidebarWidth() {
  const { value, setValue } = useStoredState({
    key: '@app/store/sidebar-width',
    defaultValue: 240,
    writeDelayMs: 200,
  });

  return <input type="range" min={160} max={480} value={value} onChange={(event) => setValue(event.target.valueAsNumber)} />;
}
```

## What changed

- **One write for a burst.** Each `setValue` restarts the delay. Updaters keep working: they build on the pending value, so chained updaters inside the delay lose nothing.
- **The last writer wins.** `remove()` cancels the pending write. So does a change of the storage from outside: a write through `BrowserStorage`, or a `storage` event from another tab. The hook's own write is not such a change.
- **Nothing is lost on unmount.** An unmount, or a new `key` or `storage`, writes the pending value at once, to the key it was set for. A write the storage refuses is kept in the hook, as before.
- **No `pagehide` handler.** A tab closed inside the delay loses the last value, so keep the delay short.

## Who is affected

- **An app that debounces `setValue` by hand to spare the storage.** You can pass `writeDelayMs` instead: the hand-written debounce also delays the UI, this one does not.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#usestoredstate).
