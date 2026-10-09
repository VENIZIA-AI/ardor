---
title: useDocumentTitle no longer overwrites a newer title on unmount
description: useDocumentTitle puts back the previous tab title only while the tab still shows its own, so a locale switch or a twin call no longer leaves a stale title.
---

# Changelog - 2026-10-10

## useDocumentTitle no longer overwrites a newer title on unmount

<Badge type="info" text="Bug Fix" />

**In one line.** On unmount or a title change, `useDocumentTitle` restores the title it replaced only if the tab still shows the title it wrote.

## What changed

- **The guard.** The cleanup compares `document.title` with the hook's own title and restores only on a match.
- **A locale switch.** ra-core re-mounts the tree when the locale changes. A layout that writes its default title in a layout effect runs before the old hook's cleanup, and the cleanup used to put the old-language title back. It now leaves the new title in place.
- **Two calls with the same title.** React cleans up effects in mount order, not last-in-first-out, so two same-title calls unmounting together used to leave `Orders · App`. The tab now goes back to the title from before both.

## Who is affected

- **Applications that call `useDocumentTitle`.** No action needed.

## Details

| File | Package |
|------|---------|
| `src/hooks/use-document-title.ts` | admin |
| `src/__tests__/hooks/use-document-title.test.ts` | admin |

See [React hooks](../references/hooks#usedocumenttitle).
