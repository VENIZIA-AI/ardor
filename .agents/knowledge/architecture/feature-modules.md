---
type: Concept
title: Feature modules
description: How an application mounts feature packages from features() - bindings, resources, routes, messages - and answers react-admin's canAccess from a permission provider it binds.
resource: packages/admin/src/features/feature.ts
tags: [architecture, features, permissions, i18n, admin, kernel]
---

# Feature modules

A feature package is one value describing an area of an admin: the `@configuration()` classes that
register its services and repositories, the resources and routes it mounts, its messages, and the
permissions it checks. BANA's two shells (web-manager, web-bo) mount the same feature packages; the
mechanism is ARDOR's, the conventions (menu, permission vocabulary, workspace context) are the
application's. Decided by Phat on 2026-10-07; design reviewed by BANA (Inven-1).

## Split by layer

The kernel imports no React and no ra-core, so the type is split. `IFeatureBase` and
`IPermissionProvider` live in `packages/kernel/src/common/types.ts`; `IFeature<TExtension>`,
`defineFeature` and `useFeatures` in admin. `TExtension` is what a shell adds (BANA: menu entries);
ARDOR carries it and never reads it - a generic rather than an untyped `extensions` bag.

## Registration

`AbstractArdorApplication.features()` returns the list; `preConfigure()` calls `registerFeatures()`
after `registerArtifacts()` and before `bindingList()` (`packages/kernel/src/base/applications/abstract.ts`).
It throws on a duplicate `name`, and on a listed configuration class absent from the discovered list:
every ARDOR package is `sideEffects: false`, so a configuration module nothing references by value can
be dropped by the bundler, and its bindings vanish silently. The list is that reference. Then it binds
the list under `CoreBindings.FEATURES` - always, empty included, so readers never check `isBound`.

## Mounting

`ArdorApplication` reads the list (`readFeatures`) and `mountFeatures` puts the application's own
`resources` / `customRoutes` first, then each feature's. A resource name mounted twice throws, naming
both owners: react-admin keeps one and drops the other silently. `readFeatures`, `mountFeatures` and
`FeatureMessages` are internal to admin (imported by path, not exported); the public surface is
`IFeature`, `TFeatureMessages`, `defineFeature`, `useFeatures`, plus the kernel's two types and keys.

## Permissions

`DefaultAuthProvider` injects `CoreBindings.PERMISSION_PROVIDER` with `isOptional: true`. Bound, its
`value()` adds `canAccess`, passing `{ resource, action, record }` and dropping ra-core's `signal`.
Unbound, `canAccess` is absent and ra-core 5.15's `useCanAccess` returns `canAccess: true` without
calling anything (`useCanAccess.js`, `emptyQueryObserverResult`) - no behaviour change for an app that
binds nothing. ra-core caches answers under `['auth', 'canAccess', ...]`; the application invalidates
`['auth']` on a workspace switch. A subclass with its own constructor (BANA's `AuthProvider` in
`kits/admin`, which adds a socket) must inject the provider and pass it to `super` as the fourth
argument. No `useCan` alias: BANA calls `useCanAccess` directly.

## Messages

`DefaultI18nProvider` injects `CoreBindings.FEATURES` (optional) and builds a `FeatureMessages`
(`packages/admin/src/features/messages.ts`): per locale, every feature's bundle merged flat, a key two
features both define throwing with both names. The application's own `i18nSources[locale]` (or
`englishMessages`) is merged over that, so the application may relabel a feature.

ra-i18n-polyglot reads the initial locale synchronously once, while it is built, and throws on a
promise. So the provider answers that first read with what is available now (eager bundles), and
`ArdorApplication` calls `changeLocale(getLocale())` when a feature has a loader for the initial
locale, rendering `suspense` until it settles; a rejection is thrown from render. The design first
said `start()` would preload; the kernel cannot see messages, so the preload moved to the admin
mount point. Each loader runs once per locale.

Pinned by `features.test.ts` (kernel, 6), `feature.test.ts`, `messages.test.ts` and
`components/application.test.tsx` (admin, rendered under `MemoryRouter`; CoreAdmin's own data
router fails in happy-dom with "Should not already be working").
