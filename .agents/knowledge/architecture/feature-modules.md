---
type: Concept
title: Feature modules
description: How an application mounts feature packages from features() - bindings, resources, routes, messages - and answers react-admin's canAccess from a permission provider it binds.
resource: packages/admin/src/features/feature.ts
tags: [architecture, features, permissions, i18n, admin, kernel]
---

# Feature modules

<!-- okf:generated:contents start -->
**Contents**

- [Split by layer](#split-by-layer)
- [Registration](#registration)
- [Mounting](#mounting)
- [Menu](#menu)
- [Permissions](#permissions)
- [Messages](#messages)
<!-- okf:generated:contents end -->

A feature package is one value describing an area of an admin: the `@configuration()` classes that
register its services and repositories, the resources and routes it mounts, its messages, and the
permissions it checks. Two shells of one project can mount the same feature packages; the
mechanism is ARDOR's, the conventions (menu, permission vocabulary, workspace context) are the
application's. Decided by Phat on 2026-10-07; design reviewed by a project that uses Venizia.

## Split by layer

The kernel imports no React and no ra-core, so the type is split. `IFeatureBase` and
`IPermissionProvider` (and `IRolePermissionProviderOptions`, for the opt-in `RolePermissionProvider`) live in `packages/kernel/src/common/types.ts`; `TFeature<TExtension>`,
`Features.define`, `IMenuEntry`, `useFeatures` and `useMenuEntries` in admin. `TExtension` is what a shell
adds on top (such as the industries a feature serves); ARDOR carries it and never reads it - a generic
rather than an untyped `extensions` bag. It must not redeclare an ARDOR field: `menu` was a shell
extension before 0.4.8 and is now `TFeature.menu`, so an extension typed `menu` differently no longer
compiles.

## Registration

`AbstractArdorApplication.features()` returns the list; `preConfigure()` calls `registerFeatures()`
after `registerArtifacts()` and before `bindingList()` (`packages/kernel/src/base/applications/abstract.ts`).
It throws on a duplicate `name`, and on a listed configuration class, or a class in the feature's
`artifacts` (`IArtifactIndex`, the shape of the application's `artifacts()`), absent from the discovered list:
every ARDOR package is `sideEffects: false`, so a configuration module nothing references by value can
be dropped by the bundler, and its bindings vanish silently. The list is that reference. Then it binds
the list under `CoreBindings.FEATURES` - always, empty included, so readers never check `isBound`.

## Mounting

`ArdorApplication` reads the list (`Features.read({ container })`) and `Features.mount({ features,
resources, routes })` puts the application's own `resources` / `routes` first, then each feature's.
`IApplication.routes` carries the same name as `TFeature.routes`. A resource name mounted twice throws,
naming both owners: react-admin keeps one and drops the other silently. A route path mounted twice, or
equal to `/<resource name>` (the leading slash is ignored), throws the same way; a route with neither
`id` nor `path` throws, since `id ?? path` is its React key. Only `FeatureMessages` is
internal to admin (imported by path, not exported); the public surface is `TFeature`,
`TFeatureMessages`, `TArdorRoute`, `IRouteAccess`, the `Features` class (`define`, `read`, `mount`),
`useFeatures`, plus the kernel's two types and keys.

A route entry is `RouteProps` plus three optional toggles (`TArdorRoute`): `access: { resource, action }`,
`auth: { use: boolean }` and `layout: { use: false }`. react-admin runs neither `checkAuth` nor
`canAccess` on a custom route, so a route without `access` or `auth: { use: true }` is open to anyone who
types its path (`requireAuth` of `CoreAdmin` still applies). `renderRoute` in `application.tsx` wraps a
route with `access` in ra-core's `Authenticated` and `CanAccess`, and one with `auth: { use: true }` in
`Authenticated` only: `element`, else `Component`, else the router's default `Outlet`, is the page.
`access` with `auth: { use: false }` is a contradiction `Features.mount` refuses. A denied user gets
`CanAccess`'s default, an empty page; with no bound permission provider `canAccess` is absent and only
sign-in is required. Routes with `layout: { use: false }` go in a second `<CustomRoutes noLayout>`
(rendered only when one exists): ra-core's `CoreAdminRoutes` renders those before any auth check, so it
is the only way to a public page under `requireAuth`; a route inside the layout waits for `checkAuth`
whatever its `auth` says.

## Menu

`TFeature.menu` is `Array<IMenuEntry>`, `{ label, to, access?, icon? }`: `label` a translation key, `icon` a
name the shell maps (ARDOR renders no menu). `useMenuEntries()` (`hooks/use-menu-entries.ts`) flattens the
entries of the mounted features (through `useFeatures`), in feature order, tagged with `feature`. Entries
with `access` are checked with one `useQueries` call, one query per distinct `{ resource, action }`, under
ra-core's own key `['auth', 'canAccess', { action, resource }]` (the hash `useCanAccess` gives a check with
no record), so the cache clear on a user switch and `useRefreshToken`'s invalidation cover them. Pending or
failed checks hide the entry (no flash of a link the user may not open); with no `canAccess` on the auth
provider, or no auth provider, every entry is listed.

## Permissions

`IFeatureBase.permissions` is descriptive metadata for a role editor: it enforces nothing. Enforcement is
`access` on routes and on menu entries.


`DefaultAuthProvider` injects `CoreBindings.PERMISSION_PROVIDER` with `isOptional: true`. Bound, its
`value()` adds `canAccess`, passing `{ resource, action, record }` and dropping ra-core's `signal`.
Unbound, `canAccess` is absent and ra-core 5.15's `useCanAccess` returns `canAccess: true` without
calling anything (`useCanAccess.js`, `emptyQueryObserverResult`) - no behaviour change for an app that
binds nothing. ra-core caches answers under `['auth', 'canAccess', ...]`; the application invalidates
`['auth']` on a workspace switch. `value(container)` takes the provider passed to the constructor, else reads
`PERMISSION_PROVIDER` from the container (optional), so a subclass with its own constructor that
passes three arguments to `super` (every `AuthProvider` of a project that uses Venizia; one of them adds a socket at index 3)
still gets `canAccess`. A provider passed to `super` wins over the bound one. No `useCan` alias: an application calls `useCanAccess` directly.

## Messages

`DefaultI18nProvider` injects `CoreBindings.FEATURES` (optional) and builds a `FeatureMessages`
(`packages/admin/src/features/messages.ts`): per locale, every feature's bundle merged flat, a key two
features both define throwing with both names. The application's own `i18nSources[locale]` (an object, or a lazy loader once it delivered; `englishMessages` when
there is none or a loader failed) is merged over that, so the application may relabel a feature.

ra-i18n-polyglot reads the initial locale synchronously once, while it is built, and throws on a
promise. So the provider answers that first read with what is available now (eager bundles), and
`ArdorApplication` calls `changeLocale(getLocale())` when a feature has a loader for the initial
locale, rendering `suspense` until it settles; a rejection is thrown from render. The design first
said `start()` would preload; the kernel cannot see messages, so the preload moved to the admin
mount point. Each loader runs once per locale.

Pinned by `features.test.ts` (kernel, 8), `use-menu-entries.test.tsx` (admin), `feature.test.ts`, `messages.test.ts` and
`components/application.test.tsx` (admin, rendered under `MemoryRouter`; CoreAdmin's own data
router fails in happy-dom with "Should not already be working").
