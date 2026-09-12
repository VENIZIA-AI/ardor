---
type: Convention
title: React hooks
description: Naming, parameter, and safety conventions for hooks in ARDOR's react and admin packages, including where ra-core-dependent hooks must live.
resource: packages/react/src/hooks/use-autosave.ts
tags: [conventions, react, hooks, admin]
---

Hooks in ARDOR follow a small set of consistent rules across the [react](/packages/react.md) and [admin](/packages/admin.md) packages. These rules exist so hooks are predictable to call, safe around async work, and easy to test.

## Naming

Every hook is a function whose name starts with `use`, matching the file it lives in: `useAutosave` in `use-autosave.ts`, `useInjectable` in `use-injectable.ts`, `useRefreshToken` in `use-refresh-token.ts`. This is the standard React rule, enforced by lint, and it is what allows the rules-of-hooks linter and `renderHook` test helpers to recognize the function.

## Options object parameter

Hooks that take more than a trivial single value accept one options object, following the same pattern as [Options objects](/conventions/options-objects.md). `useAutosave` takes an `IUseAutosaveParams<TData, TReturn>` with `data`, `onSave`, `interval`, `enableSaveOnUnmount`, `disabled`. `useInjectable` takes a discriminated union options type, `TUseInjectableOptions`, so callers pass either `{ key }` or `{ target }` but never both - the type system prevents supplying both or neither at the type level, and the hook body still checks at runtime.

Every field on the options interface carries a JSDoc comment describing what it does and, where relevant, its default (`@default 2000` on `interval`). Document each field this way; it is the primary API surface a consumer sees in their editor.

## What a hook may need from the tree

A hook can rely only on context that the component tree actually provides. `useInjectable` reads `ApplicationContext` via `React.useContext` to get the [DI container](/architecture/di-in-the-browser.md), and it throws with `getError` (via `@venizia/ignis-inversion` and [error handling](/conventions/error-handling.md)) if no container is available and none was passed explicitly. Document this requirement in the hook's JSDoc or in its consuming feature so callers know the hook must be rendered inside the tree that provides that context (see [Hooks and context](/architecture/hooks-and-context.md)).

## No floating promises

Hooks frequently fire async work from effects and callbacks without the caller awaiting it - autosave timers, cache invalidation, token refresh. Any promise that is not returned or awaited must still be handled. The convention is `Promise.resolve(fn()).catch(...)` (or `somePromise.catch(...)` when already a promise) with a `console.error` that names the hook and the failure:

```ts
Promise.resolve(handleSave.current(debouncedValueToSave)).catch((error: unknown) => {
  console.error('[useAutosave] Failed to save debounced value | error: %s', error);
});
```

`useAutosave` does this both for the debounced save and for the save-on-unmount cleanup. `useRefreshToken` does the same for the query cache invalidation triggered after a token refresh. Never let a promise reject silently inside a hook - an uncaught rejection there is invisible to the calling component and hard to debug. See [Error handling](/conventions/error-handling.md) for the wider convention this follows.

## Hooks touching ra-core live in admin

Any hook that imports from `ra-core` - auth provider hooks, data provider hooks, resource hooks - belongs in [admin](/packages/admin.md), not in the framework-agnostic [react](/packages/react.md) package. `useRefreshToken` is the example: it calls `useAuthProvider` from `ra-core` to get the app's `IAuthProvider`, so it lives under `packages/admin/src/hooks/`. This split keeps `react` free of react-admin dependencies and keeps admin-specific auth and data concerns (see [Auth recovery](/architecture/auth-recovery.md) and [Data provider pipeline](/architecture/data-provider-pipeline.md)) out of the lower-level package.

## Testing with renderHook

Hooks are unit tested with `renderHook` from the standard React testing utilities, following [Testing conventions](/conventions/testing-conventions.md). Because hooks depend on context (like `ApplicationContext` for `useInjectable`) or on timers (like the debounce in `useAutosave`), tests wrap the hook in the necessary providers or fake timers rather than mounting a full component tree. Assert on the hook's return value and on side effects (calls to `onSave`, cache invalidation) rather than on rendered output, since these hooks generally render nothing themselves.
