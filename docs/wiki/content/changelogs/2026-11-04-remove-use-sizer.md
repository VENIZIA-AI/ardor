---
title: useSizer is removed, use useElementSize
description: useSizer measured the element with a given id; useElementSize measures an element or a ref with more options, so useSizer is removed with no alias.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useSizer is removed, use useElementSize

<Badge type="warning" text="Breaking Change" />

**In one line.** `useSizer({ containerId })` is removed from `@venizia/ardor-react`, `@venizia/ardor` and the `Ardor` namespace. `useElementSize` does the same job for a ref, with a `box`, `round` and a `measured` flag, so ARDOR keeps one hook for one concept. There is no alias.

```tsx
import React from 'react';
import { useElementSize } from '@venizia/ardor';

export function ChartContainer() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize({ ref, box: 'border-box', round: true });

  return (
    <div ref={ref}>
      <span>
        Width: {width}, Height: {height}
      </span>
    </div>
  );
}
```

## What changed

- **`useSizer` is gone,** with its `IUseSizerOptions` and `IUseSizerReturn` types, its entry in `Ardor` (which now holds 30 hooks) and its entry in the codemod's hook table.
- **The replacement** is `useElementSize({ ref, box: 'border-box', round: true })`. `useSizer` read `offsetWidth` and `offsetHeight`, which are the border box size rounded to whole pixels, and that is what `box: 'border-box'` with `round: true` gives. It takes a `ref` object instead of an element id.
- **A difference to know.** `useSizer` gave `0` by `0` until the element existed; `useElementSize` gives `0` by `0` with `measured` `false` until the first size is read, so you can tell an unmeasured element from an empty one.

## Who is affected

- **An app that calls `useSizer`.** Move it to `useElementSize` as above: give the element a `ref` and pass it, in place of the `id`.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#useelementsize).
