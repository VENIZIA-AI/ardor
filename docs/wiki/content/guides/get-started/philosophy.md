---
title: Philosophy
description: Why ARDOR exists, what it deliberately does not do, why it is four packages, and whether it is for you.
---

# Philosophy

ARDOR is the frontend application framework of the VENIZIA family. It is the frontend sibling of IGNIS and a consumer of it. This page explains the reasoning behind the design so the rest of the guide reads as a set of consequences, not a set of rules.

## Prerequisites

None - this page is about the shape of the framework, not about running it. See the [quickstart](./quickstart) for that.

## Quick Reference

The framework is four packages plus a design system. Each has one role.

| Package | Role | Depends on React | Depends on react-admin |
|---|---|---|---|
| `@venizia/ardor-kernel` | Isomorphic core: application base, service and CRUD bases, request and auth constants, binding keys, logger, network fetchers (axios and fetch), socket client, utilities | No | No |
| `@venizia/ardor-react` | React bindings: the application context, `useInjectable`, typed Redux hook factories, the UI hooks | Yes | No |
| `@venizia/ardor-admin` | react-admin adapter: REST data provider, auth provider, i18n provider, the `ArdorApplication` root component, `useTranslate`, English and Vietnamese messages | Yes | Yes |
| `@venizia/ardor` | Umbrella entry point that re-exports the three packages above, so an application needs one dependency | Via re-export | Via re-export |
| `@venizia/ardor-ui-kit` | Design system: Tailwind + Radix components and design tokens, generated from Figma | Yes | No |

## Why ARDOR exists

react-admin already gives two things an admin app needs: a data contract (`getList`, `getOne`, `create`, and the rest) and a UI runtime that drives that contract. IGNIS already gives a third thing: an inversion-of-control container, published as `@venizia/ignis-inversion`, and a query vocabulary, published as `@venizia/ignis-filter`.

ARDOR wires those together. An ARDOR application is an IoC container. You bind providers and services by key inside `bindContext()`, start the application, and the React tree resolves what it needs through hooks.

The reason for that wiring is scale with a team, not scale of traffic. Three things become possible:

- **Services by key.** An API service is a class, bound once, resolved anywhere in the tree with `useInjectable`. A second developer does not need to know where it was constructed.
- **Providers as bindings.** The data provider, auth provider and i18n provider are bindings under `CoreBindings` keys. Swapping one is a change to `bindContext()`, not a search across the component tree.
- **One place to configure auth.** The REST data provider options hold the API URL, the paths that are reached before a token exists (`noAuthPaths`, or a `noAuthPathRegex`), and the refresh path used for auth recovery. Nothing else in the app needs to repeat that.

The whole idea fits in a few lines:

```tsx no-check
// In the application class - declare what is bound.
bindContext() {
  this.bind({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS }).toValue({
    url: import.meta.env.VITE_API_URL,
    noAuthPaths: ['/auth/login'],
    authRecovery: { refreshTokenPath: '/auth/refresh' },
  });
  this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER }).toProvider(DefaultRestDataProvider);
  this.service(ProductApi);
  ...
}

// Anywhere in the tree - resolve by key.
const productApi = useInjectable<ProductApi>({ key: 'services.ProductApi' });
```

## What ARDOR deliberately does not do

The boundaries matter as much as the features.

- **No UI components in the core.** `kernel`, `react` and `admin` ship no visual components. Buttons, dialogs, accordions and the design tokens live in `@venizia/ardor-ui-kit`, which is a separate package with a separate dependency (Tailwind + Radix). You can use the framework without the kit, or the kit without the framework.
- **No second query language.** The data layer speaks the query vocabulary of `@venizia/ignis-filter`. ARDOR does not invent its own filter, sort or pagination syntax, and it does not translate between two of them. If the backend is IGNIS, the vocabulary is already shared.
- **No react-admin in `kernel` or `react`.** `@venizia/ardor-kernel` has no React and no react-admin. `@venizia/ardor-react` has React but no `ra-core`. Only `@venizia/ardor-admin` imports react-admin. That is the same guarantee `ignis-kernel` carries on the backend side: the lowest layers stay pure so they can be reused, tested and reasoned about without the runtime on top.

## Why four packages

The split follows the dependency graph, not the feature list.

- **`kernel` is isomorphic.** It runs in the browser and in Node. Network fetchers exist for both axios and `fetch`. Service bases, request constants and binding keys do not need a DOM. Keeping them React-free means they can be used in scripts, in tests and on a server.
- **`react` has no `ra-core`.** The application context, `useInjectable` and the UI hooks (`useDebounce`, `useAutosave`, `useConfirm`, `useSizer`, and others) are useful in any React app that owns an ARDOR container. They should not drag react-admin along.
- **`admin` is the adapter.** This is where react-admin's contract meets the container: `DefaultRestDataProvider`, `DefaultAuthProvider`, `DefaultI18nProvider`, the `ArdorApplication` root component and `useTranslate`. Everything react-admin-specific stays here.
- **`ardor` is the umbrella.** One `import ... from '@venizia/ardor'` for an application that wants all three. The umbrella re-exports; it adds nothing of its own.

Two practical consequences follow. First, the build order is the dependency order, and a package type-checks against the `dist` of its dependency, never its `src` - so a change to the kernel is invisible to `admin` until the kernel is rebuilt. Second, module augmentation targets the package that declares the interface: `IUseInjectableKeysOverrides` is declared in `@venizia/ardor-react`, `IUseTranslateKeysOverrides` in `@venizia/ardor-admin`. Augment those, not the umbrella. See [module augmentation](../../best-practices/module-augmentation).

## ARDOR compared with plain react-admin

Plain react-admin is a good fit for many apps. ARDOR changes the parts that get in the way once several people own the same admin.

| Concern | Plain react-admin | ARDOR |
|---|---|---|
| Structure | You assemble providers and pass them as props to the root component | You declare bindings in an application class; `ArdorApplication` receives the started container |
| Dependency injection | None built in; you thread objects through props or your own context | IoC container from `@venizia/ignis-inversion`; services and providers are bound by key and resolved with `useInjectable` |
| Data layer | You write or pick a data provider and its query encoding | `DefaultRestDataProvider` bound under `CoreBindings.DEFAULT_REST_DATA_PROVIDER`, speaking the `@venizia/ignis-filter` vocabulary |
| Auth recovery | You implement token refresh in your own auth provider or HTTP client | Configured once in the REST data provider options: `noAuthPaths` / `noAuthPathRegex` for pre-token paths and `authRecovery.refreshTokenPath` for refresh |
| Typing of keys | Translation and lookup keys are plain strings | `useInjectable` and `useTranslate` keys are typed through `IUseInjectableKeysOverrides` and `IUseTranslateKeysOverrides`, which you augment with your own keys |

## Is ARDOR for you

**Yes, if:**

- You are building a react-admin app that must scale with a team - more screens, more services, more people who need to find where something is bound.
- Your backend already runs on IGNIS. The filter vocabulary and the container conventions are shared, so the two halves fit without an adapter you write yourself.
- You are on `@minimaltech/ra-core-infra`. ARDOR is that package, split and rebranded; the move is a codemod plus four symbol renames. See [migrating from ra-core-infra](../migration/from-ra-core-infra).

**No, if:**

- You are building a marketing site. There is no data contract to wire and no container to fill.
- You are building a three-screen internal tool. Plain react-admin with one data provider object is less to learn and less to maintain.

## Honest about being 0.x

ARDOR is early. The code has export and member parity with the legacy package, and the build and lint are green. The parts around the code are still being built: the test suite, the changelog convention, the public-surface snapshot, CI gates and runnable examples are planned against the IGNIS standard but not all in place yet. Expect breaking changes between minor versions until 1.0, and read the migration notes before upgrading.

## Common pitfalls

- **Forgetting `reflect-metadata`.** It must be imported once, before the application class is defined. Without it the container cannot read the decorator metadata it relies on.
- **Expecting UI components from `@venizia/ardor`.** The umbrella re-exports `kernel`, `react` and `admin` only. Components come from `@venizia/ardor-ui-kit`.
- **Augmenting the umbrella instead of the declaring package.** `declare module '@venizia/ardor'` does not extend `IUseInjectableKeysOverrides`. Augment `@venizia/ardor-react` and `@venizia/ardor-admin`.
- **Rebuilding one package and testing another.** `admin` compiles against the kernel's `dist`. After a kernel change, rebuild the kernel (or `make build`) before expecting `admin` to see it.
- **Listing too few `noAuthPaths`.** Any path not listed and not matched by `noAuthPathRegex` is sent with an Authorization header and fails without one. Login and register paths belong in the list.

## Related

- [Quickstart](./quickstart) - bind, start, render.
- [Application](../../references/application) - the application base classes and lifecycle.
- [Binding keys](../../references/binding-keys) - every `CoreBindings` key.
- [Data provider](../../references/data-provider) - `DefaultRestDataProvider` and its options.
- [Auth provider](../../references/auth-provider) - `DefaultAuthProvider` and auth recovery.
- [i18n](../../references/i18n) - `DefaultI18nProvider`, `useTranslate`, message bundles.
- [Hooks](../../references/hooks) - `useInjectable` and the UI hooks.
- [Network](../../references/network) - fetchers and request constants.
- [Types](../../references/types) - the shared type helpers.
- [Module augmentation](../../best-practices/module-augmentation) - typing your own keys.
- [Migrating from ra-core-infra](../migration/from-ra-core-infra) - the codemod and the four renames.
