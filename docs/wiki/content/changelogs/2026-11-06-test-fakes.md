---
title: Test fakes for the browser APIs the hooks use
description: FakeIntersectionObserver, FakeMatchMedia, FakeStorage and FakeClipboard join FakeResizeObserver, which now shows its observers; all in @venizia/ardor/testing.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-11-06

## Test fakes for the browser APIs the hooks use

<Badge type="tip" text="New Feature" />

**In one line.** `@venizia/ardor/testing` now holds a fake of `IntersectionObserver`, of `matchMedia`, of `Storage` and of `navigator.clipboard`, next to `FakeResizeObserver`, so a test does not copy ARDOR's own stubs.

```ts
import { FakeIntersectionObserver, FakeStorage } from '@venizia/ardor/testing';

declare const element: Element; // the element the component under test observes

const restoreObserver = FakeIntersectionObserver.install();
const storage = new FakeStorage();
const restoreStorage = storage.install();
// render the component, then:
FakeIntersectionObserver.flush({ element, isIntersecting: true });
storage.failWrites = true; // the next write throws QuotaExceededError
restoreStorage();
restoreObserver();
```

## What changed

- **Four new fakes.** `FakeIntersectionObserver` (`install`, `flush`, `settle` for the first report, `live`, `created`), `FakeMatchMedia` (`install`, `set`, `queries`, `listenerCount`), `FakeStorage` (`install`, `failReads`, `failListing`, `failWrites`, `writes`) and `FakeClipboard` (`install`, `written`, `text`, `isDenied`). See [Testing](../references/testing).
- **`FakeResizeObserver` shows what it holds.** `FakeResizeObserver.all` lists the observers a test created; each has `callback`, `targets`, `options`, `unobserved` and `isDisconnected`. It was private before.
- **They reach `window` too.** `install` also puts the fake on `window` where that is another object than the global, as in happy-dom, so `useMediaQuery` and code that reads `window.localStorage` meet it.
- **A second import path.** The fakes live in `@venizia/ardor-kernel/testing`, which `@venizia/ardor/testing` re-exports. A project that uses only the kernel imports them from there. The kernel's main entry does not include them.

## Who is affected

- **An app with its own stubs of these APIs.** You can replace them with the fakes; nothing forces you to.
- **All other apps.** No action needed.
