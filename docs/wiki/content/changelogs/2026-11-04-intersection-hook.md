---
title: useIntersection tells whether an element is in view
description: useIntersection returns the latest IntersectionObserverEntry of an element, so lazy content, a load-more sentinel or a sticky header needs no hand-written IntersectionObserver.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useIntersection tells whether an element is in view

<Badge type="tip" text="New Feature" />

**In one line.** `useIntersection({ target, rootMargin?, threshold? })` returns the latest `IntersectionObserverEntry` of the target, or `undefined` before the first one and where there is no `IntersectionObserver`. Read `entry?.isIntersecting` for the boolean.

```tsx
import React from 'react';
import { useIntersection } from '@venizia/ardor';

export function LoadMore({ onLoad }: { onLoad: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const entry = useIntersection({ target: ref, rootMargin: '200px' });
  const latest = React.useRef(onLoad);

  React.useEffect(() => {
    latest.current = onLoad;
  });

  React.useEffect(() => {
    if (entry?.isIntersecting) {
      latest.current();
    }
  }, [entry?.isIntersecting]);

  return <div ref={ref} />;
}
```

## What changed

- **The entry, not a boolean.** It carries the ratio and the rectangles when you need them. The state changes only when `isIntersecting` or the ratio changed, so an unchanged entry does not render.
- **The target is an element, a ref or `null`.** It is read after every render, as for `useResizeEffect`, so an element held in state or mounted later is followed. A new element, `rootMargin` or `threshold` observes again from `undefined`.
- **One `threshold`, no `root`.** `threshold` is a single number; the viewport is the root, and `rootMargin` covers a scrolling root.
- **Also in `Ardor`.** `Ardor.useIntersection` joins the namespace, and `ardor codemod namespace --hooks` knows it.
- **A new type.** `IUseIntersectionOptions` is the options object, and `TElementTarget` is the type of a target, shared with `useResizeEffect` (it was `TResizeTarget`, unreleased).

## Who is affected

- **An app that keeps a hand-written `IntersectionObserver` to see whether an element is in view.** You can use `useIntersection` instead and remove the observe, disconnect and server-render guard.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#useintersection).
