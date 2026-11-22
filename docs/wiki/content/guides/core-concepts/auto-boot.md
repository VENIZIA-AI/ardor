---
title: Auto boot
description: How an ARDOR app finds its decorated classes at build time, binds them at start, and what to do when a class is not found.
---

# Auto boot

Auto boot is how an app registers its decorated classes without a list kept by hand. A Vite plugin reads your `src/` at build time, builds the list of classes that carry a stereotype (`@service()`, `@repository()` and the rest), puts the list into the bundle and keeps each class name from being renamed. At `start()` the application binds every class it finds. You add a file with `@service()` on a class and the app has the service.

This page is for the person who sets up an app, adds a feature package, or reads a `[artifacts]` error. The container itself (bindings, scopes, `@inject`) is in [Dependency injection](./dependency-injection), and the order of `start()` is in [Application](./application).

## What it does for you

The plugin does three jobs, all at build time:

| Job | Why it matters |
|---|---|
| It scans `src/` and builds the index of decorated classes | The app registers every class with no list to maintain |
| It serves that index as the module `@venizia/ignis-boot/auto` and imports every class in it | A bundler drops a module that nothing imports; the index imports them all, so the decorators run |
| It pins the name of each scanned class | A binding key is built from the class name (`services.ClockService`), and a minifier renames classes |

At run time `start()` also checks the index: a class the index lists that was never decorated is an error, not a silent gap.

## Set it up

Four things, in this order.

**1. Install the build tool as a dev dependency.**

```bash
bun add -d @venizia/ignis-boot
```

**2. Add the plugin to `vite.config.ts`.**

<<< @/../../../examples/5-mins-qs/.configs/builders/vite.config.ts{ts}

`IgnisArtifactsVitePlugin.create()` has one option, `root`: the folder to scan. Without it the plugin scans the `src` that sits beside the `package.json` above Vite's root. The app preset passes `root: 'src'` because its Vite `root` is `src` too. The plugin pins class names and sets `optimizeDeps.exclude` for `@venizia/ignis-boot` by itself; there is nothing else to configure.

**3. Return `AutoArtifacts` from `artifacts()` in `src/application.ts`.**

<<< @/../../../examples/5-mins-qs/src/application.ts{ts}

**4. Build and run.**

```bash
bun run server:dev   # vite dev server: scans src/ when it starts
bun run compile      # vite build: the index is inlined into the bundle
```

Restart the dev server after you add a decorator to a class that had none: the scan runs when the server starts. A decorated file you add later under `src/` is picked up the same way, on the next start.

## What gets discovered

The scanner reads the source text of every `.ts` and `.tsx` file under the scan root and looks for a class with a stereotype decorator. It never runs your code.

| Decorator | Index field | Bound under |
|---|---|---|
| `@configuration()` | `configurations` | `configurations.<ClassName>` |
| `@datasource()` | `dataSources` | `datasources.<ClassName>` |
| `@component()` | `components` | `components.<ClassName>` |
| `@repository(...)` | `repositories` | `repositories.<ClassName>` |
| `@service()` | `services` | `services.<ClassName>` |

`@model()` is scanned but never listed. `@controller()` belongs to an IGNIS server and stays empty in a browser app. There is no `@provider()`: the providers of ARDOR are bound by key (`CoreBindings.DEFAULT_REST_DATA_PROVIDER` and the others) and by the app's `bindContext()`. A class reaches the `providers` namespace only through `binding: { namespace: BindingNamespaces.PROVIDER, key }` on its stereotype.

The scanner finds a decorator imported from `@venizia/ardor` as well as from the IGNIS packages: it follows re-exports.

What it skips:

| What | How you know |
|---|---|
| `.d.ts` files, `**/__tests__/**`, `**/*.test.ts(x)`, `**/*.spec.ts(x)`, `**/generated/**` | Silent: a test file with a decorated class registers nothing |
| An `abstract` class | A warning: `Skipped <Class> in <file> \| abstract` |
| A class that is not a named export (a default export, or a class with no `export`) | A warning: `Skipped <Class> in <file> \| not a named export` |

Three rules follow from that.

- **One class, one stereotype.** A class with two stereotypes stops the build: `[ArtifactScanner] <file> | class X carries 2 stereotypes (service, repository) - one class is one artifact`.
- **Export the class under its own name.** `export class ClockService {}` is right. `class ClockService {}` followed by `export { ClockService as Clock }` is found, then imported by its own name, and the build fails with `[MISSING_EXPORT] "ClockService" is not exported by ...`.
- **A decorated class needs a file the scan root reaches.** A class in another package is not scanned; see [Kits and features](#kits-and-features).

## What happens at start

`await application.start()` runs three steps in order (the whole order is in [Application](./application)):

1. `resolveArtifactIndexes()` evaluates `artifacts()`. A group that arrives with its content is kept as it is; a group with neither content nor a resolver is an error.
2. `preConfigure()` binds, from the least explicit to the most explicit, so a later bind on the same key replaces the earlier one: the defaults, then every discovered class (`registerArtifacts()`), then the features, then `bindingList()`, then `bindContext()`.
3. `postConfigure()` runs last.

`registerArtifacts()` binds the classes the decorators registered when their modules ran. The index does not choose what gets bound: it makes sure each class module was imported, and `start()` checks every class it lists was discovered.

**The key.** A class is bound under `binding: { namespace, key }` when its stereotype gives one, else under `<namespace>.<ClassName>` (the table above). `bindingList()` binds a class under the literal key you write. You rarely write a key for a class: resolve it by the class, and the container finds the key (`useService({ target: ClockService })`).

**Who wins on one key.** The steps run from the least explicit to the most explicit, and a later bind on the same key replaces the earlier one:

| Order | Step |
|---|---|
| 1 | The defaults (`BaseArdorApplication` binds its four providers) |
| 2 | The discovered classes and their `@provide` methods |
| 3 | The features |
| 4 | `bindingList()` |
| 5 | `bindContext()` |

**The scope.** A class is a singleton unless its stereotype says otherwise (`@service({ scope: BindingScopes.TRANSIENT })`). A class of a type you declared with `ArtifactTypes.define({ type, namespace, scope })` takes the scope of that definition when its own options give none.

**`when`.** A stereotype option `when` decides whether the class is bound: `@service({ when: ({ application }) => ... })`. It must return a boolean at once. A class whose `when` returns `false` is left out, with its `@provide` methods.

**Collisions.** Two different classes that end up on one key stop `start()`. A derived key collides when two classes share a name (a minifier can cause that); a pinned key collides when two classes claim the same `binding: { namespace, key }`. A class declared `allowOverride: false` is replaced by `bindContext()` only: `bindingList()` throws for it.

## Lazy and eager in the browser

The plugin replaces `@venizia/ignis-boot/auto` with a static import of the generated index: a browser bundle is tree-shaken only when the import is eager. So **every decorated class under the scan root is in the initial bundle**, wherever it is used. A class that only one lazy route needs still loads on the first screen.

Keep lazy code lazy by keeping it out of stereotyped classes: a page is a plain component and is imported by its route (`React.lazy`), a service holds the logic the page calls. A class that is first imported after `start()`, such as a module loaded by a lazy route, is never bound: import it before `start()`, or bind it by hand.

Import `AutoArtifacts` only where the application class is defined (`src/application.ts`).

## Kits and features

A shared package has its own classes. Two ways to bring them in. The scan reads workspace packages, those whose real path is outside `node_modules`: a package installed from a registry is not scanned, so its classes are registered by hand in `bindContext()`.

**A feature lists its classes.** `Features.define({ ... })` takes `artifacts`, the classes of the feature by value, in the same shape as the index (`services`, `repositories`, `dataSources`, `components`, `configurations`). Importing the feature imports and so discovers them, and `start()` checks every class it lists was discovered. The application mounts the feature in `features()`. This is the way to ship a feature as its own package; [Features](../../references/features) has the other fields.

```ts
import { BaseArdorApplication, Features, type IApplicationInfo, service } from '@venizia/ardor';

@service()
export class OrdersService {
  count(): number {
    return 0;
  }
}

export const OrdersFeature = Features.define({
  name: 'orders',
  artifacts: { services: [OrdersService] },
});

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'The shop' };
  }

  override features() {
    return [OrdersFeature];
  }

  bindContext(): void {}
}
```

**An artifact group.** `ArtifactGroup` is exported from `@venizia/ignis-kernel/metadata`. `ArtifactGroup.application()` is every decorated class of the package that calls it, and `ArtifactGroup.define({ folder: 'orders' })` is the decorated classes under a folder of that name in the package that defines it. The plugin writes the class lists into the call at build time (it needs the folder as a string literal and `ArtifactGroup` imported under its own name), and `artifacts()` takes the group beside `AutoArtifacts`:

```ts
import 'reflect-metadata';

import { ArtifactGroup } from '@venizia/ignis-kernel/metadata';

import { BaseArdorApplication, type IApplicationInfo, type IArtifactIndex } from '@venizia/ardor';

export const OrdersGroup = ArtifactGroup.define({ folder: 'orders' });

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'shop', version: '1.0.0', description: 'The shop' };
  }

  override artifacts(): Array<IArtifactIndex> {
    return [OrdersGroup];
  }

  bindContext(): void {}
}
```

Several groups compose in the same array: `[AutoArtifacts, OrdersGroup, BillingGroup]`. A group has no `when`; the `when` of a stereotype is the way to leave a class out. A class that is first imported after `start()` is not bound, in a group as anywhere else.

## The rules

- **Keep `src/application.ts` free of decorated classes.** The module that imports `AutoArtifacts` must not define a class with a stereotype, and no module that defines one may import it.
- **Why a cycle breaks the app.** The index imports your class modules while the module that imports the index is still being evaluated. If a class module imports that module back, the class list holds `undefined` when the index is built, and `start()` stops with `[artifacts] '<kind>' lists an entry that is not a class (position N)`. Put each decorated class in its own file, and have it import only what it uses.

## Registering by hand

You can register a class without the plugin, and without a stereotype on it (a decorated class is bound by discovery whether or not you list it): `this.service(X)`, `this.repository(X)`, `this.dataSource(X)` and `this.component(X)` in `bindContext()`, or a literal key in `bindingList()`. The class is resolved by class exactly as a discovered one is.

```ts
import { BaseArdorApplication, type IApplicationInfo } from '@venizia/ardor';

export class ClockService {
  now(): number {
    return Date.now();
  }
}

export class Application extends BaseArdorApplication {
  getAppInfo(): IApplicationInfo {
    return { name: 'clock', version: '1.0.0', description: 'A clock' };
  }

  bindContext(): void {
    this.service(ClockService);
  }
}
```

Prefer it for a very small app, for a test that should bind only what it needs, and for a class that must be bound under a condition the stereotype cannot say. The cost is a list you keep: a class you forget to register is a `No binding key is recorded on ClockService` error where a hook resolves it.

## Resolve what the app bound

Resolve a class by the class: the hook of its namespace takes `{ target }`, infers the type, and checks the namespace.

```tsx
import { service, useService } from '@venizia/ardor';

@service()
export class PriceService {
  total(opts: { quantity: number }): number {
    return opts.quantity * 3;
  }
}

export function Total() {
  const prices = useService({ target: PriceService });

  return <span>{prices.total({ quantity: 2 })}</span>;
}
```

`useRepository`, `useComponent`, `useConfiguration` and `useProvider` work the same way. A string key is for a binding that has no class (a value bound by hand, such as the options of a provider): see [Dependency injection](./dependency-injection).

## When it does not work

Every message below comes from the code; `<...>` stands for a value filled in at run time.

### `` [artifacts] A group has neither content nor resolve | Return AutoArtifacts from @venizia/ignis-boot/auto, or build with IgnisArtifactsPlugin so the group arrives with its content ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** `artifacts()` returned a group that carries no class lists, which happens when the plugin did not run on the file that defines it.
- **Fix:** Add `IgnisArtifactsVitePlugin.create()` to `plugins` in `vite.config.ts` (the Bun plugin named in the message is for a Bun build), return `AutoArtifacts` from `artifacts()`, and define the group in a file the build reaches with `ArtifactGroup.define({ folder: '<name>' })` or `ArtifactGroup.application()`.

### `` [artifacts] '<kind>' lists an entry that is not a class (position <n>) | Usually an import cycle: the module that imports the index (or @venizia/ignis-boot/auto) must not define decorated classes or be imported by them ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** A class list holds `undefined`: the module of a class was still being evaluated when the index was built.
- **Fix:** Move every decorated class out of `src/application.ts`, one class per file, and make sure no class module imports `application.ts`.

### `` [artifacts] '<kind>' lists <Class>, which was never discovered | Decorate it with its stereotype and regenerate the index ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** The index lists a class that has no stereotype, or whose decorator was lost.
- **Fix:** Add the decorator (`@service()`, `@repository(...)`, `@datasource()`, `@component()` or `@configuration()`). In `vite dev`, restart the server so the scan runs again.

### `` [ArtifactScanner] <file> | class <Class> carries <n> stereotypes (<list>) - one class is one artifact ``

- **Where:** `boot/src/generator/scanner.ts` in the IGNIS repository (`@venizia/ignis-boot` 0.4.8-14)
- **Why:** A class wears two stereotypes.
- **Fix:** Keep one. A class that is both a service and a repository is two classes.

### `` [MISSING_EXPORT] "<Class>" is not exported by "<file>" ``

- **Where:** the bundler (Rolldown), while it builds the generated index
- **Why:** The scanner found the class by its own name, but the file exports it under another name (`export { Clock as Alias }`).
- **Fix:** Export the class under its own name: `export class <Class> {}`.

### `` Skipped <Class> in <file> | abstract` and `Skipped <Class> in <file> | not a named export ``

- **Where:** `boot/src/generator/scanner.ts` in the IGNIS repository (`@venizia/ignis-boot` 0.4.8-14) (a warning, not an error)
- **Why:** The class is abstract, or it is a default export or has no `export`: the scanner leaves it out.
- **Fix:** Make it a concrete class with a named export, or leave it out on purpose.

### `` [IgnisArtifactsPlugin] <dir> has no src directory (<path>) | Auto artifacts scan the src beside the package.json of the entry module; pass IgnisArtifactsPlugin.create({ root }), or use ArtifactGroup.application() in the application's own source ``

- **Where:** `boot/src/bun/plugin.ts` in the IGNIS repository (`@venizia/ignis-boot` 0.4.8-14)
- **Why:** The scan root does not exist: there is no `src` beside the `package.json`, or `root` points at a folder that is not there.
- **Fix:** Pass the folder: `IgnisArtifactsVitePlugin.create({ root: 'src' })`.

### `` [IgnisArtifactsPlugin] An ArtifactGroup call at <file>:<line> cannot be rewritten | <reason> - write ArtifactGroup.define({ folder: '<name>' }) or ArtifactGroup.application() with the class imported under its own name ``

- **Where:** `boot/src/bun/plugin.ts` in the IGNIS repository (`@venizia/ignis-boot` 0.4.8-14)
- **Why:** The plugin could not read the call: `ArtifactGroup` is imported under another name, the argument is not an object literal, or `folder` is not a string literal.
- **Fix:** Write the call as the message says.

### `` [IgnisArtifactsPlugin] ArtifactGroup '<folder>' resolved to no class | <file> - check the folder name and that its classes carry a stereotype decorator ``

- **Where:** `boot/src/bun/plugin.ts` in the IGNIS repository (`@venizia/ignis-boot` 0.4.8-14)
- **Why:** No decorated class sits under a folder of that name in the package of the file.
- **Fix:** Fix the folder name, or add a stereotype to the classes.

### `` [@venizia/ignis-boot/auto] The application artifacts are resolved when artifacts are registered | A function that walks configs.artifacts must pass a group through untouched (check `isArtifactGroup`) instead of reading its kinds ``

- **Where:** `boot/src/bun/auto-group.ts` in the IGNIS repository (`@venizia/ignis-boot` 0.4.8-14)
- **Why:** Code read `.services` (or another kind) off a group such as `AutoArtifacts`.
- **Fix:** Do not read the kinds of what `artifacts()` returns; the application resolves them at start.

### `` [registerArtifacts] Two classes derive the binding key '<key>' from their class name, and the second would silently replace the first | A minified build renames classes - pin 'binding: { namespace, key }' or build with names kept (keepNames). A module evaluated twice by hot reload does the same - set 'bootChecks.allowDerivedKeyCollision' in that development setup ``

- **Where:** `ArtifactBindingKeys.describeCollision`, `kernel/src/base/metadata/artifact-keys.ts` in the IGNIS repository (`@venizia/ignis-kernel` 0.4.8-16), called from `registerArtifacts()` in `abstract.ts`
- **Why:** Two classes of one name in two files.
- **Fix:** Rename one, or pin the key: `@service({ binding: { namespace: 'services', key: 'billing' } })`.

### `` [registerArtifacts] The key '<key>' is claimed by both <A> and <B>, and the one imported last would silently replace the other | Give one of them another key, select one with 'when', or bind the intended one in bindContext() ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** Two different classes pin the same `binding: { namespace, key }`.
- **Fix:** Give one of them another key, or leave one out with `when`.

### `` [registerArtifacts] The 'when' of <Class> threw: <reason> | A 'when' must not throw: return false to leave the class out ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** A `when` threw.
- **Fix:** Return `false` to leave the class out; do not throw.

### `` [registerArtifacts] The 'when' of <Class> must return a boolean synchronously, it returned <a Promise|type> | Resolve the answer before decoration, or bind the class by hand in bindContext() ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** A `when` returned a promise or a value that is not a boolean.
- **Fix:** Return a boolean at once, or bind the class by hand in `bindContext()`.

### `` [bindingList] '<key>' is held by <Class> with allowOverride false, and bindingList() would replace it with <Other> | Bind it in bindContext() to override on purpose, or drop allowOverride: false ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** `bindingList()` names a key held by a class declared `allowOverride: false`.
- **Fix:** Override it in `bindContext()`, or drop `allowOverride: false`.

### `` [features] '<feature>' lists <Class>, which was never discovered | Decorate it with @configuration() and import its module before start() ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** A feature lists a configuration class that no decorator registered, usually because its module was never imported.
- **Fix:** Decorate it with `@configuration()` and import its module before `start()`.

### `` [features] '<feature>' lists <Class> in artifacts.<kind>, which was never discovered | Decorate it with its stereotype and import its module before start() ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** A feature lists a class in `artifacts` that carries no stereotype, or whose module was never imported.
- **Fix:** Decorate the class and import its module where the feature is defined.

### `` [features] '<feature>' lists an entry in artifacts.<kind> that is not a class (position <n>) | Usually an import cycle: the feature module must not be imported by the classes it lists ``

- **Where:** `packages/kernel/src/base/applications/abstract.ts`
- **Why:** The classes of the feature import the module that defines the feature, so the list holds `undefined` while it is built.
- **Fix:** Keep the feature definition in a file that no listed class imports.

### `` Binding key: <key> is not bounded in context! | A key derived from a class name (<namespace>.<ClassName>) changes when a minifier renames the class: resolve it by { target }, or pin it with binding: { namespace, key } on the class ``

- **Where:** `packages/react/src/hooks/resolve-injectable.ts`
- **Why:** A hook asked for a key that nothing bound: a typo, a class first imported after `start()`, or a class the scan did not reach.
- **Fix:** Resolve the class by `{ target }`, check the class has a stereotype and a named export, and import it before `start()`.

### `` [<hook>] No binding key is recorded on <Class> | Register it by stereotype (@service() and the rest) or by hand (service(), repository(), dataSource(), component(), bindingList()), or resolve it by { key } ``

- **Where:** `packages/react/src/hooks/resolve-injectable.ts`
- **Why:** The class has no stereotype and was not registered by hand.
- **Fix:** Add the stereotype or register it in `bindContext()`.
