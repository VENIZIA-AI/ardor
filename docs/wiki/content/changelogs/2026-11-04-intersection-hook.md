---
title: useIntersection tells whether an element is in view
description: useIntersection returns the latest IntersectionObserverEntry of an element, so lazy content or a load-more sentinel needs no own observer.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useIntersection tells whether an element is in view

<Badge type="tip" text="New Feature" />

**In one line.** `useIntersection({ target, rootMargin?, threshold? })` returns the latest `IntersectionObserverEntry` of the target, or `undefined` before the first one and where there is no `IntersectionObserver`. Read `entry?.isIntersecting` for the boolean. Give it a list of targets and it returns one entry per target, in the same order.

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
- **The target is an element, a ref or `null`.** It is read after every render, as for `useResizeEffect`, so an element held in state or mounted later is followed.
- **Several targets.** `useIntersection` accepts an array of elements or refs for `target` and returns an array of matching observer entries in the same order, leaving any missing or unready item as `undefined`. Passing a single target continues to return a single entry.
- **A root and a threshold list.** You can pass an element or a ref via the `root` option to observe scrolling inside a specific container, or omit it (or pass `null`) to use the viewport. A ref whose element is not there yet observes nothing until it is. The `threshold` option also accepts an array of numbers alongside single values.
- **A change starts again.** Changing the targets, root, `rootMargin` or `threshold` resets all tracked entries back to `undefined`. The browser then immediately reports every target again.
- **Also in `Ardor`.** `Ardor.useIntersection` joins the namespace, and `ardor codemod namespace --hooks` knows it.
- **A new type.** `IUseIntersectionOptions` is the options object, and `TElementTarget` is the type of a target, shared with `useResizeEffect` (it was `TResizeTarget`, unreleased).

## Who is affected

- **An app that keeps a hand-written `IntersectionObserver` to see whether an element is in view.** You can use `useIntersection` instead and remove the observe, disconnect and server-render guard.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#useintersection).
