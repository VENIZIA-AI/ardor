---
type: Playbook
title: Testing
description: How to run, write and verify tests across ARDOR packages, including the stub-backend and positive-control patterns.
resource: packages/kernel/src/__tests__/base/services/network-request.test.ts
tags: [testing, ci, bun, playbook]
---

ARDOR tests run on Bun's built-in test runner (`bun:test`), driven through Makefile targets so that local runs and CI runs execute the exact same command.

## Running tests

- One file: `bun test path/to/file.test.ts` from the relevant package directory.
- One package: `make test-kernel`, `make test-react`, `make test-admin` (also `make test-scripts` for the gate scripts themselves). `make gates` runs, locally and in the same order, what the Test job of the release workflow runs (links, one copy of each @venizia package, build, lint, test, scripts, purity, catalog, preset smoke); a test keeps the two lists equal. See [Build, run, test](/overview/build-run-test.md) and [Makefile targets](/reference/makefile-targets.md).
- Everything: the `build-and-test` CI job chains build then all three package suites plus scripts, layer, surface and size checks.

`BUN_TEST_FLAGS` is an optional pass-through with no default: `make test-<pkg>` runs the package's `bun test` command (`make/test.mk`) with no extra flags, which is the same command CI runs, so every test file of a package runs in one process against one global object. That matters for stereotypes: the discovery list is not per application (see "Registration by stereotype" in [DI in the browser](/architecture/di-in-the-browser.md)), and `MetadataRegistry.getInstance()` anchors it on `globalThis`, so a `@service()` class declared in one test file is bound into every application started afterwards in that run. Pass `BUN_TEST_FLAGS=--isolate` (or `--parallel`, which implies `--isolate`) when a test file needs a fresh registry - isolation gives each file a fresh global object, so tests inside one file still share it.

## Adding a test

Follow [Testing conventions](/conventions/testing-conventions.md) for naming and structure. Put the `*.test.ts` file under the package's `src/__tests__/`, mirroring the path of the module it exercises. Use `describe`/`test` blocks from `bun:test`, and prefer small option-object helpers (`createService`, `createApplicationInfo`, `createRestDataProviderOptions` style factories) over duplicating construction logic across test cases - this mirrors the [Options objects](/conventions/options-objects.md) convention used in production code.

## Proving an application boots

`assertArdorApplicationBoots` (`@venizia/ardor/testing`) is the one test an app needs for "does it start": an unregistered injection, a missing provider or a lazy locale that cannot load fails it, with no browser and no network. Its tests use a hand-written `BaseArdorApplication` fixture and bind services in `bindContext()`; they cover the incident shape (a service injecting a key nobody bound), a skip that matches nothing, an empty application, a second start of one instance, and `fetch` being replaced and restored on both paths.

## Positive control procedure

Before trusting a test that asserts a failure path or an error condition, temporarily break the code (or invert the assertion) and confirm the test actually fails. A test that always passes regardless of the implementation is worse than no test. This matters most for auth-recovery and no-auth-path tests, where a silently-vacuous assertion would hide a real security regression - see [Auth recovery](/architecture/auth-recovery.md) and [No-auth paths](/architecture/no-auth-paths.md).

## DOM setup

Kernel, react and admin each preload `src/__tests__/setup.ts` through `--preload` in the `make test-<pkg>` command; there is no `bunfig.toml` and no package `test` script, so run `make test-<pkg>`, never a bare `bun test`. Kernel tests run without a DOM, against a `localStorage` stub that setup file installs. React and admin tests run under happy-dom, with Bun's native networking (`fetch`, `Request`, `Response` and friends) restored after registration - see [Testing conventions](/conventions/testing-conventions.md). No setup file resets state between tests, so do it explicitly: use `afterEach` to clear `localStorage` and reset any module-level recording arrays between tests, otherwise state leaks across test cases and produces order-dependent failures. This is especially relevant for services keyed off `LocalStorageKeys` in the [DI in the browser](/architecture/di-in-the-browser.md) and [Header protocol](/architecture/header-protocol.md) paths.

## Stub backend pattern

For anything that issues real HTTP requests - notably `DefaultNetworkRequestService` and the [data provider pipeline](/architecture/data-provider-pipeline.md) - spin up a real local server with `Bun.serve({ port: 0, fetch: ... })` in `beforeAll`, capture its `server.port` into a `serverBaseUrl`, and record every incoming request (method, pathname, search, headers, parsed JSON body) into an array the test assertions can inspect. A pluggable `serverHandler` variable lets individual tests override the response shape or status per request without restarting the server. Reset `serverHandler` to `null` and clear the recorded-requests array in `afterEach`. Stop the server with `await server.stop(true)` in `afterAll`. This avoids mocking `fetch` and instead exercises the real request/response cycle, which is what makes header propagation and auth-recovery retries trustworthy.

## Scratch files

A script, a docs script (`docs/wiki/scripts/check-snippets.mts`) or a test that needs a folder makes it with `makeScratch` (`scripts/scratch.ts`), which creates it under the gitignored `.agents/local/tmp`, and never with `os.tmpdir()`; it removes what it made. One exception is sanctioned: the preset smoke keeps the profile of its headless Chrome in a short folder made with `mkdtempSync` under `XDG_RUNTIME_DIR` (else the system temp folder) and removes it in a `finally`. Chrome puts a unix socket in the profile and aborts with "Socket path too long" past 107 characters, which a checkout under a deep home folder exceeds. Existing `com.google.Chrome.*` folders in the system temp folder are not deleted.

## What CI runs

CI (`.github/workflows/ci.yml`) is manual-only (`workflow_dispatch`), by deliberate decision - the rationale lives in that workflow's header comment. It used to run on every pull request and every push, which meant a four-package release chain paid for four extra full runs; nothing enforces this workflow as a required status check, so running it on demand blocks nothing. Every workflow runs on `ubuntu-26.04`, named rather than `ubuntu-latest`, so the OS under the release workflow changes only with a commit; GitHub-hosted runners have no Debian image.

Two jobs:

- **Source gates** (no build): `make catalog-check` (dependency catalog), `make vulcan-sync vulcan-doctor` (the VULCAN layout - a fresh checkout has no adapters, so sync runs first), `make okf-check-strict` (knowledge bundle: OKF conformance plus links, style, coverage, freshness and changelog `packages:`), `make purity-test` (browser purity probe), `make test-scripts` (the gate scripts' own tests) and `make wiki-links-check`.
- **Build, test and lint**: `make build-all`, then `make test-kernel`, `make test-react`, `make test-admin`, `make test-ardor`, `make layer-check`, `make cycles-check`, `make surface-check`, `make size-check`, `make docs` and `make wiki-anchors-check` (dead `#fragment` links, read from the built html), `make atlas-smoke` (VULCAN's atlas serves this checkout over MCP; its symbol lookup reads the built types), `make lint-all`, `make purity` - one loop over the whole manifest, so this gate and a release read the same rows - and `make clean-install`. Every step after the build runs when the build succeeded, even if an earlier step failed (`!cancelled()`), so one run reports every red gate.

See [Build system](/process/build-system.md) for how these targets relate to the build pipeline, and [Debugging](/process/debugging.md) when a suite fails locally but not in CI or vice versa.
