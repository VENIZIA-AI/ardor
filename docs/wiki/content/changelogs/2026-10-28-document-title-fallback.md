---
title: useDocumentTitle takes fallback, a base title a layout sets and screens override
description: useDocumentTitle gains an optional fallback flag; a fallback call shows its title only while no other call is mounted, so a layout's base title no longer wins over a screen's on the first mount.
packages: ['@venizia/ardor-admin', '@venizia/ardor']
---

# Changelog - 2026-10-28

## useDocumentTitle takes fallback, a base title a layout sets and screens override

<Badge type="tip" text="New Feature" />

**In one line.** A layout and a screen that both called `useDocumentTitle` left the layout's title on the first mount, because React runs child effects before the parent's. `fallback: true` makes the layout's title a base that screens override. Nothing changes without the flag. In ARDOR 0.4.5.

```tsx
import { useDocumentTitle } from '@venizia/ardor';

useDocumentTitle({ title: undefined, appTitle: appNameForLocale, fallback: true }); // in the layout
useDocumentTitle({ title: 'Orders', appTitle: appNameForLocale }); // in a screen
```

## What changed

- **`fallback` option.** A call with `fallback: true` shows its title only while no call without it is mounted. The screen's title wins on the first mount, and the fallback shows again when the screen unmounts.
- **Two fallbacks.** The one mounted last shows; when it unmounts the earlier one shows again.
- **Unchanged.** A call without `fallback` behaves as before, including putting back the title it replaced and leaving a title a later writer set.

## Who is affected

- **An app whose layout and screens both set a title.** Add `fallback: true` to the layout's call. A base title that never changes can stay in the `<title>` of `index.html` instead.
- **Everyone else.** Nothing to do.

See [useDocumentTitle](../references/hooks#usedocumenttitle).
