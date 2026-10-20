---
title: Augment @venizia/ardor, not the declaring packages
description: A declare module block on @venizia/ardor merges into IUseInjectableKeysOverrides and IUseTranslateKeysOverrides. The docs said it did not; a block on @venizia/ardor-react or @venizia/ardor-admin fails under a non-hoisting linker.
packages: []
---

# Changelog - 2026-10-19

## Augment @venizia/ardor, not the declaring packages

<Badge type="info" text="Bug Fix" />

**In one line.** The docs told an application to augment `@venizia/ardor-react` and `@venizia/ardor-admin` and said an umbrella block never merges; it is the other way round (issue #98).

```ts no-check
// ... one block on the umbrella declares both kinds of key.
declare module '@venizia/ardor' {
  interface IUseInjectableKeysOverrides {
    'services.PricingService': true;
  }

  interface IUseTranslateKeysOverrides {
    'app.title': true;
  }
}
```

## What changed

- **The claim was wrong.** `@venizia/ardor` re-exports the two interfaces with `export *`, and TypeScript follows that chain to the declaring package, so an umbrella block merges and undeclared keys are still rejected. Measured on a registry-only app (`@venizia/ardor@0.1.4-5`, TypeScript 6) with both of Bun's linkers.
- **The old advice failed under a non-hoisting linker.** An application depends on `@venizia/ardor` alone. With Bun's `isolated` linker (or pnpm) `@venizia/ardor-react` and `@venizia/ardor-admin` are not resolvable from it, so `declare module '@venizia/ardor-react'` fails with TS2664 and the keys are missing. A hoisting linker hides it.
- **The docs, the examples and the check.** The module augmentation guide, the migration guide, the references, the quickstart and the knowledge concepts say this; both examples augment the umbrella; `examples/5-mins-qs/src/augmentation.check.ts` fails the example's typecheck when the claim stops holding.
- **No code change.** ARDOR's packages are unchanged.

## Who is affected

- **An application with `declare module '@venizia/ardor-react'` or `'@venizia/ardor-admin'`** that does not list that package in its own `package.json`, on a non-hoisting linker. Retarget the block to `@venizia/ardor`. Elsewhere the old block still works.
- **An application that augments `@venizia/ardor` already.** Nothing to do; it was correct.
