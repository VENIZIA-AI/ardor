---
title: useResizeEffect runs one callback when any of several elements resizes
description: useResizeEffect observes several elements, and with children their direct children, and calls onResize at most once per animation frame, so a check that runs on resize needs no hand-written ResizeObserver.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useResizeEffect runs one callback when any of several elements resizes

<Badge type="tip" text="New Feature" />

**In one line.** `useResizeEffect({ refs, onResize, box?, children? })` calls `onResize(entries)` when any element of `refs` resizes, with `children: true` also when a direct child of one does. Use it for a check that keeps no size in state, such as an overflow test, the edges of a scroll area or a canvas fit; `useElementSize` stays for the size itself.

```tsx
import React from 'react';
import { useResizeEffect } from '@venizia/ardor';

export function Toolbar() {
  const ref = React.useRef<HTMLDivElement>(null);
  const refs = React.useMemo(() => [ref], []);
  const [isOverflowing, setOverflowing] = React.useState(false);

  useResizeEffect({
    refs,
    onResize: () => {
      const element = ref.current;
      setOverflowing(element !== null && element.scrollWidth > element.clientWidth);
    },
  });

  return <div ref={ref}>{isOverflowing ? 'More...' : 'All'}</div>;
}
```

## What changed

- **One observer, one call per frame.** All the elements share one `ResizeObserver`. `onResize` runs at most once per animation frame, with the latest entry of each element that resized since the last call. The hook keeps the latest `onResize`, so a new function in each render does not observe again.
- **Children on request.** With `children: true` each ref's direct children are observed too, and again when a child is added or removed. The `MutationObserver` that does this exists only with `children`.
- **The first entries are delivered.** `onResize` runs once when observing starts, as the browser delivers the first entries. A child added later delivers its first entry too.
- **`useElementSize` shares the code.** Both hooks observe through one internal, so the observer set-up, the frame coalescing and the clean-up are the same. `useElementSize` keeps its behavior.
- **Also in `Ardor`.** `Ardor.useResizeEffect` joins the namespace, so it holds 27 hooks, and `ardor codemod namespace --hooks` knows it.
- **A new type.** `IUseResizeEffectOptions` is the options object.

## Who is affected

- **An app that keeps a hand-written `ResizeObserver` for a check on resize.** You can use `useResizeEffect` instead and remove the observe, disconnect and "latest callback" code.
- **All other apps.** No action needed.

Pass a stable `refs` array, as `React.useMemo` gives: an array made anew in every render observes again in every render. See [Hooks](../references/hooks#useresizeeffect).
