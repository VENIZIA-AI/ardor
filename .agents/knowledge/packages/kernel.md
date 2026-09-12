---
type: Package
title: kernel
description: The isomorphic core of ARDOR - application base, services, providers, constants, network and utility helpers with no React or Node dependency.
resource: packages/kernel/src/index.ts
tags: [kernel, package, isomorphic, ignis, core]
---

## Role

`@venizia/ardor-kernel` is the bottom layer of ARDOR. It contains everything that does not need React, react-admin, or a Node runtime: the application base built on IGNIS inversion, service and provider base classes, constants, binding keys, a logger, network fetchers, a socket client, and general-purpose utilities. See [What is ARDOR](/overview/what-is-ardor.md) for where this sits in the whole framework.

The defining rule is the purity gate: kernel code must run in a browser or in a plain TypeScript process without any Node builtins (no `fs`, `path`, `http`, etc.) and without importing `react` or `ra-core`. This is what lets the same kernel be used by the browser data client, by [react](/packages/react.md), and by anything embedding ARDOR outside a UI. Consumers usually never install the kernel directly - most applications depend on [`@venizia/ardor`](/packages/ardor.md), which re-exports it, or on [`@venizia/ardor-react`](/packages/react.md) which builds on it.

## What it exports

The package root (`src/index.ts`) re-exports four areas, each with its own barrel:

- **base** (`src/base/index.ts`) - `applications`, `decorators`, `providers`, `services`. This is where `AbstractArdorApplication` and `BaseArdorApplication` live: the IGNIS inversion `Container` wrapper with `injectable()` and `service()` helpers that back [Application lifecycle](/architecture/application-lifecycle.md) and [DI in the browser](/architecture/di-in-the-browser.md). It also holds `BaseService`, `BaseApiService`, `DefaultAuthService`, `DefaultNetworkRequestService`, `BaseProvider`, and the `api()` decorator that logs and rethrows a failing API method.
- **common** (`src/common/index.ts`) - `constants`, `keys`, `types`. Binding keys (`CoreBindings`, `LocalStorageKeys`, see [Binding key namespaces](/conventions/binding-key-namespaces.md)), request/environment constants (`RequestMethods`, `RequestTypes`, `RequestBodyTypes`, `HeaderConsts`, `Environments`, `App`), and shared types (`IdType`, `AnyType`, `AnyObject`, `ValueOrPromise`, `ISendParams`, `IRestDataProviderOptions`, `IApplicationInfo`, `ICrudService`, and more).
- **helpers** (`src/helpers/index.ts`) - `Logger`, `BaseHelper`, `SocketIOClientHelper`, and the network layer: `AxiosNetworkRequest`, `NodeFetchNetworkRequest`, `AxiosFetcher`, `NodeFetcher`. These back the transport side of the [data provider pipeline](/architecture/data-provider-pipeline.md).
- **utilities** - a flat set of type guards and small helpers: `isDefined`, `isString`, `isNumber`, `isBrowser`, `isValidDate`, `isEditableTarget`, `int`, `float`, `toBoolean`, `toStringDecimal`, `getUID`, `keysToCamel`, `blobToBase64`, `stringify`, `parse`.

## Layering rule

Kernel sits below every other package in the [monorepo layout](/overview/monorepo-layout.md): [react](/packages/react.md), [admin](/packages/admin.md), [ui-kit](/packages/ui-kit.md), and [ardor](/packages/ardor.md) all depend on it, never the other way around. Anything that touches React hooks, context, or JSX belongs upstream in `react` or `admin`, not here - see [Hooks and context](/architecture/hooks-and-context.md) and [React hooks conventions](/conventions/react-hooks.md) for where that logic actually lives. If a change to kernel needs a Node builtin or a React import, it does not belong in kernel.

## Peer dependencies

Kernel declares `@venizia/ignis-filter`, `@venizia/ignis-inversion`, `reflect-metadata` as required peers, and `axios`, `socket.io-client` as optional peers (only needed if you use the Axios fetcher or the socket client helper). It has a single runtime dependency: `lodash`.

## Build, test, size

Scripts follow the standard package layout described in [Build/run/test](/overview/build-run-test.md) and [the build system](/process/build-system.md):

- `bun run build` - `sh ./scripts/build.sh`
- `bun run typecheck` - `tsc --noEmit -p tsconfig.test.json`
- `bun test` (with `NODE_ENV=test` and `.env.test`) - see [testing conventions](/conventions/testing-conventions.md) and [testing process](/process/testing.md)
- `bun run size` - runs `size-limit`

The package enforces a size budget via `size-limit`: `dist/index.js` (importing everything, with all peer/runtime deps ignored from the measurement) must stay under **7.7 KB**. This budget is a hard constraint on kernel growth - anything bulky belongs in a higher package, not in the isomorphic core.
