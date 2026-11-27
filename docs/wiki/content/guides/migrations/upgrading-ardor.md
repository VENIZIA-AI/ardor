---
title: Upgrading ARDOR
description: Which changelog entry to read for the version you are on, and the codemods that move the removed names and add the sign-in toggle.
---

# Upgrading ARDOR

Every ARDOR release is listed in the [changelogs](../../changelogs/) with who is affected and what to do. A release that changes a few names comes with a batch overview: a table of every change since the last overview, and an ordered checklist. This page says which one to read for the version you are on, and how to run the codemods that do the mechanical part of an upgrade.

## Rules for every upgrade

- **Move the four packages together.** `@venizia/ardor`, `@venizia/ardor-kernel`, `@venizia/ardor-react` and `@venizia/ardor-admin` carry the same version. Do not mix versions.
- **Move every `@venizia/ignis-*` package to a version that satisfies the new peers.** The ranges are in each ARDOR `package.json`, and the overview of the release lists them.
- **Read the releases in order.** Start at the row of your version and go down the table.

## Which entry to read

| You are on | You move to | Read |
|------------|-------------|------|
| 0.4.0 or older | 0.4.1 | [ARDOR 0.4.0](../../changelogs/2026-10-24-ardor-0-4-0) and [ARDOR 0.4.1](../../changelogs/2026-10-25-ardor-0-4-1) |
| 0.4.1 or 0.4.2 | 0.4.3 | [Everything since 0.4.1](../../changelogs/2026-10-25-batch-overview) |
| 0.4.3 | 0.4.4 | [Everything since 0.4.3](../../changelogs/2026-10-26-batch-overview) |
| 0.4.4 | 0.4.5 | [Everything since 0.4.4](../../changelogs/2026-10-28-batch-overview) |
| 0.4.5 | 0.4.6 | No changelog entry: no change to the code of the packages (release tooling, devDependencies and the lib preset only) |
| 0.4.6 | 0.4.7 | [Everything since 0.4.6](../../changelogs/2026-11-02-batch-overview); run `ardor codemod namespace` below |
| 0.4.7 | 0.4.8 | [Everything since 0.4.7](../../changelogs/0.4.8) (in progress); run the 0.4.8 codemods below |

## The codemods

`ardor codemod <name>` rewrites your source files. `ardor codemod --list` prints the name of each codemod, one per line, and exits 0.

| Command | What it does | For |
|---------|--------------|-----|
| `ardor codemod namespace` | Moves the names that 0.4.7 removed to the class members that replace them, and renames the types 0.5.0 renamed | 0.4.6 to 0.4.7, and 0.5.0 |
| `ardor codemod auth-options` | Adds `use: true` to the auth provider options of an app with sign-in | 0.4.8 |
| `ardor codemod base-application-import` | Imports `BaseArdorApplication` from `@venizia/ardor-admin` | 0.4.8 |
| `ardor codemod default-providers` | Lists the default providers an app builds by hand; it only lists, you edit them | 0.4.8 |
| `ardor codemod no-auth` | Moves `noAuthPaths` and `noAuthPathRegex` into `noAuth: { paths, regex }` | 0.5.0 |

All five take the same flags and safety rules, listed under [Flags and exit codes](#flags-and-exit-codes), except `--hooks` (only `namespace`) and `--write` (not `default-providers`). Commit your work first, preview each one, write, and run your formatter:

```bash
bun run ardor codemod auth-options src
bun run ardor codemod auth-options src --write
bun run ardor codemod base-application-import src --write
bun run ardor codemod default-providers src
```

`bun run ardor` works in a package whose `package.json` depends on `@venizia/ardor`.

### auth-options

An app with sign-in must say so: the auth options need `use: true`. The codemod puts it first in the object literal that a `@provide` method returns for `CoreBindings.AUTH_PROVIDER_OPTIONS`, or that `bind({ key: CoreBindings.AUTH_PROVIDER_OPTIONS }).toValue(...)` receives. The key may be written as its string value, and `CoreBindings` or the decorator may be imported under another name.

```diff
   @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
   authProviderOptions() {
-    return { paths: { afterLogin: '/products' } };
+    return { use: true, paths: { afterLogin: '/products' } };
   }
```

- A literal that already has `use`, `true` or `false`, is left as it is.
- Options that are not a plain object literal (a variable, a call, only a spread) are listed as `left` with their line and not changed. Add `use: true` first where the options are built: `{ use: true, paths }` for a variable, `{ use: true, ...base }` for a spread, `{ use: true, ...makeOptions() }` for a call (or put it inside `makeOptions`). A test that binds options from a shared fixture changes the fixture.
- A type that no longer fits is listed as `left` too, and the `use: true` is still added: a return type, `as` or `satisfies` of `IAuthProviderOptions`, which has no `use` (type it as `TAuthProviderOptions`).
- Each change prints a `note` that sign-in is now on. An app with no sign-in binds `{ use: false }` or no options and needs nothing.

### base-application-import

`BaseArdorApplication` lives in `@venizia/ardor-admin`. The codemod moves the name in an import and in a re-export (`export { BaseArdorApplication } from ...`), and keeps `type` modifiers and aliases.

```diff
-import { BaseArdorApplication } from '@venizia/ardor-kernel';
+import { BaseArdorApplication } from '@venizia/ardor-admin';
```

- An import that names other members is split. The moved name joins an import of `@venizia/ardor-admin` the file already has, when it has the same `type` modifier; otherwise it gets a new line after the kernel import.
- An import from `@venizia/ardor` is correct already and is left.
- A namespace import of the kernel that reads `BaseArdorApplication` is listed as `left`. An `export *` from the kernel prints a `note`: it no longer re-exports the class.
- A package that needs only the kernel extends `AbstractArdorApplication` and imports nothing from the admin package.

### default-providers

0.4.8 binds `DefaultRestDataProvider`, `DefaultAuthProvider`, `DefaultI18nProvider` and `DefaultAuthService` itself, so a method that builds one by hand can go. This codemod never writes: it prints one line, `path:line  the pattern  what to do`, for each `@provide` or `@provide` method that returns `<expr>.instantiate(X).value(<expr>)` for a default provider class, or under one of the three default provider keys.

```text
src/configurations/shop.ts:12  authProvider(): instantiate(DefaultAuthProvider).value()  delete this method and the APPLICATION_INSTANCE it injects if nothing else uses it: ARDOR binds DefaultAuthProvider itself
src/configurations/shop.ts:20  restDataProvider(): instantiate(CountRestDataProvider).value()  replace this method by one line in bindContext(): .toProvider(CountRestDataProvider).setScope(BindingScopes.SINGLETON) on the key, and delete the APPLICATION_INSTANCE it injects if nothing else uses it
```

It also lists a bare `<expr>.instantiate(DefaultAuthService)` that a method returns. It says "delete this method" only for a default class under its own `DEFAULT_*` key: under another key, deleting the method would unbind that key, so it says to bind the class there with `.toProvider(X).setScope(BindingScopes.SINGLETON)` in `bindContext()`. For an auth provider of your own under `DEFAULT_AUTH_PROVIDER` it adds the step the migration needs: bind `CoreBindings.AUTH_PROVIDER_OPTIONS` as `{ use: true, ...paths }`, because with no options sign-in is off and `start()` fails.

What to write, by case:

- A default class under its own `DEFAULT_*` key (`DefaultRestDataProvider`, `DefaultAuthProvider`, `DefaultI18nProvider`, `DefaultAuthService`): delete the method, and the `APPLICATION_INSTANCE` it injects if nothing else uses it. 0.4.8 binds it.
- Your own subclass or another class (for example `CountRestDataProvider`), or a default class under another key: delete the method and bind the class in `bindContext()`, on the key the method was bound under. Keep `.setScope(BindingScopes.SINGLETON)`: a bare `bind()` is transient.

```diff
-  @provide({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
-  restDataProvider() {
-    return this.application.instantiate(CountRestDataProvider).value(this.application);
-  }
+  bindContext(): void {
+    this.bind({ key: CoreBindings.DEFAULT_REST_DATA_PROVIDER })
+      .toProvider(CountRestDataProvider)
+      .setScope(BindingScopes.SINGLETON);
+  }
```

The exit code is 0, or 1 with `--check` when it found a place. `--write` is a usage error (exit 2): you make the change by hand.

### no-auth

0.5.0 groups the two no-auth options. A data provider or network service that is given `noAuthPaths` or `noAuthPathRegex` at the top of its options, or a `noAuth` that is not `{ paths, regex }`, throws when it is built.

```diff
-    return { url: '/api', noAuthPaths: ['/auth/sign-in'], noAuthPathRegex: /^public\// };
+    return { url: '/api', noAuth: { paths: ['/auth/sign-in'], regex: /^public\// } };
```

```bash
bun run ardor codemod no-auth src
bun run ardor codemod no-auth src --write
```

- It rewrites an object literal that holds the options as plain values, in a file that imports from ARDOR.
- It lists as `left`, and does not change: a literal that has a spread or `noAuth`, that is spread or `Object.assign`ed into another object, that is typed `INoAuthOptions`, or that has a comment, a getter, a method or a computed name in what would move. It also lists every literal when the file makes a `noAuth` elsewhere (a literal, an assignment, a class field or a constructor parameter property), and a literal with one option when another literal of the file holds the other one. It lists reads such as `options.noAuthPaths`, destructurings, type and class members, and files that import nothing from ARDOR.
- It reads `.ts`, `.tsx`, `.mts` and `.cts` files only. Search JavaScript and JSON yourself.
- A rewritten literal prints a `note` unless a method returns it or it goes straight to `toValue`, `super` or a constructor. **Check each place that merges two options objects**, in any file: a spread keeps only the last `noAuth`, and the codemod cannot see a merge of objects from two files. Merge them yourself: `noAuth: { ...base.noAuth, ...extra.noAuth }`. Nothing throws for a half lost this way, and the request carries the token.
- The protected members of a `DefaultNetworkRequestService` subclass (`this.noAuthPaths`) keep their names.

### http-methods

0.5.0 removes `RequestMethods` and `TRequestMethod`. Use `HTTP.Methods` and `THttpMethod` from `@venizia/ignis-helpers/common`, and add that package to your dependencies if yours does not list it.

```diff
-    return { method: RequestMethods.PATCH };
+    return { method: HTTP.Methods.PATCH };
```

```bash
bun run ardor codemod http-methods src
bun run ardor codemod http-methods src --write
```

- It rewrites a `method` property outside `fetch` and `new Request`, and the type `TRequestMethod`. It rewrites `PATCH` only inside a `send`, `doRequest` or `request` call: elsewhere the value may reach your own `fetch`, which does not uppercase it.
- `HTTP.Methods` is lowercase, so it lists every other use and leaves the old import: a comparison, a `case`, a list, a computed key, a `fetch` or `new Request` call, any other `PATCH`, `isValid` and `values`, a re-export, and a file that already uses the name `HTTP` or `THttpMethod`.
- ARDOR hands an override of `request` or `doRequest` the uppercase method: compare `method.toLowerCase() === HTTP.Methods.PATCH`.

### namespace

`ardor codemod namespace` moves the names that 0.4.7 removed from `@venizia/ardor` to the class members that replace them, in your source files. It also rewrites `NullableType`, `NumberIdType` and `StringIdType` to the plain types, `ISendResponse` to `INetworkResponse`, `IAuthUser` to `IStoredAuthUser`, `IArtifactIndex` to `IArdorArtifactIndex` and `IApplication` to `IArdorApplicationProps`, moves the kernel `Logger` stack to `@venizia/ignis-helpers/core`, and lists, without changing them, the removed names that have no replacement (`isEditableTarget`, `TDataCount`, `ISyncFC`, `.offset` of a list filter, `App.DEFAULT_LOCALE`, `HeaderConstants` (use `HTTP.Headers`), the `enableDebug` prop, and the hooks `useSizer` and `useInjectableContainer`). It reads imports from the four ARDOR packages; with no path it reads the current directory, and a path may be one file. The list of old and new names is in [how to update your project](../../changelogs/2026-11-01-class-namespaces#how-to-upgrade). It reads syntax only, so a name that the file also declares itself, a re-export by name and a class name already taken are listed with their line and left for you.

```bash
bun run ardor codemod namespace src
bun run ardor codemod namespace src --write
```

`bun run ardor` is the way to run it: inside a package whose `package.json` depends on `@venizia/ardor`, the dependency links the `ardor` bin into that package, and `bun run` runs that bin. From the root of a monorepo the bin is not linked, so run the command inside the package. Do not run it with `bunx`, `bun x` or `npx`: with the bare name `ardor` they fetch an unrelated package of that name from npm when the bin is not installed, and run its code. `--no-install` only stops the fetch; it still runs a copy that an earlier fetch left in the runner cache (`~/.bun/install/cache/.bunx-*/`), so it is not a safe replacement. `bun run` also runs a program of the same name found on `PATH` when the package has no local bin, so check that `node_modules/.bin/ardor` exists. The `npx` cache (`~/.npm/_npx/*/node_modules/`) can hold a fetched copy too. If an unrelated package of that name ever ran on your machine, assume it ran: check the machine and rotate the tokens and keys it could read. `ardor codemod --list` prints the name of each codemod, one per line, and exits 0.

## Flags and exit codes

Every codemod needs `typescript` `>=5.0.0`, an optional peer of `@venizia/ardor`; without it the command exits with code 2. It reads `.ts`, `.tsx`, `.mts` and `.cts` files, not `.d.ts`, and syntax only. With no path it reads the current directory, and a path may be one file.

| Flag | What it does |
|------|--------------|
| none | Lists what would change and writes nothing. |
| `--write` | Writes the changed files, all or none. |
| `--allow-dirty` | With `--write`, also writes a file that has local changes. |
| `--check` | A dry run that exits 1 when anything would change or is left; for CI. It cannot go with `--write`. |
| `--hooks` | `namespace` only: also moves a hook imported from `@venizia/ardor` to the `Ardor` namespace. |
| `--help`, `-h` | Prints the usage and exits. |

- `--write` reads and rewrites every file in memory first, and nothing is written if one fails. Inside a git repository, a file with local changes (changed, staged or untracked) is refused, so git can undo the codemod. Outside one nothing can undo it, so the command refuses unless you add `--allow-dirty`.
- `--allow-dirty` also writes a file that another codemod just changed, and writes outside a git repository.
- `--hooks` (only `namespace` takes it) makes `useRepository()` become `Ardor.useRepository()`. A hook imported from `@venizia/ardor-react` or `@venizia/ardor-admin` is never touched.

The command prints one line per finding and a summary:

- `refused <path>`: the file has local changes. Commit or stash it, or add `--allow-dirty`.
- `failed <path>: <reason>`: the file could not be parsed or rewritten, or it is not valid UTF-8 and would change. Nothing is written until you fix or remove it.
- `left <path>:<line> <name>`: the codemod could not rewrite it. Change it by hand.
- `note <path>:<line> <name>`: a change made on purpose that is worth knowing. `--check` ignores it.

The exit code is 0 when the run is done, 1 when a file was refused or failed, when `--write` found no git repository to protect it, or when `--check` found work, and 2 for a path that does not exist, an unknown option, a pair of options that contradict each other (`--write` with `--check`, `--allow-dirty` without `--write`), or when `typescript` is not installed. `default-providers` has no `--write`, so `--write` is an exit 2 there, and a file with local changes is read, never refused.
