---
title: useDocumentTitle and useHtmlLang
description: Two admin hooks - one sets the browser tab title per screen and restores it on unmount, the other keeps the html lang attribute on the UI locale.
---

# Changelog - 2026-10-09

## useDocumentTitle and useHtmlLang

<Badge type="tip" text="New Feature" />

**In one line.** `@venizia/ardor-admin` gains `useDocumentTitle`, which sets the tab title for a screen, and `useHtmlLang`, which keeps `<html lang>` on the UI locale. Both are re-exported from `@venizia/ardor`.

## What changed

- **`useDocumentTitle({ title, appTitle, separator, enabled })`.** The tab title is the non-empty `title` segments, then `appTitle`, joined by `separator` (default `' · '`). `title` is one segment or an array; `false`, `null`, `undefined` and `''` are skipped. `enabled` defaults to `true`.
- **Restore.** When the title changes or the component unmounts, the hook puts back the title it replaced, so no reset on navigation is needed.
- **`useHtmlLang()`.** Sets `document.documentElement.lang` to the ra-core `useLocaleState()` locale and follows every change, so screen readers pick the right voice.

```tsx
import { useDocumentTitle, useHtmlLang } from '@venizia/ardor';

export function OrdersPage() {
  useHtmlLang();
  useDocumentTitle({ title: 'Orders', appTitle: 'Back Office' });
  return null;
}
// tab title: Orders · Back Office
```

## Who is affected

- **Applications with their own title or `lang` hook.** They can switch to these; the signature is the options object above.
- **Everyone else.** No action needed.

## Details

- Call `useDocumentTitle` from one component per screen. React runs child effects before parent effects, so a call in a parent wins over a call in a child.
- `useHtmlLang` needs the ra-core locale state; `useDocumentTitle` needs nothing from the tree.

| File | Package |
|------|---------|
| `src/hooks/use-document-title.ts` | admin |
| `src/hooks/use-html-lang.ts` | admin |
| `src/hooks/index.ts` | admin |

See [React hooks](../references/hooks#usedocumenttitle).
