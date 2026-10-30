---
title: PATCH in upper case, log levels, no pagination, no NaN count
description: "Four fixes: upper-case fetcher methods, one console method per log level, getManyReference without pagination, no NaN count."
packages: ['@venizia/ardor-admin', '@venizia/ardor-kernel']
---

# Changelog - 2026-10-17

## PATCH in upper case, log levels, no pagination, no NaN count

<Badge type="info" text="Bug Fix" />

**In one line.** Four defects are fixed. None of them changes a public signature.

```typescript
import { Logger } from '@venizia/ardor';

const logger = Logger.getInstance({ scope: 'OrderService' });
const orderId = 'ORD-1';
logger.error('[create] Failed | id: %s', orderId); // now console.error, not console.info
```

## What changed

- **The fetcher verb shortcuts send upper-case methods.** `get`, `post`, `put`, `patch` and `delete` on a fetcher pass the `RequestMethods` values. The Fetch standard upper-cases every method except `PATCH`, so `fetcher.patch()` used to send a lowercase `patch` from a browser, and a strict router answers that with 405. `doRequest` was never affected.
- **Each log level reaches its own console method.** `Logger` writes `debug`, `info`, `warn` and `error` through `console.debug`, `console.info`, `console.warn` and `console.error`. Before, every level went through `console.info`, so the browser's level filter and any error-reporting hook on `console.error` missed ARDOR's errors.
- **`getManyReference` accepts a missing `pagination`.** It treats it as `{}`, like `getList` already did, instead of throwing `Cannot destructure property 'page'`.
- **A missing count header gives `undefined`.** For a non-list request, `count` is the integer in `x-response-count`, or `undefined` when the header is absent or not a number. Before, it was `NaN`.

## Who is affected

- **An application that filters the console by level.** Debug lines now go to `console.debug`, which browsers hide under the default filter, so enable the Verbose level to see them. Errors now show under the Errors filter.
- **Everyone else.** No action needed.
