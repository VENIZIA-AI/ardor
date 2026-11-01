---
type: Playbook
title: Debugging
description: How to trace ARDOR issues using scoped loggers, the @api() decorator's error logs, request headers, auth recovery, and running a single test.
resource: packages/kernel/src/base/decorators/api.ts
tags: [debugging, logging, testing, playbook]
---

# Debugging

ARDOR gives you a small set of tools for tracing problems: a per-scope logger (IGNIS's), an automatic error log on every API method, header inspection for request tracing, and `bun test -t` for isolating a failing test. This page walks through using them together.

## Logger per scope

A service or provider reads `this.logger` (`BaseService` and `BaseProvider` are IGNIS's `BaseHelper`, `@venizia/ignis-helpers/core`): an `ILogger` built from the `scope` the class passed to `super({ scope })`. The scope is almost always the class name, so every log line is prefixed with `[scope]` and you can tell at a glance which class emitted it. Outside a class, `LoggerFactory.getLogger([scope])` (also from `@venizia/ignis-helpers/core`) is the same logger: one per scope, shared by everything that logs under that scope, so a `spyOn` on it is taken off after the test.

`debug` is off by default and there is no `enableDebug`: IGNIS's console logger (`ConsoleLogger`, the default provider) writes `debug` only when `DEBUG` is truthy and `NODE_ENV` is unset or a common name, and never in a browser without a `process` global, so a production browser needs nothing installed. `LoggerFactory.use({ level })` from `@venizia/ignis-helpers/core` overrides the gate either way, with a `LogLevels` value: `LogLevels.DEBUG` turns debug on, `LogLevels.INFO` turns it off whatever `DEBUG` says; a level that is not a `LogLevels` value is ignored. `LoggerFactory.use({ provider })` sends every logger elsewhere, even one built earlier, and `LoggerFactory.reset()` goes back to the console (for a test). `this.logger`, the hook loggers, `AuthTokenStore` and the `ArdorApplication` default are all `LoggerFactory` loggers, so one call decides for all of them; the `logger` prop of `ArdorApplication` is the application's own. A test can replace one instance's logger with `service.logger = ...`. `react-hooks/rules-of-hooks` reads a PascalCase `.use(...)` call as a hook, so a `LoggerFactory.use` line needs that rule disabled (oxlint: `// oxlint-disable-next-line react-hooks/rules-of-hooks`). The wiki changelog entry `2026-11-01-class-namespaces` opens with the same recipe.

When debugging, grep for the scope name (the class) rather than the message text - that's the fastest way to find where a log came from.

## @api() decorator error logs

Any method wrapped with `@api()` (`packages/kernel/src/base/decorators/api.ts`) automatically logs on failure: `this.logger.error('[%s] resource: %s | error: %o', propertyKey, this.resource, error)`, then rethrows. This means every data-provider call failure produces a consistent log line naming the method and the resource, with no extra logging code needed at call sites. If you're chasing a failed request, search logs for `resource:` to find which service and method threw - see [Data provider pipeline](/architecture/data-provider-pipeline.md).

## Inspecting a request

When a data-provider call misbehaves, check the outgoing headers - especially `x-request-id`. See [Header protocol](/architecture/header-protocol.md) for what headers ARDOR sends and expects. The request id is the thread to follow across client logs and any server-side logs you have access to: log it locally, then correlate.

## Reading a 401 recovery

A 401 doesn't necessarily mean "broken" - ARDOR's auth layer may be running a recovery flow (refresh, re-login prompt, redirect) rather than failing outright. Before treating a 401 as a bug, read [Auth recovery](/architecture/auth-recovery.md) to understand the expected sequence, and check [No-auth paths](/architecture/no-auth-paths.md) if the failing route is one that shouldn't require auth at all. Logs from `@api()` will show the 401 as an error even when recovery is working as designed, so don't stop at the log line - trace what happens after it.

## useApplicationLogger

On the React side, `useApplicationLogger` (see [Hooks and context](/architecture/hooks-and-context.md)) gives components and hooks the application's `ILogger`: the `logger` prop of `ArdorApplication`, else a console logger named after the application. Use it inside hooks/components instead of `console.log` so output stays consistent with the rest of the app and can be filtered by scope the same way service-side logs are.

## Running one test

Don't run the whole suite while iterating on a fix. Use Bun's test filter:

```
bun test -t "name of the test or describe block"
```

This matches against test/describe names, so scope your `-t` string to the specific case you're chasing. See [Testing](/process/testing.md) and [Testing conventions](/conventions/testing-conventions.md) for how tests are organized, and [Build, run, test](/overview/build-run-test.md) for the full command set.

## Putting it together

A typical debugging pass: enable debug logging in the failing scope, reproduce the issue, grep logs for the class name and for `resource:` to find the failing `@api()` call, check the request's `x-request-id` and headers, confirm whether a 401 is a real failure or an in-progress recovery, then reduce to a single failing test with `bun test -t` before making a fix.
