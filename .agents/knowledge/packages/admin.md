---
type: Package
title: admin
description: The react-admin adapter package that confines all ra-core usage behind ARDOR's providers, hooks and BaseCrudService.
resource: packages/admin/src/index.ts
tags: [package, admin, react-admin, ra-core, i18n, data-provider]
---

`@venizia/ardor-admin` is the react-admin adapter of ARDOR. It is the single place in the framework that touches `ra-core` - every hook, provider and component that wraps react-admin lives here, and nowhere else in the codebase imports `ra-core` directly. This confinement matters: if react-admin's API shifts, or a team ever wants to swap the admin layer, the blast radius is this one package. Consumers normally never install it directly - they pull in [`@venizia/ardor`](/packages/ardor.md), which re-exports it alongside [kernel](/packages/kernel.md) and [react](/packages/react.md).

## What it exports

The package barrel (`src/index.ts`) re-exports four areas: `common`, `components`, `hooks`, `providers`, `services`.

Providers (`src/providers/index.ts`):
- `DefaultRestDataProvider` and `CountRestDataProvider` - implementations of react-admin's data provider contract, translated into ARDOR's REST/filter vocabulary. React-admin's pagination, sort and filter parameters are mapped onto the `{ where, order, limit, skip, fields, include }` shape used by `@venizia/ignis-filter`. This is the concrete edge of the [data provider pipeline](/architecture/data-provider-pipeline.md).
- `DefaultAuthProvider` - the react-admin auth provider, feeding into [auth recovery](/architecture/auth-recovery.md) and respecting [no-auth paths](/architecture/no-auth-paths.md).
- `DefaultI18nProvider`, plus bundled `englishMessages` and `vietnameseMessages` - the concrete i18n provider for react-admin, part of the framework's [i18n](/architecture/i18n.md) story.

Hooks (`src/hooks/index.ts`):
- `useTranslate` - a typed wrapper over react-admin's translate hook.
- `useNotifyError` - surfaces failures through react-admin's notification system, tying into [error flow](/architecture/error-flow.md).
- `useRefreshToken` - drives token refresh as part of [auth recovery](/architecture/auth-recovery.md).
- `useRequestHeaderLocale` - reads locale for outgoing request headers, connecting to the [header protocol](/architecture/header-protocol.md).

Also exported: `BaseCrudService`, a base class for building CRUD services on top of the data providers, and `ArdorApplication` - the `CoreAdmin` root component that react-admin apps mount, wired from the [DI container](/architecture/di-in-the-browser.md) as part of the [application lifecycle](/architecture/application-lifecycle.md).

Types worth knowing: `IDataProvider`, `IAuthProvider`, `II18nProviderOptions`, `IApplication`, `TUseTranslateKeys`.

## The augmentation it owns

`IUseTranslateKeysOverrides` is declared in this package specifically so that applications can extend the set of translation keys `useTranslate` knows about, following the framework's general [module augmentation](/architecture/module-augmentation.md) pattern used across [hooks and context](/architecture/hooks-and-context.md). An application augments it like this:

```typescript
declare module '@venizia/ardor-admin' {
  interface IUseTranslateKeysOverrides extends Record<TFullPaths<typeof messages>, unknown> {}
}
```

This gives `useTranslate` compile-time awareness of an application's own message catalogue, without the admin package needing to know about application-specific keys up front.

## Why ra-core is confined here

ARDOR's [design decisions](/overview/design-decisions.md) treat react-admin as an implementation detail of the admin layer, not a framework-wide dependency. [`@venizia/ardor-kernel`](/packages/kernel.md) and [`@venizia/ardor-react`](/packages/react.md) know nothing about `ra-core` - they define the DI container, application lifecycle and generic React bindings. Only this package speaks react-admin's provider interfaces and hook shapes. That separation keeps the kernel and react layers reusable even if the admin UI technology changes, and it means anyone debugging a react-admin-specific quirk knows exactly which package to look in.
