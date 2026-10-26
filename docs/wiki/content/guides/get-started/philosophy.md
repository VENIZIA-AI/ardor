---
title: Philosophy
description: Why ARDOR exists next to react-admin, how it connects to IGNIS, and the five architectural decisions it makes for your application.
---

# Philosophy

ARDOR exists to assemble `ra-core` applications inside an IGNIS inversion-of-control container (`@venizia/ignis-inversion`). While `ra-core` provides the CRUD data contract and UI runtime, ARDOR manages dependency injection, provider wiring, and service lifetimes across your application. It decides five core architectural concerns for you: the application is the container, configuration is a class of `@provide` methods, providers are resolved by key, classes are found by the build not listed by hand, and the same IGNIS packages run on browser and server.

<<< @/../../../examples/5-mins-qs/src/application.ts{ts}

## The application is the container

The application class inherits directly from the IGNIS `Container` rather than wrapping one. In `packages/kernel/src/base/applications/abstract.ts`, `AbstractArdorApplication` extends `Container` to manage the lifecycle and resolution of every service. During `start()`, `preConfigure()` binds `APPLICATION_INSTANCE` and `APPLICATION_INFO`, registers discovered stereotypes, binds `FEATURES`, binds `bindingList()`, and finally calls `bindContext()`. The root component in `packages/admin/src/components/application.tsx` places this container into React context so hooks can resolve dependencies anywhere in the tree. See [Application](../core-concepts/application) and [Dependency injection](../core-concepts/dependency-injection).

## Configuration is a class of `@provide` methods

Instead of passing static configuration dictionaries to initialization functions, ARDOR defines application configuration as a class decorated with `@configuration()`. Each provider or set of options is declared on a method decorated with `@provide({ key })`. When the application boots, `packages/kernel/src/base/applications/abstract.ts` iterates over the discovered provide metadata and registers each method as a lazy singleton provider. Options and services are therefore instantiated on demand and shared across components. See [Configuration](../core-concepts/configuration).

## Providers are resolved by key

`ra-core` providers are resolved by key from the container rather than passed as direct component props. The eleven standard framework keys are declared under `CoreBindings` in `packages/kernel/src/common/keys.ts`. In `packages/admin/src/components/application.tsx`, `ArdorApplication` retrieves the data provider and optional authentication provider using these keys, running without an authentication provider if `DEFAULT_AUTH_PROVIDER` is left unbound. You swap an implementation across the whole application simply by binding a different provider to its key in your configuration class. See [Providers](../core-concepts/providers) and [Binding keys](../../references/binding-keys).

## Classes are found by the build, not listed by hand

Applications avoid manual registration lists and centralized barrels for decorated classes. The build system scans `src/` at compile time and emits `AutoArtifacts`, which lists decorated configurations, data sources, components, repositories, and services. In `packages/kernel/src/base/applications/abstract.ts`, `artifacts()` returns this index, and `preConfigure()` checks that every class the index lists was discovered, throwing an error that names the class when one was not. See [Quickstart](./5-minute-quickstart).

## Same IGNIS packages on browser and server

ARDOR shares foundational IGNIS packages across the browser and the server: inversion, filter, kernel, and connectors. The dependency injection container (`@venizia/ignis-inversion`), metadata stereotypes in `packages/kernel/src/base/metadata/index.ts`, and filter vocabulary (`@venizia/ignis-filter`) run in both environments. The repository is IGNIS's own: `packages/kernel/src/base/repositories/index.ts` re-exports `@venizia/ignis-connectors/http` (the HTTP repository) and `HttpExtraRequest` from IGNIS. ARDOR re-exports IGNIS's HTTP repository on `@venizia/ardor/repository` so a browser repository reads the server's list route with the same filter. Because both sides share the filter vocabulary, the browser describes a list query in the filter IGNIS already reads. `ListFilterBuilder` in `@venizia/ardor-admin` turns react-admin's list parameters into that filter; a repository then sends it to the server's list route.

## What ARDOR does not do

- **It is not a UI kit.** ARDOR ships no visual components, buttons, form controls, or CSS themes. Visual presentation belongs to your chosen component library.
- **It does not replace ra-core.** ARDOR relies on `ra-core` for CRUD operations, controller hooks, and page lifecycles. Only `packages/admin/src` connects to `ra-core`, acting as an adapter between the container and `ra-core`.
- **It does not write your REST API.** ARDOR provides the browser-side HTTP transport (`DefaultNetworkRequestService` in `packages/kernel/src/base/services/network-request.ts` using the browser `fetch` API), but it does not generate backend endpoints, database schemas, or server routes.

## Is ARDOR for you?

**Yes**, if you build an admin console on ra-core that must grow with a team: many resources, real sign-in, services shared across screens. It fits best when your API already runs on IGNIS, because the data provider speaks the IGNIS filter language.

**Probably not** for a marketing site, a three-screen tool, or a UI that is not an admin.

What ARDOR adds to ra-core:

| Concern | In ARDOR |
| :--- | :--- |
| Services | An IGNIS container: `bindingList()`, `@inject`, `useInjectable` by key or by class |
| Data layer | A REST data provider that sends the IGNIS filter language (`where`, `order`, `limit`, `skip`) and reads totals from `Content-Range` |
| Sign-in | A 401 triggers one token refresh for a burst of requests, then retries them; no-auth paths are explicit |
| Keys | `useInjectable` and `useTranslate` keys typed through module augmentation |

## Packages

| Package | Contents |
|---|---|
| `@venizia/ardor` | Umbrella: re-exports kernel, react, and admin from one import, plus the `@venizia/ardor/repository` sub-path and the VULCAN preset (`dist/presets`). |
| `@venizia/ardor-kernel` | Container and service foundation, with no UI: application base classes, decorators and metadata, `CoreBindings`, the network request service, `getRuntimeConfig`, and the `/repository` sub-path (IGNIS's HTTP repository). |
| `@venizia/ardor-react` | React bindings: application context, `useInjectable`, the artifact hooks (`useService`, `useProvider`, `useComponent`, `useConfiguration`, `useRepository`), UI helper hooks, and the Redux hook factories `createAppDispatch` and `createAppSelectors`. |
| `@venizia/ardor-admin` | ra-core adapter: `ArdorApplication`, `DefaultRestDataProvider`, the auth and i18n providers, the permission provider, features, and the hooks that use them (`useTranslate`, `useFeatures`, `useRefreshToken`). |

The three layers use no Node builtins, so they run in the browser. Take `@venizia/ardor` unless you want only one layer.

## Where ARDOR is today

ARDOR is at 0.4.3, before 1.0. A minor release in the 0.x line can break: 0.4.1 carried breaking changes, and every one is listed in the [changelogs](../../changelogs/) with who is affected and what to do. The packages declare IGNIS peers at `^0.4.1`. `@venizia/ignis-connectors` is an optional peer, needed only for `@venizia/ardor/repository`.
