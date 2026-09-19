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

A hook that takes any input accepts an options object, even for a single value (rule C-02, [Options objects](/conventions/options-objects.md)). `useInjectable` shows the pattern well: it is a discriminated union `TUseInjectableOptions` that requires either `key` or `target` but never both, plus an optional `container` override. Keep option keys readonly-shaped and typed against exported unions rather than raw strings so consumers get autocomplete and type safety.

If the hook exposes an extensible key space (like `TUseInjectableKeys`), declare an empty interface (`IUseInjectableKeysOverrides`) that consumers can augment via [Module augmentation](/architecture/module-augmentation.md), then union it with the default type derived from `CoreBindings`.

## Access ApplicationContext

A hook that needs the DI container accepts an optional `container` in its options object and calls `useInjectableContainer({ container: opts.container })` from `packages/react/src/hooks/use-injectable.ts`, never a fresh container instance. `useInjectableContainer` applies the override pattern - the passed `container`, else `applicationContext.container` - and throws when neither exists. This lets tests and unusual call sites bypass the ambient context while normal application code just relies on the provider set up during [Application lifecycle](/architecture/application-lifecycle.md).

Do not re-derive the container with your own `React.useContext(ApplicationContext)` plus fallback. A hook that checks the container and then resolves through `useInjectable` would otherwise check one container and resolve from another - see the per-stereotype hooks in [react package](/packages/react.md). Take the logger from `useApplicationLogger`, and read `ApplicationContext` directly only for the registry. Read more on the general pattern in [Hooks and context](/architecture/hooks-and-context.md) and [DI in the browser](/architecture/di-in-the-browser.md).

Fail loudly and specifically. `useInjectable` throws via `getError` with a `[useInjectable] ...` prefixed message when it cannot determine a container, or when neither `key` nor `target` is supplied, or when a `target` class cannot be resolved to a binding key. Follow this style: prefix errors with the hook name in brackets, and give the caller an actionable hint (e.g. "Decorate it (@service, @component, ...) or register it on the application before injecting"). See [Error handling](/conventions/error-handling.md).

## Write tests with renderHook

Tests go in `packages/react/src/__tests__/hooks/<hook>.test.ts` (or `packages/admin/src/__tests__/hooks/` for an admin hook), not next to the hook file, and use `renderHook` from `@testing-library/react` under happy-dom, per [Testing conventions](/conventions/testing-conventions.md) and [Testing](/process/testing.md). The standard pattern:

1. Build a real `Container` from `@venizia/ignis-inversion` and bind test values into it with a small helper (`bindConstantValue` in the reference test).
2. Create a `wrapper` component that renders `ApplicationContext.Provider` with `{ container, registry, logger }` as the value.
3. Call `renderHook(() => useYourHook(options), { wrapper })` and assert on `result.current`.

Cover at minimum: the happy path resolving from ApplicationContext, and the override path where an explicit option (e.g. `container`) takes precedence over context even when both are populated differently - this proves the override logic isn't accidentally ignored.

## Export from the barrel

Add the new hook file to `packages/react/src/hooks/index.ts` (or the admin equivalent) with a plain `export * from './use-your-hook'` line, keeping the list alphabetically grouped as it already is. Barrel exports are how the hook becomes part of the package's public surface - see [Public surface](/reference/public-surface.md).

## Docs and surface-gen

If applicable, give the hook its own docs page describing options and gotchas, written per [Docs writing style](/conventions/docs-writing-style.md). The two reference catalogs are generated, never hand-edited:

- Run `make okf-gen` to refresh [Hooks and services](/reference/hooks-and-services.md), which lists every exported hook from source.
- Run `make build-all`, then `make surface-gen`, to refresh [Public surface](/reference/public-surface.md) - it reads the built `.d.ts`, not `src` (see [Build system](/process/build-system.md)).

Skipping them does not hide the hook from consumers - the barrel export already ships it - but it leaves the catalogs stale: a stale hooks catalog fails `make okf-check`, and a stale public surface fails `make surface-check`. Both are steps of the CI workflow, which runs only when started by hand.
