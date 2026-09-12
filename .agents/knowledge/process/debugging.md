---
type: Playbook
title: Debugging
description: How to trace ARDOR issues using scoped loggers, the @api() decorator's error logs, request headers, auth recovery, and running a single test.
resource: packages/kernel/src/helpers/logger.ts
tags: [debugging, logging, testing, playbook]
---

# Debugging

ARDOR gives you a small set of tools for tracing problems: a per-scope logger, an automatic error log on every API method, header inspection for request tracing, and `bun test -t` for isolating a failing test. This page walks through using them together.

## Logger per scope

`Logger.getInstance({ scope, enableDebug })` (`packages/kernel/src/helpers/logger.ts`) returns one logger instance per scope string, cached in a static map. The scope is almost always the class name, so every log line is prefixed with `[scope]` and you can tell at a glance which class emitted it.

`enableDebug` is process-wide, not per-instance. Passing `enableDebug: true` from any single call flips a static `debugEnabled` flag that every logger checks - so turning on debug logging anywhere turns it on everywhere. `debug()` calls are silently dropped unless that flag is set; `info`, `warn`, `error` always print. There's also `toggleDebug({ state })` on an instance to flip it programmatically.

Each log line is timestamped (`getTimestamp()`) and formatted through `generateLog`. If the message is a string it's inlined into the prefix (`printf`-style with `...args`); if it's an object, the object is passed through as the first arg so `console`'s object inspector renders it.

When debugging, grep for the scope name (the class) rather than the message text - that's the fastest way to find where a log came from.

## @api() decorator error logs

Any method wrapped with `@api()` (`packages/kernel/src/base/decorators/api.ts`) automatically logs on failure: `this.logger.error('[%s] resource: %s | error: %o', propertyKey, this.resource, error)`, then rethrows. This means every data-provider call failure produces a consistent log line naming the method and the resource, with no extra logging code needed at call sites. If you're chasing a failed request, search logs for `resource:` to find which service and method threw - see [Data provider pipeline](/architecture/data-provider-pipeline.md).

## Inspecting a request

When a data-provider call misbehaves, check the outgoing headers - especially `x-request-id`. See [Header protocol](/architecture/header-protocol.md) for what headers ARDOR sends and expects. The request id is the thread to follow across client logs and any server-side logs you have access to: log it locally, then correlate.

## Reading a 401 recovery

A 401 doesn't necessarily mean "broken" - ARDOR's auth layer may be running a recovery flow (refresh, re-login prompt, redirect) rather than failing outright. Before treating a 401 as a bug, read [Auth recovery](/architecture/auth-recovery.md) to understand the expected sequence, and check [No-auth paths](/architecture/no-auth-paths.md) if the failing route is one that shouldn't require auth at all. Logs from `@api()` will show the 401 as an error even when recovery is working as designed, so don't stop at the log line - trace what happens after it.

## useApplicationLogger

On the React side, `useApplicationLogger` (see [Hooks and context](/architecture/hooks-and-context.md)) gives components and hooks access to a logger scoped the same way, without instantiating `Logger` directly. Use it inside hooks/components instead of `console.log` so output stays consistent with the rest of the app and can be filtered by scope the same way service-side logs are.

## Running one test

Don't run the whole suite while iterating on a fix. Use Bun's test filter:

```
bun test -t "name of the test or describe block"
```

This matches against test/describe names, so scope your `-t` string to the specific case you're chasing. See [Testing](/process/testing.md) and [Testing conventions](/conventions/testing-conventions.md) for how tests are organized, and [Build, run, test](/overview/build-run-test.md) for the full command set.

## Putting it together

A typical debugging pass: enable debug logging in the failing scope, reproduce the issue, grep logs for the class name and for `resource:` to find the failing `@api()` call, check the request's `x-request-id` and headers, confirm whether a 401 is a real failure or an in-progress recovery, then reduce to a single failing test with `bun test -t` before making a fix.
