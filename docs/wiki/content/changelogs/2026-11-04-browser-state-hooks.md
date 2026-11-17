---
title: useMediaQuery, useDocumentVisibility and useOnlineStatus read browser state
description: Three SSR-safe hooks over useSyncExternalStore for a media query, tab visibility and online status, with no hand-written subscribe.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useMediaQuery, useDocumentVisibility and useOnlineStatus read browser state

<Badge type="tip" text="New Feature" />

**In one line.** Three hooks read a piece of browser state and re-render when it changes: `useMediaQuery({ query })`, `useDocumentVisibility()` and `useOnlineStatus()`. Each is a `useSyncExternalStore` over one event, so a read and a change cannot tear, and a server render gets a fixed value without touching `window`, `document` or `navigator`.

```tsx
import { useDocumentVisibility, useMediaQuery, useOnlineStatus } from '@venizia/ardor';

export function StatusBar() {
  const isWide = useMediaQuery({ query: '(min-width: 768px)' });
  const visibility = useDocumentVisibility();
  const isOnline = useOnlineStatus();

  return (
    <p>
      {isWide ? 'Wide' : 'Narrow'} - {visibility} - {isOnline ? 'online' : 'offline'}
    </p>
  );
}
```

## What changed

- **`useMediaQuery({ query })`** answers whether the query matches now and after each change. A new `query` is read at once, and the old one is no longer listened to.
- **`useDocumentVisibility()`** answers `'visible'` or `'hidden'`, the value of `document.visibilityState`, kept by the `visibilitychange` event.
- **`useOnlineStatus()`** answers `navigator.onLine`, kept by the `online` and `offline` events. It says whether the browser has a network connection, not whether your server answers.
- **Server render.** The values are `false`, `'visible'` and `true`, and the browser is not read. There is no `defaultValue` option; read the hook after mount for another first value.
- **In `Ardor`.** The three join the namespace, so it holds 30 hooks, and `ardor codemod namespace --hooks` knows them.

## Who is affected

- **An app that hand-writes `matchMedia`, `visibilitychange` or `online`/`offline` listeners in a component.** You can use the hooks and delete the subscribe and cleanup code.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#usemediaquery).
