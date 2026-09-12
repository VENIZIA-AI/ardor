---
type: Package
title: ardor
description: The umbrella package that re-exports ardor-kernel, ardor-react and ardor-admin behind a single import.
resource: packages/ardor/src/index.ts
tags: [package, ardor, umbrella, exports]
---

# ardor

`@venizia/ardor` is the umbrella package. It has almost no code of its own - it is three re-export statements:

```ts
export * from '@venizia/ardor-kernel';
export * from '@venizia/ardor-react';
export * from '@venizia/ardor-admin';
```

Everything an application needs - the container and binding primitives from [kernel](/packages/kernel.md), the typed hooks from [react](/packages/react.md), and the react-admin wiring from [admin](/packages/admin.md) - is reachable through one import: `import { ... } from '@venizia/ardor'`. This is the entry point most applications should use. A consumer that only needs one layer can install that sub-package directly instead of pulling in the whole stack.

## Install

```bash
bun add @venizia/ardor @venizia/ignis-inversion @venizia/ignis-filter reflect-metadata
```

IGNIS is the backend framework in the VENIZIA family; ARDOR is its frontend sibling and a consumer of it. Inversion of control comes from `@venizia/ignis-inversion`, and the data layer speaks the query vocabulary of `@venizia/ignis-filter`. `reflect-metadata` is required for decorator metadata used by the container - see [DI in the browser](/architecture/di-in-the-browser.md).

## Why an app augments the sub-packages, not the umbrella

Two of the typed hooks - `useInjectable` from ardor-react and `useTranslate` from ardor-admin - accept a union of string-literal keys built from an empty override interface plus a default set (see [Module augmentation](/architecture/module-augmentation.md)). TypeScript merges interface declarations by module identity: `IUseInjectableKeysOverrides` is declared inside `@venizia/ardor-react`, and `IUseTranslateKeysOverrides` is declared inside `@venizia/ardor-admin`. The umbrella package only re-exports these interfaces - it does not declare them.

Because of that, a `declare module '@venizia/ardor'` augmentation creates a brand new, unrelated interface inside the umbrella module. It never merges with the original declaration, so the typed key unions never pick up your keys and the augmentation silently does nothing.

The rule that falls out of this: always target the package that declares the interface, even though the rest of the application code imports everything from `@venizia/ardor`. Augment `@venizia/ardor-react` for injectable keys and `@venizia/ardor-admin` for translation keys. The import path used at runtime and the module path used for augmentation are two different things, and only the second one has to match the declaring package.

## What this means day to day

- Regular application code (bindings, components, hooks) can and should import from `@venizia/ardor` - that is the whole point of the umbrella.
- Type augmentation files (usually a single `augmentations.d.ts` or similar) must target the specific sub-package, not the umbrella, or the augmentation is a no-op.
- Because the umbrella is just re-exports, there is no umbrella-specific behavior, binding, or lifecycle to document beyond what is covered in [kernel](/packages/kernel.md), [react](/packages/react.md), and [admin](/packages/admin.md) - see [Application lifecycle](/architecture/application-lifecycle.md) for how those three layers cooperate at runtime.
- ARDOR (this whole family of packages, umbrella included) was previously shipped as `@minimaltech/ra-core-infra`; the split and rebrand did not change this re-export-only structure of the umbrella.

For where `packages/ardor` sits relative to `kernel`, `react`, `admin` and `ui-kit` in the repo tree, see [Monorepo layout](/overview/monorepo-layout.md). For build and test commands that apply across all packages including this one, see [Build, run, test](/overview/build-run-test.md).
