---
title: useIntersection watches several targets, a scroll container and several thresholds
description: useIntersection takes a list of targets and returns one entry for each, takes a root element, and takes a list of thresholds, so a scroll-spy needs no own observer.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-08

## useIntersection watches several targets, a scroll container and several thresholds

<Badge type="tip" text="New Feature" />

**In one line.** `useIntersection` could watch one element, in the viewport, at one threshold. Now `target` can be a list, `root` names a scroll container, and `threshold` can be a list of numbers.

```tsx
import React from 'react';
import { useIntersection } from '@venizia/ardor';

export function Sections({ ids }: { ids: string[] }) {
  const container = React.useRef<HTMLDivElement>(null);
  const refs = React.useRef<Array<HTMLElement | null>>([]);
  const entries = useIntersection({
    target: refs.current,
    root: container,
    threshold: [0, 0.5, 1],
  });
  const visible = entries.findIndex((entry) => entry?.isIntersecting);

  return (
    <div ref={container} style={{ overflow: 'auto', height: 300 }}>
      <p>Section in view: {ids[visible] ?? 'none'}</p>
      {ids.map((id, index) => (
        <section key={id} ref={(element) => void (refs.current[index] = element)} style={{ height: 400 }}>
          {id}
        </section>
      ))}
    </div>
  );
}
```

## What changed

- **Several targets.** `useIntersection` accepts an array of elements or refs for `target` and returns an array of matching observer entries in the same order, leaving any missing or unready item as `undefined`. Passing a single target continues to return a single entry.
- **A root and a threshold list.** You can pass an element or a ref via the new `root` option to observe scrolling inside a specific container, or omit it (or pass `null`) to use the viewport. A ref whose element is not there yet observes nothing until it is. The `threshold` option also accepts an array of numbers alongside single values.
- **A change starts again.** Changing the targets, root, `rootMargin` or `threshold` resets all tracked entries back to `undefined`. The browser then immediately reports every target again.
- **A list made anew each render is fine.** A list of targets or thresholds with the same values observes nothing again.

## Who is affected

- **An app with a hand-written `IntersectionObserver` for several sections or a scroll container.** You can use `useIntersection` instead.
- **All other apps.** No action needed; a single target returns one entry as before.

See [Hooks](../references/hooks#useintersection).
