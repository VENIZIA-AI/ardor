---
type: Convention
title: Gotchas
description: The recurring traps in ARDOR development that waste time if you don't know about them up front.
resource: packages/react/src/hooks/use-injectable.ts
tags: [conventions, gotchas, pitfalls, testing, build, dependency-injection, errors]
---

# Gotchas

A running list of things that look fine, compile fine, and still burn an hour. Read this before you debug something that "should just work."

## B-05: dist, not src

Downstream consumers and tests exercise the built `dist` output, not `src`. If you edit a package's source and the change doesn't show up where you expect, you probably need a rebuild first. This is the same discipline the [build-run-test](/overview/build-run-test.md) flow enforces: the package pipeline builds before anything downstream can see the change.

## rebuild.sh cleans after type-check, not before

The rebuild script runs type-checking against the existing build artifacts, then cleans and rebuilds. If you expect a clean-first cycle, you'll misread stale errors as fresh ones, or fresh errors as stale. Know the order before you trust the output. See [build-system](/process/build-system.md).

## happy-dom replaces the networking globals

Registering happy-dom swaps in its own `fetch`, `Request`, `Response`, `Headers`, `FormData`, `Blob` and the other networking globals, and `Bun.serve` rejects a happy-dom `Response`. The react and admin test setup files snapshot Bun's native versions before `GlobalRegistrator.register()` and put them back right after, so tests get happy-dom's DOM with Bun's networking. Remove that restore and every stub-server test breaks. See [testing-conventions](/conventions/testing-conventions.md), the canonical home for the setup.

## FileList is undefined outside a real DOM

`FileList` is a browser constructor. It does not exist in plain Node and may not exist in every test shim. Code that references `FileList` for type checks or instanceof guards needs to run where a DOM is actually present, or needs a guard that tolerates its absence.

## `any`-widening in augmentations

When you derive the keys you merge into `IUseInjectableKeysOverrides` or `IUseTranslateKeysOverrides` from something real - for example `keyof ReturnType<Application['bindingList']>` - and that source type resolves to `any` (a broken import, a stale build, a class that failed to compile), `keyof` widens to `string | number | symbol`. The key union then accepts every string (and every number and symbol) and typo protection silently disappears; the code still compiles. Prove the augmentation works with a `// @ts-expect-error` above a call that uses an undeclared key - if the directive turns into an "unused" error, the augmentation has failed. See [module-augmentation](/architecture/module-augmentation.md).

## Augmenting the umbrella package merges too

`IUseInjectableKeysOverrides` is declared in `@venizia/ardor-react` and `IUseTranslateKeysOverrides` in `@venizia/ardor-admin`; the `@venizia/ardor` umbrella only re-exports them through `export *`. A `declare module '@venizia/ardor'` block still merges into the real interfaces, because TypeScript follows the umbrella's `export *` to the module that declares them - so an umbrella target is not why keys are rejected, and an existing umbrella block is not broken. Still prefer `@venizia/ardor-react` for `IUseInjectableKeysOverrides` and `@venizia/ardor-admin` for `IUseTranslateKeysOverrides` in a new block: it names the declaring package and does not depend on the umbrella being installed. See [module-augmentation](/architecture/module-augmentation.md).

## `ra.boolean.null` renders blank on purpose

A boolean field with a `null` value shows nothing rather than a "false"-looking placeholder or a dash. This is intentional so that "unknown" is never visually confused with "false." Don't "fix" this into showing a default value.

## `force-update` skips catalogued ranges

`force-update` rewrites only the `@venizia/*` ranges in a package's `dependencies` and `devDependencies` that the root catalog does not own - a `catalog:` or `workspace:` range, or a peer-only dependency, is skipped on purpose. Every release runs it before `bun install`, which would otherwise have resolved the old ranges; CI runs `refresh-catalog` first, while `scripts/release-local.ts` runs only `force-update`. The trap is expecting it to move a `catalog:` range: a per-package `make update-<package>` target, the root `force-update` script and a local release all leave the catalog where it was - only `refresh-catalog` (or `make update`) rewrites it. See [release-publish](/process/release-publish.md) and [build-system](/process/build-system.md).

## Size budgets are measured with peers external

When package size is checked against its budget, peer dependencies are treated as external and excluded from the measured bundle size. A size budget failure means the package's own code grew, not that a peer got heavier. See [build-system](/process/build-system.md).

## Purity externals are third-party packages only

`make purity` bundles every runtime entry in the `exports` maps of kernel, react, admin and ardor for the browser (ui-kit carries no purity claim) and keeps ARDOR's own code and every `@venizia/*` dependency in the measured graph. The per-sub-path `external` list in `scripts/purity/manifest.ts` may exempt only a third-party package - a peer, or a dependency such as `ra-i18n-polyglot` - whose own packaging the probe cannot judge; listing an `@venizia/*` package there throws when the manifest loads, because an external would hide the exact leak the gate exists to catch. When purity fails on ARDOR code, fix the import - do not reach for `external`. See [build-run-test](/overview/build-run-test.md) ("Repository gates") and [design-decisions](/overview/design-decisions.md) ("Purity and layer gates").

## Every constructor parameter the container fills needs `@inject`

The container reads only `@inject` metadata, never parameter types, so it cannot supply an undecorated constructor parameter - which is why a service cannot take a raw `opts` argument alongside injected ones. An undecorated parameter placed before a decorated one throws at resolution time with `Constructor parameter <index> has no @inject | Every parameter of a container-instantiated class must be decorated`. A trailing undecorated parameter is not caught at all: it silently arrives as `undefined`. See [di-in-the-browser](/architecture/di-in-the-browser.md) and [options-objects](/conventions/options-objects.md).

## An error `message.code` must be a literal

A catalog registers its codes through `TRegisterErrors<typeof CategoryErrors>`, which reads each definition's `message.code` type into `IErrorKeyRegistry`. A code built at runtime - concatenation, or a helper that returns `string` - types as `string`, and one `string` key widens the whole registry to `string`: `messageCode` and a free-form `message.code` lose their autocomplete of the real codes, with no error anywhere. A template over a non-literal value fares little better: inside `as const` it types as a pattern such as `` `${string}.b` ``, which accepts every string that matches it. Write every `message.code` as a literal in an `as const` catalog. See [error-handling](/conventions/error-handling.md).
