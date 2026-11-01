---
title: Utilities live on classes, hooks on Ardor, the logger is IGNIS's, and the old names are gone
description: The kernel utilities, the Redux hook factories and the admin boot helpers are class members, Ardor holds every hook, the logger is IGNIS's ILogger, and a codemod moves your code; the old names and a few unused exports are removed.
packages: ['@venizia/ardor', '@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin']
---

# Changelog - 2026-11-01

## Utilities live on classes, hooks on Ardor, the logger is IGNIS's, and the old names are gone

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="Enhancement" />

**In one line.** Exported functions now live as static members of a class, the way `React.useCallback` lives on `React`, `Ardor` holds every hook, and the logger is IGNIS's `ILogger`. The old names, and a few exports nothing used, are removed; `bun run ardor codemod namespace` moves your code.

## Before you upgrade: keep debug lines out of production

<Badge type="danger" text="Do this with the upgrade" />

`enableDebug` is gone, and nothing replaces it by default: after the upgrade every `logger.debug(...)` call writes to `console.debug`, in production too, where it used to be dropped. If a debug call logs a payload, a token or any decrypted data, that data now reaches the browser console of every user.

Add this in the same change that upgrades, and import its file first in your entry point (before any module that logs). Do not ship the upgrade without it:

```ts
import { ConsoleLogger, type ILogger, LoggerSlot } from '@venizia/ignis-helpers/core';

// The console logger with `debug` a no-op. Install it before the first log line.
const withoutDebug = (logger: ILogger): ILogger => ({
  debug: () => undefined,
  info: (message, ...args) => logger.info(message, ...args),
  warn: (message, ...args) => logger.warn(message, ...args),
  error: (message, ...args) => logger.error(message, ...args),
  emerg: (message, ...args) => logger.emerg(message, ...args),
  log: (level, message, ...args) => logger.log(level, message, ...args),
  for: (name) => withoutDebug(logger.for(name)),
});

// Your bundler's production flag: `import.meta.env.PROD` in Vite, `process.env.NODE_ENV === 'production'` elsewhere.
declare const isProduction: boolean;

if (isProduction) {
  LoggerSlot.use({
    resolver: ({ scopes }) => withoutDebug(ConsoleLogger.get({ scope: scopes.join('-') })),
  });
}
```

Replace `isProduction` with your bundler's flag. Install it before the first log line: a helper keeps the logger it resolved on its first line, so a line logged earlier stays on the console. Every `this.logger`, every hook logger and the `ArdorApplication` default are built from a `BaseHelper`, so this one call silences them all; a logger you pass as the `logger` prop of `ArdorApplication` is yours to silence.

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

## The logger is IGNIS's

ARDOR no longer has a logger of its own. `Logger`, `LogLevels`, `ILogger`, `TLogLevel` and `BaseHelper` are gone from `@venizia/ardor-kernel`; IGNIS's, from `@venizia/ignis-helpers/core` (the entry a browser bundle can import), are what is used.

| Before | Now |
|---|---|
| `BaseHelper`, `LogLevels`, `ILogger`, `TLogLevel` of ARDOR | the same names from `@venizia/ignis-helpers/core`; only the import changes |
| `Logger.getInstance({ scope })`, `new Logger({ scope })` | `new BaseHelper({ scope }).logger` |
| `Logger` as a type | `ILogger` |
| `ApplicationContext.logger`, `useApplicationLogger()` returning `Logger` | an `ILogger` |
| `<ArdorApplication enableDebug />` | `<ArdorApplication logger={...} />`; absent, a console logger named after the application |

What stays the same, so most code needs no change:

- **`BaseService` and `BaseProvider` keep `this.logger`**, now typed `ILogger`, built from the same `{ scope }` the class passes to `super`. A class that calls `this.logger.info(...)`, `.warn`, `.error` or `.debug` compiles and logs as before.
- **A class that extends the kernel's `BaseHelper` directly** changes only its import to `BaseHelper` from `@venizia/ignis-helpers/core`; the `{ scope }` constructor and `this.logger` are the same.
- `@api()` still logs a failing method through `this.logger`.

What differs:

- **There is no debug switch; one resolver does it.** `enableDebug` is gone (from `Logger.getInstance` and from `ArdorApplication`). Debug lines go to `console.debug`, which a browser hides until its Verbose level is on, where a line used to be dropped until `enableDebug` was set. To drop them in production, install a resolver once at startup, before the first log line (the snippet is under "Before you upgrade", above).
- **`ILogger` takes a string first argument, then format arguments** (`logger.info('[x] value: %o', value)`). The old `Logger` also accepted an object or any other value as the first argument and passed it through to the console; pass it after a format string instead.
- **The line format is IGNIS's:** `[scope] message`, with no timestamp and level in the text (the console adds its own). `generateLog`, `getTimestamp` and the static `getInstance` cache are gone, and `Logger.getInstance` returned one shared object per scope while `new BaseHelper({ scope }).logger` builds a new one: keep a logger you want to spy on in a constant.
- **To send the lines elsewhere,** register a provider once at startup with `LoggerFactory.use` from `@venizia/ignis-helpers` (Node), or `LoggerSlot.use` from `@venizia/ignis-helpers/core` (a browser bundle); every `this.logger` follows it. Pass `logger` to `ArdorApplication` for the React tree.

## The `Ardor` hook namespace

`@venizia/ardor` exports `Ardor`, which holds every hook of the react and admin packages: `Ardor.useRepository()`, `Ardor.useTranslate()`, `Ardor.useDocumentTitle(...)`. It is the same function as the bare `useRepository`, the React Rules of Hooks check the call, and it adds no bytes to an app, because a bundler keeps only the hooks you call through it. The bare hooks are not removed: they stay exported from `@venizia/ardor`, `@venizia/ardor-react` and `@venizia/ardor-admin`, and `@venizia/ardor-react` and `-admin` keep them as their only form, since neither package can import `Ardor`.

## Who is affected

- **An application or a package that uses one of the removed names, `Logger` or `BaseHelper` of the kernel, or `enableDebug`.** It no longer compiles until you move; the codemod below does it, and lists what it will not guess.
- **A service or provider that only calls `this.logger`.** No action needed.
- **A project that uses only the hooks.** No action needed.
- **Everyone else.** No action needed.

## Breaking changes

> [!WARNING]
> The names in the tables above are gone from `@venizia/ardor`, `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin`. The codemod is the upgrade path: commit your work first, then run it.

> [!IMPORTANT]
> The peer floors rise with it: `@venizia/ignis-helpers` to `^0.4.7-1` on all four packages (the logger is its `BaseHelper`, `LoggerSlot` and `ConsoleLogger` come from the same release), and `@venizia/ignis-inversion` to `^0.4.6-1` on `@venizia/ardor`, whose `./testing` entry needs `BindingVerifier`. Move your `@venizia/ignis-*` packages to the same IGNIS release, and keep one copy of each.

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

4. Fix what it lists with a file and line: a name the file also declares itself, a re-export by name, a `Logger` use with no one-line form (a subclass, `instanceof`, a `Logger.getInstance` whose argument is not an object with a `scope`), the `enableDebug` prop of `ArdorApplication`, and the removed names with nothing to put in their place. It follows the import source: a `BaseHelper` your project defines itself, or imports from another module, is not touched, and when such a file also uses the kernel's `Logger`, IGNIS's class is imported as `BaseHelper as IgnisBaseHelper` so the two names do not clash. A line it prints with `note` is a change it made on purpose (a dropped `enableDebug` option) and does not count as left. `--check` exits 1 while anything is left, for CI.

`bun run ardor` runs the `@venizia/ardor` installed in your project and never downloads another package; the codemod needs the `typescript` package, which your project has. Add `--hooks` to also move the hooks you import from `@venizia/ardor` to `Ardor.useX`; hooks imported from `@venizia/ardor-react` or `@venizia/ardor-admin` are never touched.
