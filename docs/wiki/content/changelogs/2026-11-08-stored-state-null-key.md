---
title: useStoredState can turn its storage off with a null key
description: A null key makes useStoredState keep its value in memory, like useState, so a component can store state only when a user id or a flag is known.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-08

## useStoredState can turn its storage off with a null key

<Badge type="tip" text="New Feature" />

**In one line.** A hook call cannot be conditional, so `useStoredState` now takes `key: string | null`. With `null` it stores nothing and keeps its value in memory, like `useState`.

```tsx
import { useStoredState } from '@venizia/ardor';

export function Sidebar({ userId }: { userId: string | undefined }) {
  // Nothing is stored until the user is known.
  const { value, setValue } = useStoredState({
    key: userId ? `@app/prefs/${userId}/sidebar` : null,
    defaultValue: 'open',
  });

  return <button onClick={() => setValue(value === 'open' ? 'closed' : 'open')}>{value}</button>;
}
```

## What changed

- **Allow `key` to be `null` to disable storage.** When `null`, the hook acts like standard React `useState` by keeping state in memory, setting the initial value to `defaultValue`, and skipping all storage reads, writes and listeners. `remove()` puts the value back to `defaultValue` and touches no storage.
- **Moving from `null` to a storage key.** Switching `key` to a string starts reading that key and discards any temporary value held in memory.
- **Moving from a storage key to `null`.** Switching `key` to `null` resets the value to `defaultValue` and leaves the stored value untouched. A delayed write (`writeDelayMs`) that is still pending is written to the previous key.

## Who is affected

- **A component that stores state only when something is known** (a user id, a feature flag). Pass `null` as the key until it is.
- **All other apps.** No action needed; a string key works as before.

See [Hooks](../references/hooks#usestoredstate).
