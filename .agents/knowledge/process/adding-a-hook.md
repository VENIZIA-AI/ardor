---
type: Playbook
title: Adding a hook
description: Step-by-step process for adding a new React hook to ARDOR's react or admin package, wired into ApplicationContext and exported correctly.
resource: packages/react/src/hooks/use-injectable.ts
tags: [process, hooks, react, testing, playbook]
---

Adding a hook to ARDOR follows a fixed shape. Use `useInjectable` in `packages/react/src/hooks/use-injectable.ts` as the reference implementation for structure, options, tests, and exports.

## Decide where it lives

ARDOR has two hook-bearing packages, split by dependency on `ra-core`:

- Hooks that are plain React and have no react-admin dependency go in `packages/react/src/hooks/`.
- Hooks that depend on react-admin primitives (ra-core) go in the admin package instead.

Check what the hook actually touches before picking a home - if it only needs the DI container or plain React state, it belongs in react. See [react package](/packages/react.md) and [admin package](/packages/admin.md).

## Shape the options object

Hooks that take more than a trivial single argument should accept an options object, following [Options objects](/conventions/options-objects.md). `useInjectable` shows the pattern well: it is a discriminated union `TUseInjectableOptions` that requires either `key` or `target` but never both, plus an optional `container` override. Keep option keys readonly-shaped and typed against exported unions rather than raw strings so consumers get autocomplete and type safety.

If the hook exposes an extensible key space (like `TUseInjectableKeys`), declare an empty interface (`IUseInjectableKeysOverrides`) that consumers can augment via [Module augmentation](/architecture/module-augmentation.md), then union it with the default type derived from `CoreBindings`.

## Access ApplicationContext

Any hook that needs the DI container, registry, or logger should pull from `ApplicationContext` via `React.useContext(ApplicationContext)`, not from a fresh container instance. Follow the override pattern: accept an optional `container` in the options object, and fall back to `applicationContext.container` when not provided. This lets tests and unusual call sites bypass the ambient context while normal application code just relies on the provider set up during [Application lifecycle](/architecture/application-lifecycle.md). Read more on the general pattern in [Hooks and context](/architecture/hooks-and-context.md) and [DI in the browser](/architecture/di-in-the-browser.md).

Fail loudly and specifically. `useInjectable` throws via `getError` with a `[useInjectable] ...` prefixed message when it cannot determine a container, or when neither `key` nor `target` is supplied, or when a `target` class cannot be resolved to a binding key. Follow this style: prefix errors with the hook name in brackets, and give the caller an actionable hint (e.g. "Decorate it (@service, @component, ...) or register it on the application before injecting"). See [Error handling](/conventions/error-handling.md).

## Write tests with renderHook

Tests live alongside the hook and use `renderHook` from `@testing-library/react` under happy-dom, per [Testing conventions](/conventions/testing-conventions.md) and [Testing](/process/testing.md). The standard pattern:

1. Build a real `Container` from `@venizia/ignis-inversion` and bind test values into it with a small helper (`bindConstantValue` in the reference test).
2. Create a `wrapper` component that renders `ApplicationContext.Provider` with `{ container, registry, logger }` as the value.
3. Call `renderHook(() => useYourHook(options), { wrapper })` and assert on `result.current`.

Cover at minimum: the happy path resolving from ApplicationContext, and the override path where an explicit option (e.g. `container`) takes precedence over context even when both are populated differently - this proves the override logic isn't accidentally ignored.

## Export from the barrel

Add the new hook file to `packages/react/src/hooks/index.ts` (or the admin equivalent) with a plain `export * from './use-your-hook'` line, keeping the list alphabetically grouped as it already is. Barrel exports are how the hook becomes part of the package's public surface - see [Public surface](/reference/public-surface.md).

## Docs and surface-gen

Every exported hook needs an entry in [Hooks and services](/reference/hooks-and-services.md) reference and, if applicable, its own docs page describing options and gotchas, written per [Docs writing style](/conventions/docs-writing-style.md). After exporting, run the surface-gen step (see [Build system](/process/build-system.md)) so generated public-surface artifacts pick up the new export - forgetting this step is a common gotcha (see [Gotchas](/conventions/gotchas.md)) that leaves a hook implemented but effectively invisible to consumers and to the docs pipeline.
