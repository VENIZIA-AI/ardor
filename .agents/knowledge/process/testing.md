---
type: Playbook
title: Testing
description: How to run, write and verify tests across ARDOR packages, including the stub-backend and positive-control patterns.
resource: packages/kernel/src/base/services/network-request.test.ts
tags: [testing, ci, bun, playbook]
---

ARDOR tests run on Bun's built-in test runner (`bun:test`), driven through Makefile targets so that local runs and CI runs execute the exact same command.

## Running tests

- One file: `bun test path/to/file.test.ts` from the relevant package directory.
- One package: `make test-kernel`, `make test-react`, `make test-admin` (also `make test-scripts` for the gate scripts themselves). See [Build, run, test](/overview/build-run-test.md) and [Makefile targets](/reference/makefile-targets.md).
- Everything: the `build-and-test` CI job chains build then all three package suites plus scripts, layer, surface and size checks.

The make targets own the test flags (`BUN_TEST_FLAGS`, defaulting to `--parallel`, which implies `--isolate`), so there is exactly one source of truth for how tests execute - never override flags ad hoc in a way that diverges from CI.

## Adding a test

Follow [Testing conventions](/conventions/testing-conventions.md) for naming and structure. Co-locate the `*.test.ts` file next to the code it exercises. Use `describe`/`test` blocks from `bun:test`, and prefer small option-object helpers (`createService`, `createApplicationInfo`, `createRestDataProviderOptions` style factories) over duplicating construction logic across test cases - this mirrors the [Options objects](/conventions/options-objects.md) convention used in production code.

## Positive control procedure

Before trusting a test that asserts a failure path or an error condition, temporarily break the code (or invert the assertion) and confirm the test actually fails. A test that always passes regardless of the implementation is worse than no test. This matters most for auth-recovery and no-auth-path tests, where a silently-vacuous assertion would hide a real security regression - see [Auth recovery](/architecture/auth-recovery.md) and [No-auth paths](/architecture/no-auth-paths.md).

## DOM setup

Kernel and react tests that touch browser-only state (localStorage, headers) run in Bun's environment without a real DOM, so state must be reset explicitly. Use `afterEach` to clear `localStorage` and reset any module-level recording arrays between tests, otherwise state leaks across test cases and produces order-dependent failures. This is especially relevant for services keyed off `LocalStorageKeys` in the [DI in the browser](/architecture/di-in-the-browser.md) and [Header protocol](/architecture/header-protocol.md) paths.

## Stub backend pattern

For anything that issues real HTTP requests - notably `DefaultNetworkRequestService` and the [data provider pipeline](/architecture/data-provider-pipeline.md) - spin up a real local server with `Bun.serve({ port: 0, fetch: ... })` in `beforeAll`, capture its `server.port` into a `serverBaseUrl`, and record every incoming request (method, pathname, search, headers, parsed JSON body) into an array the test assertions can inspect. A pluggable `serverHandler` variable lets individual tests override the response shape or status per request without restarting the server. Reset `serverHandler` to `null` and clear the recorded-requests array in `afterEach`. Stop the server with `await server.stop(true)` in `afterAll`. This avoids mocking `fetch` and instead exercises the real request/response cycle, which is what makes header propagation and auth-recovery retries trustworthy.

## What CI runs

CI (`process/testing.md` counterpart in `.github/workflows`) is manual-only (`workflow_dispatch`), by deliberate decision - see [Design decisions](/overview/design-decisions.md). It used to run on every pull request and every push, which meant a four-package release chain paid for four extra full runs; nothing enforces this workflow as a required status check, so running it on demand blocks nothing.

Two jobs:

- **Source gates**: `make catalog-check` (dependency catalog), `make okf-check` (knowledge bundle - currently `continue-on-error` until milestone M3 makes it blocking), `make purity-test` (browser purity probe).
- **Build, test and lint**: `make build-all`, then `make test-kernel`, `make test-react`, `make test-admin`, `make test-scripts`, `make layer-check`, `make surface-check`, `make size-check`, `make lint`, and a purity loop over `purity-inversion`, `purity-filter`, `purity-helpers`, `purity-kernel`, `purity-core-worker`, `purity-connectors` - one loop with no allowlist, so the CI gate and the release workflow's `make purity-<pkg>` always agree.

See [Build system](/process/build-system.md) for how these targets relate to the build pipeline, and [Debugging](/process/debugging.md) when a suite fails locally but not in CI or vice versa.
