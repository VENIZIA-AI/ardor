---
title: Utilities and factories are members of classes
description: The kernel utilities, the Redux hook factories and the admin boot helpers move into classes; the bare names stay as deprecated aliases until 0.5.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin']
---

# Changelog - 2026-11-01

## Utilities and factories are members of classes

<Badge type="tip" text="Enhancement" />

**In one line.** Exported functions now live as static members of a class, the way `React.useCallback` lives on `React`. The old bare names still work, are marked `@deprecated`, and go in 0.5.

## What changed

| Before (deprecated) | Now |
|---|---|
| `isDefined(value)`, `isString(value)`, `isNumber`, `isObject`, `isValidDate` | `ValueUtility.isDefined`, `.isString`, `.isNumber`, `.isObject`, `.isValidDate` (the two type guards stay positional, so narrowing still works) |
| `isBrowser()` | `BrowserUtility.isBrowser()` |
| `toDataUrl({ blob })` | `FileUtility.toDataUrl({ blob })` |
| `getRuntimeConfig({ key, ... })` | `RuntimeConfig.get({ key, ... })`; `required: true` still returns a `string`, and the error message and code are unchanged |
| `createAppDispatch<TDispatch>()`, `createAppSelectors<TState>()` | `DispatchHooks.create<TDispatch>()`, `SelectorHooks.create<TState>()` |
| `resolveApplicationProviders`, `hasPendingFeatureMessages`, `loadFeatureMessages` | `ApplicationProviders.resolve`, `Features.hasPendingMessages`, `Features.loadMessages` |

Each old name is the same function as its new member, so nothing behaves differently. `inject`, `getError`, the stereotypes, `api`, `ArdorApplication`, `ApplicationContext`, `buildInfoFile` and `assertArdorApplicationBoots` keep their names.

## Who is affected

- **An application or a package that uses one of the old names.** No action is needed now. Move to the new form before 0.5; the editor strikes the old name through and names the replacement.
- **Everyone else.** No action needed.
