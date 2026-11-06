---
title: useElementSize follows any element, rounds and says when it measured, and FakeResizeObserver tests it
description: useElementSize returns a callback ref when you pass none, takes round, returns measured, and @venizia/ardor/testing has FakeResizeObserver for hosts whose ResizeObserver does nothing.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-03

## useElementSize follows any element, rounds and says when it measured, and FakeResizeObserver tests it

<Badge type="tip" text="New Feature" />

**In one line.** `useElementSize()` with no `ref` returns a `ref` to give to the element, so it follows an element that mounts later or is replaced. It takes `round`, it returns `measured`, and `FakeResizeObserver` in `@venizia/ardor/testing` lets a test deliver a size.

```tsx
import { useElementSize } from '@venizia/ardor';

export function Panel({ open }: { open: boolean }) {
  const { ref, width, measured } = useElementSize({ round: true });

  return open ? <div ref={ref}>{measured ? `${width}px` : '...'}</div> : null;
}
```

## What changed

- **A callback `ref`.** Leave out the `ref` option and the hook returns `ref`. Its identity never changes. When the element mounts later, is replaced or is removed, the hook observes the new one and starts again from `0` by `0`. A `ref` object still works as before.
- **`round`.** `round: true` rounds width and height to whole pixels, so a size that moves by a fraction does not render again. The default is `false`.
- **`measured`.** It is `false` until the first size is read, and also on a host with no `ResizeObserver`. An element measured at `0` by `0` has `measured: true`, so you can tell it from one not read yet.
- **`FakeResizeObserver`.** `FakeResizeObserver.install()` puts a fake on `globalThis.ResizeObserver` and returns a function that puts the previous one back. `FakeResizeObserver.flush({ element, width, height })` delivers a size to every observer of that element. happy-dom's own `observe()` does nothing, so before this a test could not give the hook a size.

## Who is affected

- **An app that compares the whole return of `useElementSize` with `toEqual({ width, height })`.** The return now has `measured`. Read `width` and `height`, or add `measured` to the expectation.
- **All other apps.** No action needed. The new options and the new field are additive.

See [Hooks](../references/hooks#useelementsize) and [Fake the browser APIs](../references/testing#fake-the-browser-apis-your-code-reads).
