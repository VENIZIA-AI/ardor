---
title: The required error of getRuntimeConfig has a code
description: The error getRuntimeConfig throws for a missing required value carries a code and the key, so an app detects it without reading the message.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-10-25

## The required error of getRuntimeConfig has a code

<Badge type="tip" text="Enhancement" />

**In one line.** An app that catches the error of `getRuntimeConfig({ key, required: true })` can now tell it by a code and read the key from it, instead of matching the message text.

## What changed

- **A code.** The error is an `ApplicationError` from `@venizia/ignis-inversion` and its `normalized.code` is `RUNTIME_CONFIG_REQUIRED_CODE`, exported from `@venizia/ardor` and `@venizia/ardor-kernel` (the value is `ardor.runtime_config.required`).
- **The key.** `extra.key` holds the name of the missing key. It never holds a value.
- **The message is unchanged:** `[getRuntimeConfig] 'VITE_API_URL' is required and not set | ...`.

```typescript
import { getRuntimeConfig, RUNTIME_CONFIG_REQUIRED_CODE } from '@venizia/ardor';
import { isApplicationError } from '@venizia/ignis-inversion';

try {
  getRuntimeConfig({ key: 'VITE_API_URL', required: true });
} catch (error) {
  if (isApplicationError(error) && error.normalized.code === RUNTIME_CONFIG_REQUIRED_CODE) {
    console.error('missing config key', error.extra?.key);
  }
}
```

## Who is affected

- **An app that catches the error by matching its message.** No action is needed, it keeps working. To stop depending on the text, compare the code as in the example above.
- **Every other app.** No action needed.

## Details

- The error comes from `getError` of `@venizia/ignis-inversion`, which ARDOR already depended on; the change adds no class and no dependency. The kernel bundle grows by about 50 bytes.
- It follows [getRuntimeConfig can require a value](./2026-10-25-runtime-config-required).
