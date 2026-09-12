---
type: Concept
title: What is ARDOR
description: ARDOR is a frontend application framework that wires react-admin's data contract onto an IGNIS-style IoC container.
resource: packages/ardor/src/index.ts
tags: [ardor, overview, positioning, ignis, react-admin]
---

ARDOR is the frontend sibling of IGNIS, the VENIZIA backend framework. It is a frontend application framework, not a backend one: it has no controllers, repositories, datasources, Hono routes or Drizzle schemas. What it does is combine two things that already exist and wire them together for team-scale admin apps.

The first ingredient is react-admin's data contract: `getList`, `getOne`, `create`, and the rest of the CRUD vocabulary, plus the UI runtime that drives it. The second ingredient is IGNIS's inversion-of-control container, published as `@venizia/ignis-inversion`, and its query vocabulary, published as `@venizia/ignis-filter`. An ARDOR application is itself an IoC container: providers and services are bound by key inside `bindContext()`, the application is started, and the React tree resolves whatever it needs through hooks like `useInjectable`. See [Application lifecycle](/architecture/application-lifecycle.md) and [DI in the browser](/architecture/di-in-the-browser.md) for the mechanics.

## What it gives

- Services bound once by key, resolved anywhere in the tree, so a second developer does not need to know where something was constructed.
- Providers (data, auth, i18n) as bindings under `CoreBindings` keys, so swapping one is a change to `bindContext()` rather than a hunt through components.
- One place to configure auth: the REST data provider options hold the API URL, the paths reachable before a token exists (`noAuthPaths` / `noAuthPathRegex`), and the refresh path used for auth recovery. See [Auth recovery](/architecture/auth-recovery.md) and [No-auth paths](/architecture/no-auth-paths.md).
- A shared query vocabulary with the backend when the backend is IGNIS, via the [data provider pipeline](/architecture/data-provider-pipeline.md).

## What it is not

ARDOR ships no UI components in its core layers - buttons, dialogs and design tokens live only in the separate `@venizia/ardor-ui-kit` package. It does not invent a second query language: filtering, sorting and pagination speak the `@venizia/ignis-filter` vocabulary rather than an ARDOR-specific syntax. And it keeps react-admin out of the lower layers entirely - only one of the four packages touches it.

## The four packages

- [`@venizia/ardor-kernel`](/packages/kernel.md) - isomorphic core: application base, service and CRUD bases, request and auth constants, binding keys, logger, network fetchers, socket client. No React, no react-admin.
- [`@venizia/ardor-react`](/packages/react.md) - React bindings: the application context, `useInjectable`, typed Redux hook factories, and UI hooks such as `useDebounce`, `useAutosave`, `useConfirm`, `useSizer`. No react-admin.
- [`@venizia/ardor-admin`](/packages/admin.md) - the react-admin adapter: `DefaultRestDataProvider`, `DefaultAuthProvider`, `DefaultI18nProvider`, the `ArdorApplication` root component, `useTranslate`, and the English/Vietnamese message bundles. This is the only package that imports react-admin.
- [`@venizia/ardor`](/packages/ardor.md) - the umbrella entry point. It re-exports kernel, react and admin so an application needs one dependency, and adds nothing of its own. UI components are not part of this re-export; they come separately from [`@venizia/ardor-ui-kit`](/packages/ui-kit.md).

The split follows the dependency graph: the build order is the dependency order, and each package type-checks against the `dist` of its dependency, never its `src`. A kernel change is invisible to `admin` until the kernel is rebuilt - see [Build, run, test](/overview/build-run-test.md).

## Relation to IGNIS and to ra-core-infra

ARDOR consumes IGNIS's inversion-of-control primitives and filter vocabulary rather than reimplementing them, mirroring the layering discipline IGNIS itself follows on the backend: the lowest layers stay free of the heavier runtime so they can be reused and tested in isolation.

ARDOR is also the successor to `@minimaltech/ra-core-infra`, which is now frozen. ARDOR is that package split into the four packages above and rebranded; migrating is a codemod plus four symbol renames, not a redesign.

For the reasoning behind these boundaries see [Design decisions](/overview/design-decisions.md); for getting a workspace running see [Onboarding](/overview/onboarding.md) and [Monorepo layout](/overview/monorepo-layout.md).
