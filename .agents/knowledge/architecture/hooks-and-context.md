---
type: Concept
title: Hooks and context
description: How ARDOR exposes the IGNIS container and logger to React through ApplicationContext, and the hooks built on top of it and on ra-core.
resource: packages/react/src/contexts/application.ts
tags: [hooks, context, react, ignis, ra-core]
---

# Hooks and context

ARDOR bridges the IGNIS dependency injection container into the React tree with a single plain context, `ApplicationContext`, defined at `packages/react/src/contexts/application.ts`. Its shape is:

```ts
{ container: Container | null, registry: Container | null, logger: Logger | null }
```

All three fields default to `null`. The ARDOR application fills them in when it mounts - see [Application lifecycle](/architecture/application-lifecycle.md) and [DI in the browser](/architecture/di-in-the-browser.md). Components below that mount point read the context through hooks rather than `useContext` directly.

## Core context hooks

- `useApplicationContext()` - returns the `container`. Throws if the context has no container, which happens if the hook is called outside an ARDOR-mounted tree.
- `useApplicationLogger()` - returns the `logger`. Throws under the same condition.

Both are thin, single-purpose accessors: they exist so components do not need to know the shape of `ApplicationContext` or handle the null case themselves.

## useInjectable

`useInjectable` is the general-purpose hook for pulling a bound instance out of the container. It accepts either `{ key }` or `{ target }`, plus an optional explicit `container` override:

```ts
type TUseInjectableOptions =
  | { container?: Container; key: TUseInjectableKeys; target?: never }
  | { container?: Container; key?: never; target: TClass<AnyType> };
```

Resolution rules:

- `{ key }` calls `container.get({ key })` directly - `key` is typically a value from the const-class binding keys registry (see [Binding key namespaces](/conventions/binding-key-namespaces.md)).
- `{ target }` looks the binding key up in the container's metadata registry first, then resolves it. The class must have been decorated or registered on the application - otherwise the hook throws.
- If you pass an explicit `container`, that takes priority over the one in context. If there is neither an explicit container nor one in context, the hook throws.

The type `TUseInjectableKeys` is the union of core binding key strings plus the keys of `IUseInjectableKeysOverrides`, an empty interface you augment for your own bindings. This is the same [module augmentation](/architecture/module-augmentation.md) pattern used elsewhere in ARDOR, and it keeps custom binding keys type-safe without ARDOR needing to know about them ahead of time. See also [Binding keys](/reference/binding-keys.md).

## ra-core hooks

ARDOR wraps several ra-core hooks to add typing and safe fallbacks. These need react-admin providers in the tree, not just `ApplicationContext`:

- `useTranslate` - typed wrapper over the ra-core i18n provider. The key type is every dotted path of the English message catalog plus `IUseTranslateKeysOverrides`. When no i18n provider is present in the tree, it degrades to an identity function, so components using it remain safe to render outside a full react-admin mount. See [i18n](/architecture/i18n.md).
- `useNotifyError` - turns an `ApplicationError` into a react-admin notification, reading `error.normalized.code` as the message key and `error.normalized.args` as `messageArgs`. Needs the ra-core notification context. See [Error flow](/architecture/error-flow.md).
- `useRefreshToken` - needs the ra-core auth provider context and a TanStack `QueryClientProvider`. See [Auth recovery](/architecture/auth-recovery.md).
- `useRequestHeaderLocale` - needs ra-core locale state plus `DEFAULT_REST_DATA_PROVIDER` bound in the container, so it can push the current locale onto outgoing request headers. See [Header protocol](/architecture/header-protocol.md) and [Data provider pipeline](/architecture/data-provider-pipeline.md).

Each of these hooks will throw or degrade differently if its required provider is missing, so when adding a new hook of this kind, document its tree requirements explicitly - see [Adding a hook](/process/adding-a-hook.md).

## UI and browser-only hooks

A second group of hooks needs nothing from React context at all - they only use browser APIs: `useDebounce`, `useAutosave`, `useConfirm`, `useCopyToClipboard`, `useBeforeUnload`, `useSizer`, and `useWindowDimensions`. These are safe to use anywhere, including outside an ARDOR application, and are documented alongside the rest of the hook surface in [Hooks and services](/reference/hooks-and-services.md).

## Redux factories

`createAppDispatch` and `createAppSelectors` are factory functions, not hooks themselves - they return typed hooks (`useAppDispatch`, `useMultipleAppDispatch`, `useAppSelector`, `useShallowEqualSelector`, `useDeepEqualSelector`). The hooks they produce need a react-redux `Provider` in the tree to work. Calling the factories is how an application gets typed Redux hooks bound to its own store shape, following the same options-object and typed-augmentation conventions as the rest of ARDOR - see [Options objects](/conventions/options-objects.md).

## Test environment

Because most of these hooks throw on a missing context or provider, tests that render components using them must set up the same tree the runtime application would provide: wrap with `ApplicationContext.Provider` supplying at least a `container` (and `logger` if the component under test needs it), and wrap ra-core dependent components with the relevant react-admin provider context. See [Testing conventions](/conventions/testing-conventions.md) and [Build, run, test](/overview/build-run-test.md) for how the test harness assembles these providers. Hooks with browser-only requirements (`useDebounce`, `useSizer`, etc.) need no special test setup beyond a DOM environment.
