---
title: getRuntimeConfig can require a value
description: Passing required to getRuntimeConfig makes it return a string and throw, naming the key, when no value is set; without required nothing changes.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-25

## getRuntimeConfig can require a value

<Badge type="tip" text="New Feature" />

**In one line.** An app that cannot run without a configuration value passes `required: true` to `getRuntimeConfig` and gets a `string` back, or a clear error at start instead of an `undefined` that fails later.

## What changed

- **`required: true`.** The result type is `string`. When the runtime value (`window.__APP_CONFIG__`), the build-time value (`buildTimeEnv`) and `defaultValue` are all absent, the call throws an error that names the key and never prints a value: `[getRuntimeConfig] 'VITE_API_URL' is required and not set`.
- **Nothing else changes.** Without `required`, or with `required: false`, the result is still `string | undefined`. An empty string or a value that is not a string still counts as absent.
- **A default satisfies it.** With a `defaultValue` the call never throws.

```typescript
import { getRuntimeConfig } from '@venizia/ardor';

// string, not string | undefined; an app also passes buildTimeEnv: import.meta.env
const apiUrl = getRuntimeConfig({ key: 'VITE_API_URL', required: true });
```

## Who is affected

- **Every app on ARDOR 0.4.1 or older.** No action needed: a call without `required` behaves as before.
- **An app with its own "config or throw" helper.** Replace it with `required: true`; the call site keeps the `string` type.

## Details

- The check runs where `getRuntimeConfig` is called, in the browser. For a container that must not start at all, list the variable in `APP_REQUIRED_ENV` as well (see [A container stops when a required variable is missing](./2026-10-23-runtime-config-required-env)); the two cover different moments.
- A `required` that TypeScript knows only as `boolean` returns `string | undefined`, because it may be `false`.
- To tell this error from another in code, without reading the message, see [The required error of getRuntimeConfig has a code](./2026-10-25-runtime-config-required-code).
