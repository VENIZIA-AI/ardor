---
title: 0.4.5
version: 0.4.5
packages: ['@venizia/ardor-admin', '@venizia/ardor']
released: 2026-10-28
---
A small release. Applications keep working without changes. The one addition is a `fallback` option on `useDocumentTitle`, so a layout can set a base tab title that screens override.

## Added

- **useDocumentTitle takes a fallback** `document-title-fallback` (`@venizia/ardor-admin`, `@venizia/ardor`): a layout and a screen that both called `useDocumentTitle` left the layout's title on the first mount, because React runs child effects before the parent's. A call with `fallback: true` now shows its title only while no call without it is mounted: the screen's title wins on the first mount and the fallback shows again when the screen unmounts. Of two fallbacks, the one mounted last shows. When the last call unmounts, the tab title from before the first call comes back, unless something else wrote a title since. A call without `fallback` behaves as before when it is the only one mounted. With several mounted, the screen mounted last shows, and when one unmounts the title is rewritten from the calls that remain, even if other code wrote the title in between. An app whose layout and screens both set a title adds `fallback: true` to the layout's call; everyone else does nothing.
