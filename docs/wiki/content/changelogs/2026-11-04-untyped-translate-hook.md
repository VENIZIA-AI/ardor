---
title: useUntypedTranslate translates a key that exists only at run time
description: useUntypedTranslate takes a plain string key, so a server error code or a data label needs no cast, while useTranslate keeps its compile-time key check.
packages: ['@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useUntypedTranslate translates a key that exists only at run time

<Badge type="tip" text="New Feature" />

**In one line.** `useUntypedTranslate()` returns `translate(key: string, options?)`, for a key the compiler cannot know, such as `errors.${code}` or `status.${row.status}`. `useTranslate` is unchanged: it still accepts only the keys of the catalog and the keys you add by augmentation.

```tsx
import { useUntypedTranslate } from '@venizia/ardor';

export function ErrorLine(props: { code: string }) {
  const translate = useUntypedTranslate();

  return <p>{translate(`errors.${props.code}`, { _: 'Something went wrong' })}</p>;
}
```

## What changed

- **A second hook, next to the typed one.** Both read the same i18n provider, so they share the catalogs, the locale and the lazy sources. They are one implementation: `useTranslate` is `useUntypedTranslate` with the key narrowed to `TUseTranslateKeys`, so they cannot drift.
- **Same behavior for a missing key and a missing provider.** A key the catalogs do not hold comes back unchanged, or as the `_` text of the options. Without an i18n provider the hook returns the key unchanged.
- **Also in `Ardor`.** `Ardor.useUntypedTranslate` joins the namespace, so it holds 26 hooks, and `ardor codemod namespace --hooks` knows it.
- **A new type.** `TUseUntypedTranslateFn` is the function the hook returns.

## Who is affected

- **An app that casts a run-time key to `TUseTranslateKeys`, or wraps the `ra-core` hook itself.** You can use `useUntypedTranslate` instead and remove the cast or the wrapper.
- **All other apps.** No action needed.

See [Hooks](../references/hooks#useuntypedtranslate) and [Internationalization](../references/i18n).
