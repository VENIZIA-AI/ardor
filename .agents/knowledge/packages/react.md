---
type: Package
title: react
description: The React bindings for ARDOR - ApplicationContext, useInjectable and the per-stereotype hooks, typed Redux factories and UI hooks, with no react-admin dependency.
resource: packages/react/src/index.ts
tags: [react, hooks, context, package, injection, module-augmentation]
---

`@venizia/ardor-react` is the React binding layer of ARDOR. It exposes the `ApplicationContext`, the hooks that resolve values out of it, and a set of generic UI hooks. It has nothing to do with `ra-core`: react-admin lives one layer up, in [admin](/packages/admin.md). This package's job is purely to connect [kernel](/packages/kernel.md) and IGNIS's DI container to React's component tree.

## Role

Applications rarely install this package directly - most install [ardor](/packages/ardor.md), which re-exports it. But `react` is where the actual context and hooks are implemented. It sits between the kernel (which defines binding keys and core types) and any UI package built on top, including admin.

## Exports

The package barrel (`src/index.ts`) re-exports two groups:

- **contexts** - `ApplicationContext` and its value type `IApplicationContextValue`.
- **hooks** - everything else: `useApplicationContext` and `useApplicationLogger`; the DI hooks `useInjectable`, `useApplicationContainer`, `useService`, `useProvider`, `useComponent`, `useConfiguration` and `useRepository`, together with the `TUseInjectableKeys`/`IUseInjectableKeysOverrides` types; the UI hooks `useDebounce`, `useAutosave`, `useConfirm`, `useBeforeUnload`, `useCopyToClipboard` (`{ resetMs? }` returns `{ copy, isCopied }`; the write is a module-level async function and `copy` is a `.then` over it, because the repo forbids an async callback in a hook; one timer ref, cleared by the next copy and on unmount; `copy` depends only on `resetMs`), `useMediaQuery({ query })`, `useDocumentVisibility()` and `useOnlineStatus()` (each a `useSyncExternalStore` over one browser event, with a fixed server snapshot: `false`, `'visible'`, `true`, and no `window`, `document` or `navigator` read in a server render), `useElementSize` (a `ref` object or, with none, a returned callback `ref`; `box`, `round`; `{ width, height, measured }`; one state update per animation frame), `useResizeEffect` (`{ targets, onResize, box?, children?, beforePaint? }`: `targets` are elements, refs or `null`, resolved after every render and synced to one `ResizeObserver` by a diff of the watched set (no new observer, no repeated first entries); the observer is for all the elements and one call per animation frame (or, with `beforePaint`, one per observer callback, before paint) with the latest entry of each element that resized; the latest `onResize` is held in a ref; `children` also observes each target's direct children and observes again on a childList mutation, through a `MutationObserver` made only with `children`), `useIntersection` (`{ target, rootMargin?, threshold? }`: the latest `IntersectionObserverEntry` or `undefined`; `target` is a `TElementTarget` resolved after every render by `ElementTargets.resolve` (shared with `useResizeEffect`), kept in state so a changed element observes again; the entry is forgotten on a new element or option, and state changes only when `isIntersecting` or the ratio changed; `threshold` is one number, no `root`; it does not use `ResizeObservation`, which is built around `ResizeObserver` entries, frames and many targets), `useStoredState` (`{ value, setValue, remove }` over `BrowserStorage`, in step across hooks and tabs; an updater runs against the current value at call time, the stored one or the one kept after a refused write (a raw write that fires no event is not seen while a value is kept), so chained updaters compose; `remove` and `setValue` always notify, there is no `silent`; `writeDelayMs` keeps the pending value in the same kept state and writes it once after the delay: every `keep` call ends the timer, so a foreign write, a `remove` and a new `setValue` cancel it, while an unmount or a new key or storage writes it to its own key; so do `pagehide` and the page turning hidden, through two listeners added only while `writeDelayMs` is above 0) and `useWindowDimensions`; `useElementSize` and `useResizeEffect` share `ResizeObservation.observe` (`src/hooks/resize-observation.ts`, not exported by the package: the observer, the frame coalescing and the clean-up); and the Redux factories `DispatchHooks.create` and `SelectorHooks.create` (formerly `createAppDispatch` and `createAppSelectors`, removed), for binding a typed `RootState`/`AppDispatch` pair; `useDeepEqualSelector` compares by value only primitives, plain objects, arrays and dates (none cyclic) and any other object by identity, with a small comparator in `src/hooks/redux/use-app-selector.ts`, since the package has no `lodash`.

## ApplicationContext

Defined in `src/contexts/application.ts`, this is a plain `React.createContext<IApplicationContextValue>` holding `{ container, logger }`, both nullable by default. It is the single source of truth that hooks read from - there is no other way for a hook to reach the IGNIS container from inside a component tree. See [Hooks and context](/architecture/hooks-and-context.md) for how this fits into the broader dependency flow, and [DI in the browser](/architecture/di-in-the-browser.md) for how the container itself gets built and put into this context during [application lifecycle](/architecture/application-lifecycle.md).

## useInjectable

`useInjectable` (`src/hooks/use-injectable.ts`) is the resolution hook. It accepts an options object of one of two shapes, matching [options-objects](/conventions/options-objects.md) conventions:

- `{ container?, key }` - resolve by binding key.
- `{ container?, target }` - resolve by class, using the container's metadata registry to look up the binding key registered via decorators like `@service` or `@component`.

If no `container` override is passed, it falls back to `applicationContext.container` read via `React.useContext`. If neither is available it throws. If a `target` is given but no binding key can be resolved for it, it throws with a message telling the caller to decorate the class or register it explicitly - see [binding key namespaces](/conventions/binding-key-namespaces.md) and "Registration by stereotype" in [DI in the browser](/architecture/di-in-the-browser.md).

## IUseInjectableKeysOverrides

This package owns the augmentation point for typed injection keys. `TUseInjectableKeys` is defined as `TUseInjectableKeysDefault | keyof IUseInjectableKeysOverrides`, where the default comes from kernel's `CoreBindings`. Downstream packages or applications that want `useInjectable({ key: ... })` to autocomplete and typecheck their own binding keys must augment `IUseInjectableKeysOverrides` with `declare module '@venizia/ardor'`: the umbrella re-exports it with `export *`, which TypeScript follows to this package, and it resolves where `@venizia/ardor-react` does not (an application that does not depend on this package, under a non-hoisting linker). This is the canonical example referenced in [module augmentation](/architecture/module-augmentation.md).

## The per-stereotype hooks

`useService`, `useProvider`, `useComponent`, `useConfiguration` and `useRepository` live in `src/hooks/use-artifact.ts`.
Each takes the same options union as `useInjectable` - `{ key }` or `{ target }`, never a positional
class, per [options objects](/conventions/options-objects.md).

They are not aliases. Each asserts the resolved binding sits under its own namespace, so
`useService({ target: SomeProvider })` throws with both namespaces named rather than returning an
object of the wrong kind. Only a `target` is checked: a `key` carries its namespace in the string and
is the caller's to be wrong about.

A `{ target }` with no recorded key - an undecorated class, or one bound only through `service()`,
`injectable()` or `bindingList()` - skips the namespace check and throws from `useInjectable`.
Return-type inference from the class and the stereotype requirement are in
[Hooks and context](/architecture/hooks-and-context.md).

No stereotype maps to `providers`, so `useProvider({ target })` passes only for a class that declares
`binding: { namespace: BindingNamespaces.PROVIDER, key }`. ARDOR's default providers live under
`CoreBindings` keys and are resolved with `useProvider({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })`
or `useInjectable`.

`useApplicationContainer` is exported for the same reason the check works - every hook built on
`useInjectable` must read the SAME container it resolves from, or the assertion passes by accident.

## Test environment

Tests in this package run under `happy-dom` rather than a full browser or `jsdom`, since the hooks and context here need a DOM-like environment (for things like `useBeforeUnload` and `useWindowDimensions`) without the overhead of a real browser. This is consistent with the broader [testing conventions](/conventions/testing-conventions.md) and the setup described in [build, run, test](/overview/build-run-test.md).
