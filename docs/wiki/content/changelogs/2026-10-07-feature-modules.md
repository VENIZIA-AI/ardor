---
title: Feature modules and permissions
description: An application mounts feature packages - resources, routes, bindings, messages - from features(), and answers react-admin's canAccess from its own provider.
---

# Changelog - 2026-10-07

## Feature modules and permissions

<Badge type="tip" text="Feature" />

**In one line.** An application lists the feature packages it mounts in `features()`, and ARDOR binds their configurations, mounts their resources and routes, and merges their messages; react-admin's `canAccess` is answered by an `IPermissionProvider` the application binds. Two shells can mount the same feature packages.

## What changed

- **`IFeatureBase`** (kernel): `name`, `configurations` (the feature's `@configuration()` classes, by value), `permissions` (declared, never enforced). **`IFeature<TExtension>`** (admin) adds `resources`, `routes`, `messages`, and a shell's own fields through `TExtension`. **`defineFeature()`** types one.
- **`features()`** on the application class. `preConfigure()` binds the list under `CoreBindings.FEATURES`, after the stereotypes and before `bindingList()` and `bindContext()`. It throws on two features with one name, and on a listed configuration that was never discovered.
- **`ArdorApplication`** mounts the application's own `resources` and `customRoutes`, then each feature's. `resources` is now optional. A resource name mounted twice throws, naming both owners.
- **`useFeatures()`** returns the mounted features, typed with the extension.
- **Permissions.** `IPermissionProvider` under `CoreBindings.PERMISSION_PROVIDER`: when bound, `DefaultAuthProvider` exposes `canAccess({ resource, action, record })`, so react-admin's `useCanAccess` and `<CanAccess>` work. When not bound, nothing changes: no `canAccess`, everything allowed.
- **Messages.** `DefaultI18nProvider` merges each feature's messages per locale under the application's `i18nSources`. A key two features both define throws. A loader for the initial locale is loaded by `ArdorApplication` before react-admin renders, showing `suspense`; other locales load on `changeLocale()`.

## Who is affected

- **No one, until they opt in.** An application that declares no `features()` and binds no permission provider runs as before.
- **An `AuthProvider` subclass with its own constructor.** To get `canAccess`, inject `CoreBindings.PERMISSION_PROVIDER` (`isOptional: true`) and pass it to `super` as the fourth argument.
- **Code that implements `IArdorApplication` without extending the base class.** Add `features()`.

See [Features and permissions](../references/features).
