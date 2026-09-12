---
type: Convention
title: Testing conventions
description: ARDOR tests run only on bun test, mirror source modules under __tests__, and rely on a happy-dom setup that restores Bun's native networking.
resource: packages/kernel/src/__tests__
tags: [conventions, testing]
---

ARDOR tests run exclusively on the **bun test** runner. No Jest, Vitest, or Mocha, and no config
for another runner. This keeps [build, run, test](/overview/build-run-test.md) uniform across
[kernel](/packages/kernel.md), [react](/packages/react.md), [admin](/packages/admin.md),
[ardor](/packages/ardor.md), and [ui-kit](/packages/ui-kit.md).

## Layout

Tests live under a package's `src/__tests__/`, mirroring the structure of the modules they
exercise. A test for `src/base/applications/abstract.ts` lands under
`src/__tests__/base/applications/`, and so on. This mirroring is what lets an agent find or add a
test for a given source file without guessing - the path under `__tests__` is the same path as
the module, just rooted differently.

## The happy-dom setup restores Bun's networking

ARDOR components render through React, so tests need a DOM. The setup file registers happy-dom's
`GlobalRegistrator` to provide `document`, `window`, and friends. But happy-dom also replaces
Bun's native networking globals - `fetch`, `Request`, `Response`, `Headers`, `FormData`, `Blob`,
`File`, `AbortController`, `URL`, `URLSearchParams` - with its own implementations, and
`Bun.serve` rejects a happy-dom `Response`.

The setup works around this by snapshotting the native versions of those globals **before**
registering happy-dom, then reassigning them back onto `globalThis` immediately after
registration. The result: DOM APIs come from happy-dom, but anything that touches the network -
including code that uses [the data provider pipeline](/architecture/data-provider-pipeline.md) or
stubs a `Bun.serve` instance for a fake backend - still uses Bun's real primitives. Never remove
this restoration step when touching the setup file; deleting it silently reintroduces failures
in any test that stubs a server or issues a real fetch.

## Accessing protected members

Tests reach protected or private members through bracket notation rather than casting them to
`any` or exposing them publicly just for testing:

```typescript
const container = application['container'];
const value = service['resolveInternal']();
```

This keeps the production type surface honest - see
[narrowing authority](/conventions/narrowing-authority.md) - while still letting a test assert on
internal state.

## No `any`, no casts

Test code follows the same typing discipline as production code. No `any`, no `as unknown as X`
escape hatches to force a type through. If a test needs to construct something awkward - like a
`Storage` stub that mirrors real `localStorage` behavior - it does so with a fully typed helper
rather than casting past the type system.

## Positive controls

Every test that guards a piece of logic should have a positive control: run the test against a
deliberately broken (mutated) version of the code and confirm it goes red. A test that never fails
under any mutation isn't actually asserting anything. This applies especially to the DI resolution
paths in [DI in the browser](/architecture/di-in-the-browser.md) and to the
[application lifecycle](/architecture/application-lifecycle.md), where a passing test can hide a
no-op assertion if the mock is too permissive.

## Test names describe behavior

Name tests after the behavior being verified, not after the implementation detail being invoked.
A name like "returns cached value when key exists" tells a future reader what breaks if the test
fails; a name like "calls resolveDriver" does not survive a refactor of that internal method.

## Related

- [Coding style](/conventions/coding-style.md)
- [Gotchas](/conventions/gotchas.md)
- [Build, run, test](/overview/build-run-test.md)
