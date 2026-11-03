---
title: Everything since ARDOR 0.4.6 in one place, with an upgrade checklist
description: A table of every change since 0.4.6 linked to its entry, the peer versions, and the ordered checklist an application follows to move to ARDOR 0.4.7.
packages: ['@venizia/ardor-kernel', '@venizia/ardor-react', '@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-02

## Everything since ARDOR 0.4.6 in one place, with an upgrade checklist

<Badge type="warning" text="Breaking Change" /> <Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" />

**In one line.** ARDOR 0.4.7 removes the old bare names and the kernel logger, so an application on 0.4.6 does not compile until it runs the codemod. It also moves the IGNIS peers to one prerelease family, adds the `Ardor` namespace and adds lazy i18n sources.

```bash
bun add @venizia/ardor
```

> [!NOTE]
> Until 0.4.7 is on `latest`, it is on the `next` dist-tag, and the command above installs 0.4.6. Install 0.4.7 with `bun add @venizia/ardor@next`.

## What changed

| Kind | Change | Packages | In | Entry |
|------|--------|----------|----|-------|
| Breaking Change | Utility functions and factories are static members of classes, and the old bare names, `isEditableTarget`, `TDataCount`, `ISyncFC`, `App.DEFAULT_LOCALE` and two `HeaderConstants` are removed | all four | 0.4.7 | [Utilities move to classes](./2026-11-01-class-namespaces) |
| Breaking Change | The logger is `ILogger` from IGNIS, `enableDebug` is replaced by the `logger` prop, and the kernel `Logger`, `LogLevels`, `ILogger`, `TLogLevel` and `BaseHelper` are removed | all four | 0.4.7 | [Utilities move to classes](./2026-11-01-class-namespaces#the-logger-from-ignis) |
| Breaking Change | Sign-out removes only keys under `@app/auth/`, and `LocalStorageKeys.PREFIX_OAUTH2` is removed | `@venizia/ardor-kernel`, `@venizia/ardor-admin`, `@venizia/ardor` | 0.4.7 | [Sign-out and `@app/oauth2/`](./2026-11-02-sign-out-oauth2-prefix) |
| New feature | `Ardor` holds all 25 hooks, and `ardor codemod namespace` updates your code | `@venizia/ardor` | 0.4.7 | [Utilities move to classes](./2026-11-01-class-namespaces#the-ardor-namespace-for-hooks) |
| New feature | An entry of `i18nSources` can be a loader, so a catalogue stays out of the boot bundle | `@venizia/ardor-admin`, `@venizia/ardor` | 0.4.7 | [Lazy i18n sources](./2026-11-01-lazy-i18n-sources) |
| New feature | `DefaultAuthProvider` has the hooks `onSessionStarted` and `onSessionCleared`, so a socket or a per-user cache stays in step with the session without overriding `checkAuth` | `@venizia/ardor-admin`, `@venizia/ardor` | 0.4.7 | [Session hooks](./2026-11-03-session-lifecycle-hooks) |
| New feature | `BrowserStorage` (typed, never-throwing `localStorage` and `sessionStorage`), the hooks `useStoredState` and `useElementSize` | `@venizia/ardor-kernel`, `@venizia/ardor-react`, `@venizia/ardor` | 0.4.7 | [Typed browser storage and useElementSize](./2026-11-03-browser-storage-and-element-size) |
| New feature | The session hooks see every token change, a refresh by the network service included, and `unauthenticatedRejection` sets what `checkAuth` and a 401 reject with | `@venizia/ardor-kernel`, `@venizia/ardor-admin`, `@venizia/ardor` | 0.4.7 | [Token hook and guest rejection](./2026-11-03-token-hook-and-guest-rejection) |
| Enhancement | The IGNIS peers are one prerelease family: `^0.4.7-2` and `^0.4.6-1` | all four | 0.4.7 | [Utilities move to classes](./2026-11-01-class-namespaces#how-to-upgrade) |

Two size budgets are raised, and both are repository gates, not something an application does: the `@venizia/ardor` entry from 350 B to 700 B (the `Ardor` namespace) and `@venizia/ardor-admin` from 10 KB to 10.65 KB (lazy sources, the session hooks and the token change hook).

| Package | ARDOR 0.4.6 | ARDOR 0.4.7 |
|---------|-------------|-------------|
| `@venizia/ardor` | 0.4.6 | 0.4.7 |
| `@venizia/ardor-kernel` | 0.4.6 | 0.4.7 |
| `@venizia/ardor-react`, `@venizia/ardor-admin` | 0.4.6 | 0.4.7 |

| Peer | 0.4.6 | 0.4.7 |
|------|-------|-------|
| `@venizia/ignis-helpers`, `-kernel`, `-connectors`, `-boot` | `^0.4.1` | `^0.4.7-2` |
| `@venizia/ignis-inversion`, `-filter` | `^0.4.1` | `^0.4.6-1` |
| `typescript` (`@venizia/ardor`, optional) | none | `>=5.0.0` |

IGNIS 0.4.6 stable does not satisfy `^0.4.7-2`, so it is not accepted for helpers, kernel, connectors and boot. It does satisfy `^0.4.6-1` of inversion and filter.

## Who is affected

- **An application on 0.4.6 that uses a removed name, the kernel `Logger` or `BaseHelper`, or `enableDebug`.** It does not compile until you update. Steps 1 to 3.
- **A class that `implements ILogger`, or code that passes a logger to `AuthRecovery`.** Step 4.
- **An application that only calls `this.logger`, or only uses hooks.** Steps 1 and 5 only.
- **A project with a test that calls `assertArdorApplicationBoots`.** Step 6.
- **A project that uses `buildInfoFile` in its Vite config.** Step 7.
- **A project with a subclass of `DefaultI18nProvider`.** Step 8.
- **An app made from the preset.** Step 9.
- **An app that stores OAuth2 state under `@app/oauth2/`.** Step 10.
- **An app that overrides `checkAuth`, `logout` or `saveSession` to sync a socket or a cache with the session.** Step 13.
- **An app with its own `localStorage` helper or `ResizeObserver` hook.** Step 14.
- **A guest app with no login page.** Step 15.

## Upgrade checklist

1. **Move the four ARDOR packages together** to `0.4.7` (the `next` tag, until 0.4.7 is on `latest`), and every `@venizia/ignis-*` package to one IGNIS family: helpers, kernel, connectors and boot at `^0.4.7-2` or newer, inversion and filter at `^0.4.6-1` or newer. A range such as `^0.4.1` never matches a prerelease, so a mix installs two copies.
2. **Run the codemod.** Install `typescript` (`>=5.0.0`, an optional peer of `@venizia/ardor`; without it the tool exits with code 2), commit your work, then preview, write, and run your formatter:

   ```bash
   bun run ardor codemod namespace src
   bun run ardor codemod namespace src --write
   ```

   Add `--allow-dirty` after another codemod, `--hooks` to move hooks to `Ardor.useX`, and `--check` in CI. The tool reads `.ts`, `.tsx`, `.mts` and `.cts` files only. See [how to update your project](./2026-11-01-class-namespaces#how-to-upgrade).
3. **Fix what the codemod only lists:** a name the file declares itself, re-exports by name, `Logger` subclasses and `instanceof`, `Logger.getInstance` without a `{ scope }` object, `enableDebug` on `ArdorApplication` or on a wrapper component of your own, and the removed names that have no replacement.
4. **Check your loggers.** The IGNIS `ILogger` adds `emerg`, `log(level, ...)` and `for(methodName)`, so a class that `implements ILogger` needs those three. The `logger` option of `AuthRecovery` is an IGNIS `ILogger`.
5. **Check debug logs.** The IGNIS console logger writes `debug` lines only when `DEBUG` is truthy and `NODE_ENV` allows it. See [debug logs in production and development](./2026-11-01-class-namespaces#before-you-update-debug-logs-in-production-and-development).
6. **If a test calls `assertArdorApplicationBoots`:** it needs `@venizia/ignis-inversion` `0.4.6-1` or newer, and an older copy fails with a new message. Step 1 already covers it.
7. **If your Vite config uses `buildInfoFile`:** it no longer installs a quiet logger. With `DEBUG` set, the IGNIS git lines print. Nothing else changes.
8. **If you subclass `DefaultI18nProvider`:** read a locale through `this.localeSources.readNow({ locale })`, not `i18nProviderOptions.i18nSources[locale]`, which can now be a loader. `Features.hasPendingMessages` and `Features.loadMessages` also wait for lazy application sources.
9. **If your app was made from the preset:** copy two changes by hand. In `src/configurations/admin.configuration.ts`, replace `getRuntimeConfig({ ... })` with `RuntimeConfig.get({ ... })` and import `RuntimeConfig`. In `src/application.test.ts`, write `const result = await restUrlOf(); expect(result)` instead of `expect(await restUrlOf())`, if you use the async-style lint rules below.
10. **If your app keeps keys under `@app/oauth2/`:** sign-out no longer removes them, and `LocalStorageKeys.PREFIX_OAUTH2` is gone. Clear those keys yourself when the user signs out. See [Sign-out and `@app/oauth2/`](./2026-11-02-sign-out-oauth2-prefix).
11. **Optional: the async-style lint rules.** `@venizia/dev-configs` `0.4.7` has `asyncStyleConfigs` (`no-inline-await`, `no-return-await`, `no-await-promise-chain`, `no-silent-catch`) and `reactAsyncStyleConfigs` (`no-async-hook-callback`, `effect-cleanup-consistency`). They are off until you spread them next to `houseConfigs` or `reactHouseConfigs` in your ESLint config. The preset does not turn them on, and ARDOR's behavior does not depend on them.
12. **Optional: lazy i18n sources.** Turn a catalogue the first screen does not need into `() => import('./vi')`. See [Lazy i18n sources](./2026-11-01-lazy-i18n-sources).
13. **Optional: session hooks.** If you override `checkAuth`, `logout` or `saveSession` only to keep a socket or a cache in step with the session, move that code into `onSessionStarted({ token, user })` and `onSessionCleared({ reason })` of your `DefaultAuthProvider` subclass, and delete the overrides. Each hook fires once per change of the session, is awaited, and cannot break sign-in or sign-out when it throws. Do not call `this.logout()` or `this.refreshToken()` from a hook: the call waits behind the hook until the 10 second `sessionHookTimeout`. See [Session hooks](./2026-11-03-session-lifecycle-hooks).
14. **Optional: browser storage and element size.** Replace your own `localStorage` helper with `BrowserStorage` (`get`, `set`, `remove` and `subscribe`; a failing storage gives the fallback, never an exception) and your own hook with `useStoredState({ key, defaultValue })`. Keys are used as you give them, so your existing keys keep working. Name new ones `@app/store/<name>`, and never write under `@app/auth/`: `BrowserStorage` refuses it. Replace a `ResizeObserver` hook you wrote with `useElementSize({ ref })`, and pass a stable `ref` from `useRef`. See [Typed browser storage and useElementSize](./2026-11-03-browser-storage-and-element-size).
15. **Optional: a guest app.** If your app has no login page, override `unauthenticatedRejection` in your `DefaultAuthProvider` subclass: return `{ redirectTo: false, message: false }` for the reason `rejected` and `{ logoutUser: false, message: false }` for `unauthorized`. `{ message: false }` alone still redirects to `/login`. A 401 with `logoutUser: false` keeps the stored session. The session hooks now also fire for a token your network service refreshes and for a `cleanUp` made outside the provider (reason `external`). See [Token hook and guest rejection](./2026-11-03-token-hook-and-guest-rejection).

