---
title: ARDOR Replaces @minimaltech/ra-core-infra
description: The frontend framework splits into four ARDOR packages behind an umbrella import, with four symbol renames and updated dependency requirements.
---

# Changelog - 2026-09-11

## ARDOR Replaces @minimaltech/ra-core-infra

<Badge type="tip" text="New Feature" /> <Badge type="warning" text="Breaking Change" />

**In one line.** `@minimaltech/ra-core-infra` became four ARDOR packages behind a single `@venizia/ardor` umbrella import.

## What changed

- **Package architecture split.** The codebase is partitioned along dependency seams into `@venizia/ardor-kernel` (isomorphic core), `@venizia/ardor-react` (React context and hooks), and `@venizia/ardor-admin` (react-admin adapter), all re-exported by `@venizia/ardor`.
- **Four symbol renames.** `AbstractRaApplication`, `BaseRaApplication`, `CoreRaApplication`, and `ICoreRaApplication` were renamed to match the ARDOR naming convention.
- **DIContainer dropped.** `DIContainer` has been removed in favor of the inversion `Container` provided via IGNIS.
- **Module augmentation targets moved.** Interface augmentations must now target the declaring package (`@venizia/ardor-react` or `@venizia/ardor-admin`) instead of the umbrella import.
- **IGNIS dependency bumped.** ARDOR requires `@venizia/ignis-inversion` version `>=0.2.0-7` to support metadata-based target resolution.
- **Vietnamese message bundle updated.** `vietnameseMessages` now includes `ra.validation.unique` required by `ra-core` 5.15.3.
- **Logger toggle fix.** `Logger.toggleDebug({ state: false })` now explicitly disables debug logging instead of toggling the state.

## Who is affected

- **All consumers of `@minimaltech/ra-core-infra`.** Action required: run the migration codemod and update the dependency to `@venizia/ardor`. See `../guides/migration/from-ra-core-infra`.

## Breaking changes

> [!WARNING]
> All consumers importing from `@minimaltech/ra-core-infra` must update their package dependencies, symbol names, and TypeScript module augmentations.

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

## Details

- `@minimaltech/ra-core-infra` is permanently frozen at `0.0.3-18`; all future development and fixes live in the ARDOR packages.
- A codemod script is provided to automate import rewrites, symbol renames, module augmentation updates, and `package.json` updates.

| Package | Role |
|---------|------|
| `@venizia/ardor-kernel` | Isomorphic core: application base, service and CRUD bases, logger, network fetchers, socket client |
| `@venizia/ardor-react` | Application context, inversion hooks, typed Redux hook factories, UI hooks |
| `@venizia/ardor-admin` | react-admin adapter: REST data provider, auth provider, i18n provider, `ArdorApplication` root |
| `@venizia/ardor` | Umbrella package re-exporting kernel, react, and admin packages |
