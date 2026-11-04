---
title: StorageCodecs.text reads and writes a bare string
description: StorageCodecs.text() stores a string as it is, with an optional list of allowed values, for a key whose data is not JSON; useStoredState and BrowserStorage take it as their codec.
packages: ['@venizia/ardor-kernel', '@venizia/ardor']
---

# Changelog - 2026-11-04

## StorageCodecs.text reads and writes a bare string

<Badge type="tip" text="New Feature" />

**In one line.** `StorageCodecs.text()` is a storage codec for a key whose data is a bare string (`dark`, not `"dark"`). The default JSON codec cannot read such a key; this one reads and writes it as it is. `StorageCodecs.text({ allowed })` also refuses a value outside a list.

```tsx
import { StorageCodecs, useStoredState } from '@venizia/ardor';

const THEME = StorageCodecs.text({ allowed: ['light', 'dark'] });

export function ThemeSwitch() {
  const { value, setValue } = useStoredState({
    key: '@app/store/theme',
    defaultValue: 'light',
    codec: THEME,
  });

  return <button onClick={() => setValue(value === 'dark' ? 'light' : 'dark')}>{value}</button>;
}
```

## What changed

- **A public plain-text codec.** `StorageCodecs.text()` returns an `IStorageCodec<string>`. Create it once, outside a component, because `useStoredState` asks for a stable `codec`.
- **`allowed`.** A stored text outside the list does not decode, so `BrowserStorage.get` gives its `fallback` and `useStoredState` gives its `defaultValue`. A value outside the list does not encode, so `BrowserStorage.set` returns `false` and leaves the storage as it was. The error names no value, because a stored text can be a token.
- **`useStoredState` uses it too.** The hook reads the raw stored text through this codec instead of keeping its own, so no second plain-text codec exists. With `allowed`, a value outside the list is not stored, and `setValue` treats it like any write the storage refuses: the hook keeps it until the storage next changes.
- **A fallback of another type.** With a `codec`, `BrowserStorage.get` accepts a `fallback` of another type than the codec's value, such as `null`, and answers the union. This is a type change only; nothing changes at run time.

## Who is affected

- **An app that stores a bare string** (a theme name, a language code, a mode) and wrote its own codec for it. You can use `StorageCodecs.text()` and delete the codec.
- **All other apps.** No action needed.

See [Browser storage](../references/index#a-bare-string-as-the-stored-text) and [Hooks](../references/hooks#usestoredstate).
