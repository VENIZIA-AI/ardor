---
title: useStoredState updaters compose, and the sign-out order is documented
description: setValue(updater) of useStoredState runs against the value at the moment of the call, so two updaters in one tick both apply, and the hooks reference says how to sign out without a flash.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useStoredState updaters compose, and the sign-out order is documented

<Badge type="info" text="Bug Fix" />

**In one line.** `setValue((previous) => ...)` of `useStoredState` ran the updater on the value of the last render, so two updaters in one tick lost the first update. It now runs on the value at the moment you call it, as React's own `setState(updater)` does.

```tsx
import { useStoredState } from '@venizia/ardor';

export function Counter() {
  const { value, setValue } = useStoredState({ key: '@app/store/count', defaultValue: 0 });

  const addTwo = () => {
    setValue((previous: number) => previous + 1);
    setValue((previous: number) => previous + 1);
    // stores value + 2; it stored value + 1 before
  };

  return <button onClick={addTwo}>{value}</button>;
}
```

## What changed

- **An updater sees the current value.** That is the stored value, so it includes a write made a moment ago by another call, another hook on the same key, or code outside React. After a write or a removal that the storage refused, it is the value the hook keeps.
- **`setValue` keeps its identity** when the value changes, because it no longer depends on the last render's value.
- **A plain value is unchanged.** `setValue(10)` stores 10, and an updater called after it builds on 10.
- **Sign out without a flash.** The [`useStoredState` reference](../references/hooks#usestoredstate) now says how to remove session keys at sign-out. `remove()` tells every hook mounted on the key, so remove the keys after the protected tree has unmounted, and gate the effects that write the store on the signed-in state, or a still-mounted effect can write defaults back. There is no `silent` option, because the browser tells other tabs on its own and no option can stop that.

## Who is affected

- **An app that calls `setValue` with an updater more than once in one tick, or on two hooks of one key.** Those updates now all apply. Code that worked around the lost update (a ref holding the latest value, a single combined updater) can stay or be removed.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#usestoredstate).
