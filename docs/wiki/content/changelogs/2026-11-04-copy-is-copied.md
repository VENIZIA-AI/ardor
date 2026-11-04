---
title: useCopyToClipboard returns isCopied, with a resetMs option
description: useCopyToClipboard returns { copy, isCopied }, and resetMs sets isCopied back to false after a delay, so a "Copied" button needs no state or timer of its own.
packages: ['@venizia/ardor-react', '@venizia/ardor']
---

# Changelog - 2026-11-04

## useCopyToClipboard returns isCopied, with a resetMs option

<Badge type="tip" text="New Feature" />

**In one line.** `useCopyToClipboard({ resetMs })` returns `{ copy, isCopied }`: `isCopied` is the result of the last copy, and with `resetMs` it goes back to `false` after that many milliseconds.

```tsx
import { useCopyToClipboard } from '@venizia/ardor';

export function CopyShareLink(props: { url: string }) {
  const { copy, isCopied } = useCopyToClipboard({ resetMs: 2000 });

  return <button onClick={() => copy({ value: props.url })}>{isCopied ? 'Copied' : 'Share'}</button>;
}
```

## What changed

- **`isCopied` is part of the hook.** A new copy restarts the timer, a refused copy sets `isCopied` to `false`, and the timer is cleared on unmount. Without `resetMs`, or with `0` or less, `isCopied` stays as the last copy left it.
- **`copy` is as before.** It resolves `true` when the text is on the clipboard and `false` otherwise, never throws, and keeps its identity across renders as long as `resetMs` is the same.
- **A new type.** `IUseCopyToClipboardOptions` is the options object.

## Who is affected

- **An app that keeps a state and a timer around `useCopyToClipboard` for a "Copied" label.** You can pass `resetMs` and read `isCopied` instead.
- **All other apps.** No action needed: `const { copy } = useCopyToClipboard()` still works.

See [Hooks](../references/hooks#usecopytoclipboard).
