---
title: useElementSize no longer throws where there is no ResizeObserver
description: useElementSize stays at 0 by 0 and observes nothing on a host without ResizeObserver, instead of throwing in its effect.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-03

## useElementSize no longer throws where there is no ResizeObserver

<Badge type="info" text="Bug Fix" />

**In one line.** `useElementSize` threw a `ReferenceError` in its effect on a host that has no `ResizeObserver` (an old WebView, some test hosts). It now stays at `{ width: 0, height: 0 }` and observes nothing.

## What changed

- **No `ResizeObserver`, no throw.** The effect checks for it before it observes. The hook returns `0` by `0`, as it does before the first measure.
- **Everything else is the same.** A host that has `ResizeObserver` measures as before.

## Who is affected

- **An app that renders `useElementSize` on a host without `ResizeObserver`.** The render no longer fails. Add a polyfill if you need a real size there.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#useelementsize).
