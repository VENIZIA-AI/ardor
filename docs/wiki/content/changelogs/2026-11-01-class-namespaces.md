---
title: Utilities live on classes, hooks on Ardor, and the old names are gone
description: The kernel utilities, the Redux hook factories and the admin boot helpers are class members, Ardor holds every hook, and a codemod moves your code; the old bare names and a few unused exports are removed.
packages: ['@venizia/ardor', '@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin']
---

# Changelog - 2026-11-01

## Utilities live on classes, hooks on Ardor, and the old names are gone

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="Enhancement" />

**In one line.** Exported functions now live as static members of a class, the way `React.useCallback` lives on `React`, and `Ardor` holds every hook. The old bare names, and a few exports nothing used, are removed; `bun run ardor codemod namespace` moves your code.

## What changed

Functions that became class members:

| Before | Now |
|---|---|
| `isDefined(value)`, `isString(value)`, `isNumber`, `isObject`, `isValidDate` | `ValueUtility.isDefined`, `.isString`, `.isNumber`, `.isObject`, `.isValidDate` (the two type guards stay positional, so narrowing still works) |
| `isBrowser()` | `BrowserUtility.isBrowser()` |
| `toDataUrl({ blob })` | `FileUtility.toDataUrl({ blob })` |
| `getRuntimeConfig({ key, ... })` | `RuntimeConfig.get({ key, ... })`; `required: true` still returns a `string`, the error code is unchanged, and the message now starts `[RuntimeConfig.get]` |
| `createAppDispatch<TDispatch>()`, `createAppSelectors<TState>()` | `DispatchHooks.create<TDispatch>()`, `SelectorHooks.create<TState>()` |
| `resolveApplicationProviders`, `hasPendingFeatureMessages`, `loadFeatureMessages` | `ApplicationProviders.resolve`, `Features.hasPendingMessages`, `Features.loadMessages` |

Each new member is the function the old name was, so nothing behaves differently. `inject`, `getError`, the stereotypes, `api`, `ArdorApplication`, `ApplicationContext`, `buildInfoFile` and `assertArdorApplicationBoots` keep their names.

Types that became plain types, with the exact old definition:

| Before | Now |
|---|---|
| `NumberIdType`, `StringIdType` | `number`, `string` |
| `NullableType` | `undefined \| null \| void` |

Removed with nothing to replace them, because ARDOR never used them:

| Removed | Instead |
|---|---|
| `isEditableTarget` | check the event target in your own code |
| `TDataCount<T>` | declare the shape you need |
| `ISyncFC<TProps>` of `@venizia/ardor-react` | write `(props: TProps) => ReactNode` |
| `App.DEFAULT_LOCALE` | the i18n provider defaults to `en` |
| `HeaderConstants.REQUEST_DEVICE_INFO`, `HeaderConstants.RESPONSE_FORMAT` | ARDOR sends and reads neither header |

## The `Ardor` hook namespace

`@venizia/ardor` exports `Ardor`, which holds every hook of the react and admin packages: `Ardor.useRepository()`, `Ardor.useTranslate()`, `Ardor.useDocumentTitle(...)`. It is the same function as the bare `useRepository`, the React Rules of Hooks check the call, and it adds no bytes to an app, because a bundler keeps only the hooks you call through it. The bare hooks are not removed: they stay exported from `@venizia/ardor`, `@venizia/ardor-react` and `@venizia/ardor-admin`, and `@venizia/ardor-react` and `-admin` keep them as their only form, since neither package can import `Ardor`.

## Who is affected

- **An application or a package that uses one of the removed names.** It no longer compiles until you move; the codemod below does it, and lists what it will not guess.
- **A project that uses only the hooks.** No action needed.
- **Everyone else.** No action needed.

## Breaking changes

> [!WARNING]
> The names in the first three tables are gone from `@venizia/ardor`, `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin`. The codemod is the upgrade path: commit your work first, then run it.

**Before:**

```ts no-check
import { getRuntimeConfig, isDefined, type NullableType } from '@venizia/ardor';

const url = getRuntimeConfig({ key: 'VITE_API_URL', defaultValue: '/api' });
const present = items.filter(isDefined); // ...
export type Maybe = string | NullableType;
```

**After:**

```ts
import { RuntimeConfig, ValueUtility } from '@venizia/ardor';

const items: Array<string | undefined> = ['a', undefined];
const url = RuntimeConfig.get({ key: 'VITE_API_URL', defaultValue: '/api' });
const present = items.filter(ValueUtility.isDefined);
export type Maybe = string | undefined | null | void;
export { present, url };
```

To move a project:

1. Commit or stash your changes. `--write` refuses a file with local changes, so git can undo the codemod.
2. See what it would change; nothing is written:

   ```bash
   bun run ardor codemod namespace src
   ```

3. Apply it, then run your formatter, since the class names are added at the end of the import:

   ```bash
   bun run ardor codemod namespace src --write
   ```

4. Fix what it lists with a file and line: a name the file also declares itself, a re-export by name, and the removed names with nothing to put in their place. `--check` exits 1 while anything is left, for CI.

`bun run ardor` runs the `@venizia/ardor` installed in your project and never downloads another package; the codemod needs the `typescript` package, which your project has. Add `--hooks` to also move the hooks you import from `@venizia/ardor` to `Ardor.useX`; hooks imported from `@venizia/ardor-react` or `@venizia/ardor-admin` are never touched.
