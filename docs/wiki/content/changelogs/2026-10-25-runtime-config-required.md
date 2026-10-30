---
title: getRuntimeConfig can require a value
description: Passing required to getRuntimeConfig makes it return a string and throw, naming the key, when no value is set; the error carries a code and the key.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-25

## getRuntimeConfig can require a value

<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" />

**In one line.** An app that cannot run without a configuration value passes `required: true` to `getRuntimeConfig` and gets a `string` back, or a clear error at start instead of an `undefined` that fails later. `required: true` is in 0.4.2; the error code is in 0.4.3.

## What changed

- **`required: true`.** The result type is `string`. When the runtime value (`window.__APP_CONFIG__`), the build-time value (`buildTimeEnv`) and `defaultValue` are all absent, the call throws an error that names the key and never prints a value: `[getRuntimeConfig] 'VITE_API_URL' is required and not set`.
- **Nothing else changes.** Without `required`, or with `required: false`, the result is still `string | undefined`. An empty string or a value that is not a string still counts as absent. A `defaultValue` satisfies `required`, so the call never throws.
- **The error has a code (0.4.3).** It is an `ApplicationError` from `@venizia/ignis-inversion`. Its `normalized.code` is `RUNTIME_CONFIG_REQUIRED_CODE` (value `ardor.runtime_config.required`), exported from `@venizia/ardor` and `@venizia/ardor-kernel`, and `extra.key` holds the name of the missing key. It never holds a value. The message is unchanged.

```typescript
import { getRuntimeConfig, RUNTIME_CONFIG_REQUIRED_CODE } from '@venizia/ardor';
import { isApplicationError } from '@venizia/ignis-inversion';

// string, not string | undefined; an app also passes buildTimeEnv: import.meta.env
const apiUrl = getRuntimeConfig({ key: 'VITE_API_URL', required: true });

// Detect the error by its code instead of its message.
try {
  getRuntimeConfig({ key: 'VITE_API_URL', required: true });
} catch (error) {
  if (isApplicationError(error) && error.normalized.code === RUNTIME_CONFIG_REQUIRED_CODE) {
    console.error('missing config key', error.extra?.key);
  }
}
```

## Who is affected

- **Every app on ARDOR 0.4.1 or older.** No action needed: a call without `required` behaves as before.
- **An app with its own "config or throw" helper.** Replace it with `required: true`; the call site keeps the `string` type.
- **An app that matches the error message.** It keeps working. To stop depending on the text, compare the code as above.

## Details

- The check runs where `getRuntimeConfig` is called, in the browser. For a container that must not start at all, list the variable in `APP_REQUIRED_ENV` as well (see [Runtime config in the app preset](./2026-10-22-preset-runtime-config)); the two cover different moments.
- A `required` that TypeScript knows only as `boolean` returns `string | undefined`, because it may be `false`.
