---
title: Utilities move to classes, hooks to Ardor, logger to IGNIS, and old names are removed
description: Utilities and helpers are now on classes, Ardor holds all hooks, the logger comes from IGNIS, and a tool updates your code.
packages: ['@venizia/ardor', '@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin']
---

# Changelog - 2026-11-01

## Utilities move to classes, hooks to Ardor, logger to IGNIS, and old names are removed

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="Enhancement" />

**In short.** Utility functions are now static methods on classes, just like `React.useCallback` is on `React`. `Ardor` now contains all hooks, and the logger is now `ILogger` from IGNIS. We removed the old names and a few unused exports. You can update your code with `bun run ardor codemod namespace`.

## Before you update: debug logs in production and development

<Badge type="warning" text="Check this" />

`enableDebug` is gone. The default console logger from IGNIS controls its own debug output. You do not need to install anything to keep debug lines out of a production browser. A `debug` line is written only when `DEBUG` is truthy and `NODE_ENV` allows it. A browser without a `process` global (Vite, esbuild) never writes one. Any debug call with a payload, a token, or decrypted data stays off your users' consoles, just like `enableDebug: false` worked before.

Two cases need one line of setup when your app starts:

- **A Node process with `DEBUG` set** (server-side render, a script, a test run) writes these lines. The log level you set decides what is written, no matter what the environment says.
- **A browser during development** writes no debug lines by default. Set the level to `debug` to show them.

```ts
import { LoggerFactory, LogLevels } from '@venizia/ignis-helpers/core';

declare const isProduction: boolean; // your bundler's flag

LoggerFactory.use({ level: isProduction ? LogLevels.INFO : LogLevels.DEBUG });
```

Call this code once. Place it in a module that is not a component, before any log is written. The linter rule `react-hooks/rules-of-hooks` thinks `.use(...)` in PascalCase is a hook. Disable the rule on that line.

## What changed

These functions are now static methods on classes:

| Before | Now |
|---|---|
| `isDefined(value)`, `isString(value)`, `isNumber`, `isObject`, `isValidDate` | `ValueUtility.isDefined`, `.isString`, `.isNumber`, `.isObject`, `.isValidDate` (the two type guards stay positional, so narrowing still works) |
| `isBrowser()` | `BrowserUtility.isBrowser()` |
| `toDataUrl({ blob })` | `FileUtility.toDataUrl({ blob })` |
| `getRuntimeConfig({ key, ... })` | `RuntimeConfig.get({ key, ... })`; `required: true` still returns a `string`, the error code is unchanged, and the message now starts `[RuntimeConfig.get]` |
| `createAppDispatch<TDispatch>()`, `createAppSelectors<TState>()` | `DispatchHooks.create<TDispatch>()`, `SelectorHooks.create<TState>()` |
| `resolveApplicationProviders`, `hasPendingFeatureMessages`, `loadFeatureMessages` | `ApplicationProviders.resolve`, `Features.hasPendingMessages`, `Features.loadMessages` |

Each new method works the same as the old function, with one exception: `Features.hasPendingMessages` and `Features.loadMessages` also react to the application's lazy `i18nSources`, which arrived in the same release (see [lazy i18n sources](./2026-11-01-lazy-i18n-sources)). `inject`, `getError`, the stereotypes, `api`, `ArdorApplication`, `ApplicationContext`, `buildInfoFile`, and `assertArdorApplicationBoots` keep their names.

These types are now regular TypeScript types with the exact same definitions:

| Before | Now |
|---|---|
| `NumberIdType`, `StringIdType` | `number`, `string` |
| `NullableType` | `undefined \| null \| void` |

We removed these exports because ARDOR never used them:

| Removed | Instead |
|---|---|
| `isEditableTarget` | check the event target in your own code |
| `TDataCount<T>` | declare the shape you need |
| `ISyncFC<TProps>` of `@venizia/ardor-react` | write `(props: TProps) => ReactNode` |
| `App.DEFAULT_LOCALE` | nothing read it, and its value was `'en.UTF-8'`, not `en`; the i18n provider starts in the browser's language when it is one of your `languages`, else `en` |
| `HeaderConstants.REQUEST_DEVICE_INFO`, `HeaderConstants.RESPONSE_FORMAT` | ARDOR sends and reads neither header |

## The logger from IGNIS

ARDOR no longer has its own logger. `Logger`, `LogLevels`, `ILogger`, `TLogLevel`, and `BaseHelper` are removed from `@venizia/ardor-kernel`. Use the exports from `@venizia/ignis-helpers/core` instead. This entry point is safe to import in a browser bundle.

| Before | Now |
|---|---|
| `BaseHelper`, `LogLevels`, `ILogger`, `TLogLevel` of ARDOR | the same names from `@venizia/ignis-helpers/core`; the import changes, and `ILogger` and `LogLevels` have more members (see below) |
| `Logger.getInstance({ scope })`, `new Logger({ scope })` | `LoggerFactory.getLogger([scope])` from `@venizia/ignis-helpers/core` |
| `Logger` as a type | `ILogger` |
| `ApplicationContext.logger`, `useApplicationLogger()` returning `Logger` | an `ILogger` |
| `new AuthRecovery({ logger })` with a `Logger` | `logger` is an `ILogger` |
| `<ArdorApplication enableDebug />` | `<ArdorApplication logger={...} />`; absent, `LoggerFactory.getLogger([applicationName])` |

What stays the same (most code needs no change):

- **`BaseService` and `BaseProvider` keep `this.logger`**. Its type is now `ILogger`. It uses the same `{ scope }` that your class passes to `super`. Calls to `this.logger.info(...)`, `.warn`, `.error`, or `.debug` work and log as before.
- **A class that extends `BaseHelper` from the kernel directly** only changes its import to `BaseHelper` from `@venizia/ignis-helpers/core`. The `{ scope }` constructor argument and `this.logger` stay the same.
- `@api()` still logs any failing method through `this.logger`.

What is different:

- **The IGNIS `ILogger` has more methods.** The removed kernel `ILogger` had `debug`, `info`, `warn` and `error`. The one from IGNIS adds `emerg(message, ...args)`, `log(level, message, ...args)` and `for(methodName)`, which returns an `ILogger`. A class that `implements ILogger` does not compile until it has those three. The IGNIS `LogLevels` adds `EMERG`, `ORDER` and `isEnabled` to the members the old class had (`DEBUG`, `INFO`, `WARN`, `ERROR`, `SCHEME_SET`, `isValid`).
- **`AuthRecovery` and `AuthTokenStore`.** The `logger` option of `AuthRecovery` is an `ILogger`. `AuthTokenStore` writes its warning about an unreadable stored token through `LoggerFactory.getLogger(['AuthTokenStore'])`: the same text and the same payload (the error name only), in the IGNIS line format.
- **`enableDebug` is gone, and debug logs are off by default.** This is removed from `Logger.getInstance` and from `ArdorApplication`. The console logger writes `debug` lines only when `DEBUG` is truthy and `NODE_ENV` allows it. It never writes debug lines in a browser without `process`. `LoggerFactory.use({ level })` changes this behavior (see "Before you update", above).
- **`ILogger` takes a format string as the first argument, then values** (`logger.info('[x] value: %o', value)`). The old `Logger` allowed an object or any other value as the first argument. Now you must pass those values after a format string.
- **Log lines use the IGNIS format:** `[scope] message`. They do not include a timestamp or a level in the text, because the browser console shows its own. `generateLog`, `getTimestamp`, and the static cache on `getInstance` are gone. `LoggerFactory.getLogger([scope])` returns one logger for each scope, just like `Logger.getInstance` did. `new BaseHelper({ scope }).logger` does the same. A `spyOn` on that logger affects all code that logs under that scope, so restore it after your test.
- **To send logs to another destination,** set a provider at startup with `LoggerFactory.use({ provider })` from `@venizia/ignis-helpers/core`. Every logger uses that provider, even loggers created earlier. Pass `logger` to `ArdorApplication` for the React tree.

## Testing and the Vite plugin

- **`assertArdorApplicationBoots`** keeps its name and its options. It now needs `@venizia/ignis-inversion` with `BindingVerifier.assertResolve`, which is in `0.4.6-1` and later. With an older inversion it fails at once with `The installed @venizia/ignis-inversion has no BindingVerifier.assertResolve | It arrived in 0.4.6-1: upgrade the peer to ^0.4.6, or this helper cannot check the bindings`. The peer range already asks for `^0.4.6`, so this only shows in an install that forced an older copy.
- **`buildInfoFile` of `@venizia/ardor/vite`** no longer installs a quiet logger for the Vite process. The IGNIS git lookup it uses writes its "git unavailable" lines at `debug` level. They stay silent because debug is off, and they print when `DEBUG` is set. An app that relied on the plugin to set the process-wide `LoggerFactory` provider now gets the IGNIS default.

## The `Ardor` namespace for hooks

`@venizia/ardor` now exports `Ardor`. It contains every hook from the react and admin packages: `Ardor.useRepository()`, `Ardor.useTranslate()`, `Ardor.useDocumentTitle(...)`. Each hook is the exact same function as the standalone hook like `useRepository`. React Rules of Hooks still check the call. It adds no extra code to your app bundle, because bundlers drop any hook you do not call. These are the 25 hooks it holds: `useApplicationContext`, `useApplicationLogger`, `useAutosave`, `useBeforeUnload`, `useComponent`, `useConfiguration`, `useConfirm`, `useCopyToClipboard`, `useDebounce`, `useDocumentTitle`, `useElementSize`, `useFeatures`, `useHtmlLang`, `useInjectable`, `useInjectableContainer`, `useNotifyError`, `useProvider`, `useRefreshToken`, `useRepository`, `useRequestHeaderLocale`, `useService`, `useSizer`, `useStoredState`, `useTranslate` and `useWindowDimensions`. The size budget of the `@venizia/ardor` entry went from 350 B to 700 B for the namespace; the hooks themselves are not part of that measure. Standalone hooks are still exported from `@venizia/ardor`, `@venizia/ardor-react`, and `@venizia/ardor-admin`. `@venizia/ardor-react` and `-admin` keep only the standalone hooks, because they cannot import `Ardor`.

## Who is affected

- **An application or package that uses removed names, `Logger` or `BaseHelper` from the kernel, or `enableDebug`.** Your code will not compile until you update. The codemod tool updates your code and reports what it cannot change automatically.
- **A class that `implements ILogger`, or code that passes a logger to `AuthRecovery`.** Add `emerg`, `log` and `for`, and pass an IGNIS `ILogger`.
- **A test that calls `assertArdorApplicationBoots`.** It needs inversion `0.4.6-1` or later, which the peer range already asks for.
- **A service or provider that only calls `this.logger`.** You do not need to do anything.
- **A project that uses only hooks.** You do not need to do anything.
- **All other projects.** You do not need to do anything.

## How to upgrade

> [!WARNING]
> The names in the tables above are gone from `@venizia/ardor`, `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin`. The codemod is the upgrade path: commit your work first, then run it.

> [!IMPORTANT]
> The IGNIS peer floors rise with it, on all four packages, to the IGNIS 0.4.7 release: `@venizia/ignis-helpers`, `-kernel`, `-boot` and `-connectors` `^0.4.7` (the logger is `LoggerFactory` of helpers, in the browser-safe `core` entry), `@venizia/ignis-inversion` and `-filter` `^0.4.6`. Move all your `@venizia/ignis-*` packages to the same IGNIS release, and keep one copy of each. IGNIS 0.4.6 does not satisfy `^0.4.7`, so it is not accepted for helpers, kernel, boot and connectors; it does satisfy `^0.4.6` of inversion and filter. `@venizia/ignis-boot` is an optional peer of `@venizia/ardor` only, and `@venizia/ignis-connectors` is optional on `@venizia/ardor-kernel` and `@venizia/ardor`.

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

How to update your project:

1. Commit or stash your changes. The `--write` flag will not edit a file with uncommitted changes, so git can undo the edit. Pass `--allow-dirty` along with `--write` to edit dirty files anyway.
2. Preview changes without writing files:

   ```bash
   bun run ardor codemod namespace src
   ```

3. Apply changes, then run your code formatter (class names are added at the end of import statements):

   ```bash
   bun run ardor codemod namespace src --write
   ```

   If another codemod like `devz codemod namespace-functions --write` already changed files, your working tree is dirty. Run `bun run ardor codemod namespace src --write --allow-dirty` to apply changes without stashing first.

4. Check the warnings that show a file and a line number. Update those manually: names declared in the file itself, a class name the file already uses for something else, re-exports by name, uses of `Logger` that cannot be rewritten automatically (subclasses, `instanceof`, or `Logger.getInstance` without a `{ scope }` object), the `enableDebug` prop on `ArdorApplication`, and removed names with no direct replacement. The tool checks import sources. If your project defines its own `BaseHelper` or `LoggerFactory`, or imports them from somewhere else, it does not touch them. If that same file also uses `Logger` from the kernel, it imports IGNIS's `LoggerFactory` as `LoggerFactory as IgnisLoggerFactory` to avoid name conflicts. Lines marked with `note` are planned changes (such as removing `enableDebug`), not items you still need to fix. Run `--check` in CI; it exits with code 1 if any manual fixes remain.

`bun run ardor` runs the local copy of `@venizia/ardor` in your project and does not download extra packages. `bun run ardor` only works in a package whose `package.json` depends on `@venizia/ardor`. In any other package, run the binary from a package that has it by relative path: `bun ../app/node_modules/@venizia/ardor/dist/codemod/bin.js codemod namespace src` (replace `../app` with the path to that package). The tool reads your code with `typescript`, an optional peer of `@venizia/ardor` (`>=5.0.0`) that a TypeScript project already has. Without it the tool prints `ardor codemod: the "typescript" package is not installed here` and exits with code 2. It reads `.ts`, `.tsx`, `.mts` and `.cts` files only (not `.d.ts`, `.js`, `.jsx` or `.vue`): inside a git repository the files git knows, outside it the folder without `node_modules`, `dist`, `build` and dot-directories. It does not look at an `enableDebug` passed to a wrapper component of your own. Add `--hooks` to also update hook imports from `@venizia/ardor` to `Ardor.useX`. Hooks imported from `@venizia/ardor-react` or `@venizia/ardor-admin` are not changed.
