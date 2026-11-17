---
title: THttpFetch type for the fetch of an HttpDataSource
description: '@venizia/ardor/repository now exports THttpFetch, the type of the new `fetch` setting of HttpDataSource.'
packages: ['@venizia/ardor', '@venizia/ardor-kernel']
---

# Changelog - 2026-11-13

## THttpFetch type for the fetch of an HttpDataSource

<Badge type="tip" text="Enhancement" />

**In one line.** `@venizia/ardor/repository` now exports the type `THttpFetch`, the type of the new `fetch` setting of `HttpDataSource`. Without the setting the data source sends with the platform `fetch`, as before.

```ts
import { type THttpFetch } from '@venizia/ardor/repository';

export const loggingFetch: THttpFetch = (url, init) => {
  return fetch(url, init);
};
```

## Who is affected

An app that wants to route data source requests through a test double, a proxy or an instrumented client. Other apps need no change.
