---
title: Typed browser storage and useElementSize
description: BrowserStorage reads and writes localStorage and sessionStorage without throwing, useStoredState keeps a value in step across hooks and tabs, and useElementSize measures a ref.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-03

## Typed browser storage and useElementSize

<Badge type="tip" text="New Feature" />

**In one line.** `BrowserStorage` is a typed, never-throwing store over `localStorage` and `sessionStorage`, `useStoredState` is the React hook on top of it, and `useElementSize` measures an element you hold a ref to.

```tsx
import React from 'react';
import { useElementSize, useStoredState } from '@venizia/ardor';

export function Panel() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { width } = useElementSize({ ref });
  const { value: theme, setValue } = useStoredState({ key: '@app/store/theme', defaultValue: 'light' });

  return (
    <div ref={ref}>
      <button onClick={() => setValue(theme === 'light' ? 'dark' : 'light')}>{theme}</button>
      <span>{width}px</span>
    </div>
  );
}
```

## What changed

- **`BrowserStorage`** (`@venizia/ardor-kernel`). `get`, `set`, `remove` and `subscribe`, with an optional `storage` (`StorageAreas.LOCAL` or `SESSION`) and an optional `codec` (JSON by default). A missing area, a blocked accessor, a quota error or text the codec cannot read gives the fallback or `false`, never an exception. Nothing touches `window` at import.
- **`useStoredState({ key, defaultValue, storage?, codec? })`** (`@venizia/ardor-react`). Returns `{ value, setValue, remove }`. Hooks on the same key, code that writes through `BrowserStorage`, and other tabs (the `storage` event) keep it in step.
- **`useElementSize({ ref, box? })`** (`@venizia/ardor-react`). Returns `{ width, height }` of the content box (default) or the border box, with one state update per animation frame. `useSizer` is unchanged.
- **Keys.** Keys are used as given. Name yours `@app/store/<name>`; `LocalStorageKeys.PREFIX_STORE` is `@app/store/`. `BrowserStorage.set` and `remove` refuse a key under `@app/auth/`, the session, and answer `false`.
- **`Ardor` namespace.** `Ardor.useStoredState` and `Ardor.useElementSize` join it, so it holds 25 hooks, and `ardor codemod namespace --hooks` knows both.
- **New exports.** `BrowserStorage`, `StorageAreas`, `TStorageArea`, `IStorageCodec`, `useStoredState`, `useElementSize` and their option and return types.

## Who is affected

- **An app that wrote its own storage helper or its own `ResizeObserver` hook.** You can switch to these. Nothing is removed.
- **All other apps.** No action needed.

See [Browser storage](../references/#browser-storage) and [Hooks](../references/hooks#usestoredstate).
