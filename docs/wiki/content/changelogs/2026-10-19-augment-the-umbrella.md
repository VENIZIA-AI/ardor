---
title: Augment @venizia/ardor, not the declaring packages
description: Augment IUseInjectableKeysOverrides and IUseTranslateKeysOverrides on @venizia/ardor; a block on -react or -admin fails under a non-hoisting linker.
packages: ['@venizia/ardor']
---

# Changelog - 2026-10-19

## Augment @venizia/ardor, not the declaring packages

<Badge type="info" text="Bug Fix" />

**In one line.** The docs told an application to augment `@venizia/ardor-react` and `@venizia/ardor-admin` and said an umbrella block never merges. It is the other way round: augment `@venizia/ardor`.

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

- **The old claim was wrong.** `@venizia/ardor` re-exports the two interfaces with `export *`, and TypeScript follows that chain to the declaring package, so an umbrella block merges and undeclared keys are still rejected.
- **The old advice failed under a non-hoisting linker.** An application depends on `@venizia/ardor` alone. With Bun's `isolated` linker (or pnpm) `@venizia/ardor-react` and `@venizia/ardor-admin` are not resolvable from it, so `declare module '@venizia/ardor-react'` fails with TS2664 and the keys are missing. A hoisting linker hides it.
- **No code change.** ARDOR's packages are unchanged. The guides now say this.

## Who is affected

- **An application with `declare module '@venizia/ardor-react'` or `'@venizia/ardor-admin'`** that does not list that package in its own `package.json`, on a non-hoisting linker. Retarget the block to `@venizia/ardor`. Elsewhere the old block still works.
- **An application that augments `@venizia/ardor` already.** Nothing to do.
