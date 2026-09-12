---
type: Package
title: react
description: The react-agnostic-to-react-admin bridge package providing the application context, injection hooks, and UI hooks that make up ARDOR's React layer.
resource: packages/react/src/index.ts
tags: [react, hooks, context, package, injection, module-augmentation]
---

`@venizia/ardor-react` is the React binding layer of ARDOR. It exposes the `ApplicationContext`, the hooks that resolve values out of it, and a set of generic UI hooks. It has nothing to do with `ra-core`: react-admin lives one layer up, in [admin](/packages/admin.md). This package's job is purely to connect [kernel](/packages/kernel.md) and IGNIS's DI container to React's component tree.

## Role

Applications rarely install this package directly - most install [ardor](/packages/ardor.md), which re-exports it. But `react` is where the actual context and hooks are implemented. It sits between the kernel (which defines binding keys, `Logger`, and core types) and any UI package built on top, including [ui-kit](/packages/ui-kit.md) and admin.

## Exports

The package barrel (`src/index.ts`) re-exports three groups:

- **common** - shared types such as `SyncFC` and `TUseInjectableKeys`.
- **contexts** - `ApplicationContext`, plus `useApplicationContext` and `useApplicationLogger` built on top of it.
- **hooks** - `useInjectable` for DI resolution, and a family of UI hooks: `useDebounce`, `useAutosave`, `useConfirm`, `useBeforeUnload`, `useCopyToClipboard`, `useSizer`, `useWindowDimensions`. There are also Redux factory helpers, `createAppDispatch` and `createAppSelectors`, for binding a typed `RootState`/`AppDispatch` pair.

## ApplicationContext

Defined in `src/contexts/application.ts`, this is a plain `React.createContext` holding `{ container, registry, logger }`, all nullable by default. It is the single source of truth that hooks read from - there is no other way for a hook to reach the IGNIS container from inside a component tree. See [Hooks and context](/architecture/hooks-and-context.md) for how this fits into the broader dependency flow, and [DI in the browser](/architecture/di-in-the-browser.md) for how the container itself gets built and put into this context during [application lifecycle](/architecture/application-lifecycle.md).

## useInjectable

`useInjectable` (`src/hooks/use-injectable.ts`) is the resolution hook. It accepts an options object of one of two shapes, matching [options-objects](/conventions/options-objects.md) conventions:

- `{ container?, key }` - resolve by binding key.
- `{ container?, target }` - resolve by class, using the container's metadata registry to look up the binding key registered via decorators like `@service` or `@component`.

If no `container` override is passed, it falls back to `applicationContext.container` read via `React.useContext`. If neither is available it throws. If a `target` is given but no binding key can be resolved for it, it throws with a message telling the caller to decorate the class or register it explicitly - this mirrors the narrowing/registration rules described in [narrowing authority](/conventions/narrowing-authority.md) and [binding key namespaces](/conventions/binding-key-namespaces.md).

## IUseInjectableKeysOverrides

This package owns the augmentation point for typed injection keys. `TUseInjectableKeys` is defined as `TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides`, where the default comes from kernel's `CoreBindings`. Downstream packages or applications that want `useInjectable({ key: ... })` to autocomplete and typecheck their own binding keys must augment `IUseInjectableKeysOverrides` by declaring `module '@venizia/ardor-react'` directly - not through `@venizia/ardor` or any other re-exporting package, because TypeScript's declaration merging only applies to the module that actually declares the interface. This is the canonical example referenced in [module augmentation](/architecture/module-augmentation.md).

## Test environment

Tests in this package run under `happy-dom` rather than a full browser or `jsdom`, since the hooks and context here need a DOM-like environment (for things like `useBeforeUnload` and `useWindowDimensions`) without the overhead of a real browser. This is consistent with the broader [testing conventions](/conventions/testing-conventions.md) and the setup described in [build, run, test](/overview/build-run-test.md).
