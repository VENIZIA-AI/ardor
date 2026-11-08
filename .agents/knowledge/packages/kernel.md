---
type: Package
title: kernel
description: The isomorphic core of ARDOR - application base, services, providers, constants, network and utility helpers with no React or Node dependency.
resource: packages/kernel/src/index.ts
tags: [kernel, package, isomorphic, ignis, core]
---

## Role

`@venizia/ardor-kernel` is the bottom layer of ARDOR. It contains everything that does not need React, react-admin, or a Node runtime: the application base built on IGNIS inversion, service and provider base classes, constants, binding keys, the network request service, runtime configuration (`RuntimeConfig.get`), the HTTP repository re-exported from IGNIS on `@venizia/ardor-kernel/repository`, and general-purpose utilities. See [What is ARDOR](/overview/what-is-ardor.md) for where this sits in the whole framework.

The defining rule is the purity gate: kernel code must run in a browser or in a plain TypeScript process without any Node builtins (no `fs`, `path`, `http`, etc.) and without importing `react` or `ra-core`. This is what lets the same kernel be used by the browser data client, by [react](/packages/react.md), and by anything embedding ARDOR outside a UI. Consumers usually never install the kernel directly - most applications depend on [`@venizia/ardor`](/packages/ardor.md), which re-exports it, or on [`@venizia/ardor-react`](/packages/react.md) which builds on it.

## What it exports

The package root (`src/index.ts`) re-exports four areas - base, common, helpers, utilities - each with its own barrel:

- **base** (`src/base/index.ts`) - `applications`, `decorators`, `metadata`, `providers`, `services`. This is where `AbstractArdorApplication` and `BaseArdorApplication` live: the IGNIS inversion `Container` wrapper with `registerArtifacts()` (binds every stereotype-marked class), `service()`/`repository()`/`dataSource()`/`component()` (registration by hand, recording the key on the class), `bindingList()` (literal key-to-class map) and `injectable()`, which back [Application lifecycle](/architecture/application-lifecycle.md) and [DI in the browser](/architecture/di-in-the-browser.md). It also holds `BaseService`, `DefaultAuthService`, `DefaultNetworkRequestService`, `BaseProvider`, and the `api()` decorator that logs and rethrows a failing API method.
  - **metadata** (`src/base/metadata/index.ts`) - the stereotypes, re-exported name by name from
    `@venizia/ignis-kernel/metadata`: `service`, `component`, `configuration`, `injectable`, `provide`,
    `model`, `datasource`, `repository`, `inject`, plus `BindingNamespaces`, `ArtifactNamespaces`,
    `ArtifactTypes`, `BindingKeys` and the types `IArtifactMetadata`, `IArtifactRegistrationOptions`,
    `TBindingNamespace`, `TBindingScope`. ARDOR defines none of its own - one mechanism for the whole
    family. `CoreBindings` is deliberately not among them; see
    [binding key namespaces](/conventions/binding-key-namespaces.md). `MetadataRegistry` is not
    re-exported either - the application base imports it straight from `@venizia/ignis-kernel/metadata`.
- **common** (`src/common/index.ts`) - `constants`, `keys`, `types`. Binding keys (`CoreBindings`, `LocalStorageKeys`, see [Binding key namespaces](/conventions/binding-key-namespaces.md)), request/environment constants (`RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `HeaderConstants`, `Environments`, `App`), and shared types (`IdType`, `AnyType`, `AnyObject`, `ValueOrPromise`, `ISendParams`, `IRestDataProviderOptions`, `IApplicationInfo`, and more).
- **helpers** (`src/helpers/index.ts`) - the request headers (`NetworkHeaders`), the auth token store, the body encoder, the response reader and the auth recovery. The transport itself is IGNIS's `NodeFetchNetworkRequest` (`@venizia/ignis-helpers/core`): the platform `fetch`, the only transport. These back the transport side of the [data provider pipeline](/architecture/data-provider-pipeline.md).
- **utilities** - static classes: `ValueUtility`, `BrowserUtility`, `BrowserStorage` with `StorageCodecs`, `BrowserClipboard`, `RuntimeConfig` and `FileUtility`. The earlier bare names, `isEditableTarget` and the unused `NumberIdType`, `StringIdType`, `NullableType`, `TDataCount`, `App.DEFAULT_LOCALE` and two `HeaderConstants` were removed after 0.4.6 (`ardor codemod namespace` moves the code, see [the ardor package](/packages/ardor.md)), and so were the number and string parsers and `parseQueryString` (nothing used them; IGNIS has the helpers a project needs). `ValueUtility.isDefined(value)` and `isString(value)` stay positional so narrowing works; `isNumber`, `isObject` and `isValidDate` take `{ value }`. `DefaultAuthService.subscribe({ listener })` runs after every `saveAuth` and `cleanUp`. What the storage, clipboard and runtime-config helpers promise (they never throw, `BrowserStorage` refuses a write under `LocalStorageKeys.PREFIX_AUTH`, `@app/store/` is removed at sign-out and `@app/prefs/` outlives it, `StorageCodecs.text`, and the required runtime key with its `RUNTIME_CONFIG_REQUIRED_CODE`) is in `docs/wiki/content/references/index.md` and the TSDoc of each class.

## Layering rule

Kernel sits below the other framework packages in the [monorepo layout](/overview/monorepo-layout.md): [react](/packages/react.md), [admin](/packages/admin.md), and [ardor](/packages/ardor.md) depend on it, never the other way around. Anything that touches React hooks, context, or JSX belongs upstream in `react` or `admin`, not here - see [Hooks and context](/architecture/hooks-and-context.md) and [React hooks conventions](/conventions/react-hooks.md) for where that logic actually lives. If a change to kernel needs a Node builtin or a React import, it does not belong in kernel.

## Peer dependencies

Kernel declares `@venizia/ignis-filter`, `@venizia/ignis-inversion`, `@venizia/ignis-kernel`, `reflect-metadata` as required peers (and `@venizia/ignis-helpers`, which holds the transport). `@venizia/ignis-connectors` is an optional peer, needed only for the `./repository` sub-path, which re-exports `@venizia/ignis-connectors/http`. It has no runtime dependency, and no socket client: that is IGNIS's.

## The testing entry

`@venizia/ardor-kernel/testing` (`src/testing.ts`, outside the root barrel) holds the fakes of the browser APIs that ARDOR's hooks and helpers read: `FakeResizeObserver`, `FakeIntersectionObserver`, `FakeMatchMedia`, `FakeStorage` and `FakeClipboard`. `@venizia/ardor/testing` re-exports them, and the React and admin tests import them from the kernel (react depends on the kernel, so there is no cycle). How each is installed and driven is in `docs/wiki/content/references/testing.md`. The entry uses only globals, so the purity gate claims it like the root; its size budget is its entry of the `size-limit` block of `packages/kernel/package.json`.

## Build, test, size

Scripts follow the standard package layout described in [Build/run/test](/overview/build-run-test.md) and [the build system](/process/build-system.md):

- `make kernel` - typecheck, clean, then `tsc -p .configs/builders/tsconfig.build.json` and `tsc-alias`
- `make -C packages/kernel typecheck` - `tsconfig.json` (src and tests), then the build program
- `make test-kernel` (`bun test` with `NODE_ENV=test` and the `src/__tests__/setup.ts` preload) - see [testing conventions](/conventions/testing-conventions.md) and [testing process](/process/testing.md)
- `make -C packages/kernel size` - runs `size-limit`

The package enforces a size budget via `size-limit`: `dist/index.js` (importing everything, with all peer/runtime deps ignored from the measurement) must stay under the limit in the `size-limit` block of `packages/kernel/package.json`, which is the one place the number is written. This budget is a hard constraint on kernel growth - anything bulky belongs in a higher package, not in the isomorphic core. The limit is the measured size plus 2%, rounded up to the next 10 B (see [Gotchas](/conventions/gotchas.md)). It is a ceiling, not a target.
