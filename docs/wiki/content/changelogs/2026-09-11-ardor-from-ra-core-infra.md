---
title: ARDOR Replaces @minimaltech/ra-core-infra
description: The frontend framework splits into four ARDOR packages behind an umbrella import, with four symbol renames and updated dependency requirements.
packages: ['@venizia/ardor-admin', '@venizia/ardor', '@venizia/ardor-kernel', '@venizia/ardor-react']
---

# Changelog - 2026-09-11

## ARDOR Replaces @minimaltech/ra-core-infra

<Badge type="tip" text="New Feature" /> <Badge type="warning" text="Breaking Change" />

**In one line.** `@minimaltech/ra-core-infra` became four ARDOR packages behind a single `@venizia/ardor` umbrella import.

## What changed

- **Four packages.** `@venizia/ardor-kernel` (isomorphic core), `@venizia/ardor-react` (React context and hooks) and `@venizia/ardor-admin` (react-admin adapter), all re-exported by `@venizia/ardor`.
- **Four symbol renames.** `AbstractRaApplication`, `BaseRaApplication`, `CoreRaApplication` and `ICoreRaApplication` follow the ARDOR naming convention.
- **`DIContainer` dropped.** Use the inversion `Container` provided via IGNIS.
- **Module augmentation targets moved.** Augment the declaring package (`@venizia/ardor-react` or `@venizia/ardor-admin`), not the umbrella import.
- **IGNIS dependency.** ARDOR requires `@venizia/ignis-inversion` `>=0.2.0-7`.
- **Vietnamese messages.** `vietnameseMessages` now includes `ra.validation.unique`, required by `ra-core` 5.15.3.
- **Logger toggle fix.** `Logger.toggleDebug({ state: false })` now disables debug logging instead of toggling it.

## Who is affected

- **All consumers of `@minimaltech/ra-core-infra`.** Migrate by hand following the guide and change the dependency to `@venizia/ardor`. See `../guides/migrations/from-ra-core-infra`. The old package is permanently frozen at `0.0.3-18`; fixes land only in the ARDOR packages.

## Breaking changes

> [!WARNING]
> Update your package dependency, the symbol names and your TypeScript module augmentations.

**Before:**

```ts no-check
// ... the old package, no longer installable
import {
  AbstractRaApplication,
  BaseRaApplication,
  CoreRaApplication,
  ICoreRaApplication,
  useInjectable,
  useTranslate,
} from '@minimaltech/ra-core-infra';

declare module '@minimaltech/ra-core-infra' {
  interface IUseInjectableKeysOverrides extends Record<keyof ReturnType<Application['bindingList']>, unknown> {}
  interface IUseTranslateKeysOverrides extends ITranslateKeys {}
}
```

**After:**

```ts
import {
  AbstractArdorApplication,
  BaseArdorApplication,
  ArdorApplication,
  type IArdorApplication,
  useInjectable,
  useTranslate,
} from '@venizia/ardor';

// The keys an application binds; `ITranslateKeys` is the app's own message-key type.
type TApplicationKeys = 'services.ProductApi' | 'services.OrderApi';
interface ITranslateKeys extends Record<'resources.product.name', unknown> {}

declare module '@venizia/ardor-react' {
  interface IUseInjectableKeysOverrides extends Record<TApplicationKeys, unknown> {}
}

declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides extends ITranslateKeys {}
}
```
