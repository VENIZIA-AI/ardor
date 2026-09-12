---
type: Convention
title: Gotchas
description: The recurring traps in ARDOR development that waste time if you don't know about them up front.
resource: packages/react/src/augmentations.ts
tags: [conventions, gotchas, pitfalls, testing, build]
---

# Gotchas

A running list of things that look fine, compile fine, and still burn an hour. Read this before you debug something that "should just work."

## B-05: dist, not src

Downstream consumers and tests exercise the built `dist` output, not `src`. If you edit a package's source and the change doesn't show up where you expect, you probably need a rebuild first. This is the same discipline the [build-run-test](/overview/build-run-test.md) flow enforces: the package pipeline builds before anything downstream can see the change.

## rebuild.sh cleans after type-check, not before

The rebuild script runs type-checking against the existing build artifacts, then cleans and rebuilds. If you expect a clean-first cycle, you'll misread stale errors as fresh ones, or fresh errors as stale. Know the order before you trust the output. See [build-system](/process/build-system.md).

## happy-dom replaces fetch and Response

The test environment swaps in happy-dom's own `fetch` and `Response`, not Node's. Code and tests that assume Node's native fetch semantics (headers ordering, error shapes) can behave differently under test than in a real browser or Node runtime. When a data-layer test fails in a way that looks impossible, check whether it's a happy-dom quirk before blaming your logic. See [testing-conventions](/conventions/testing-conventions.md).

## FileList is undefined outside a real DOM

`FileList` is a browser constructor. It does not exist in plain Node and may not exist in every test shim. Code that references `FileList` for type checks or instanceof guards needs to run where a DOM is actually present, or needs a guard that tolerates its absence.

## `any`-widening in augmentations

When you merge keys into `IUseInjectableKeysOverrides` or `IUseTranslateKeysOverrides`, using a loose value type (or `any`) on the override property doesn't break anything today, but it signals sloppy intent and can hide a wrong key shape. The values are ignored by the type machinery - only `keyof` is used - so type every value as `true` and keep the interface honest. See [module-augmentation](/architecture/module-augmentation.md).

## Augmenting the umbrella package does nothing

`IUseInjectableKeysOverrides` and `IUseTranslateKeysOverrides` are declared in `@venizia/ardor-react` and `@venizia/ardor-admin` respectively, not in the `@venizia/ardor` umbrella. Declaring your augmentation against the umbrella package compiles without error but never merges into the real interface, because TypeScript module augmentation targets the module where the interface actually lives. Always augment the package in the "Declared in" column, never the re-export. See [module-augmentation](/architecture/module-augmentation.md).

## `ra.boolean.null` renders blank on purpose

A boolean field with a `null` value shows nothing rather than a "false"-looking placeholder or a dash. This is intentional so that "unknown" is never visually confused with "false." Don't "fix" this into showing a default value.

## `force-update` skips catalogued ranges

The force-update path in the release chain is meant for exceptional cases and does not respect the normal catalogued version ranges that the rest of the release process enforces. Using it casually can put a package version out of step with what the catalog says is compatible. Treat it as an escape hatch, not a shortcut. See [release-publish](/process/release-publish.md).

## Size budgets are measured with peers external

When package size is checked against its budget, peer dependencies are treated as external and excluded from the measured bundle size. A size budget failure means the package's own code grew, not that a peer got heavier. See [build-system](/process/build-system.md).

## Purity externals are peers only

The browser-purity check treats only peer dependencies as legitimate externals. Anything else pulled in as a runtime dependency is expected to be bundled or flagged, since kernel and react-level packages must stay free of non-browser-safe code. If a purity check fails, look at whether a new dependency was added as a regular dependency instead of a peer. See [di-in-the-browser](/architecture/di-in-the-browser.md).
