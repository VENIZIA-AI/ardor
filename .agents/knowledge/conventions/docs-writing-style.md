---
type: Convention
title: Docs writing style
description: Hyphen never em-dash, the brand is always ARDOR, and the bundle is gated on it.
resource: docs/wiki
tags: [conventions, docs, style]
---

Rules for anything written in the wiki or in this knowledge bundle:

- **Hyphen, never em-dash or en-dash.** Use `-`. Never `—` or `–`. Apply this even mid-sentence
  where an em-dash would be the natural English choice - rewrite the sentence instead.
- **The brand is always "ARDOR"**, all caps, never `Ardor` or `IGNIS` when referring to the
  frontend framework itself. `IGNIS` is the correct name for the underlying DI container and is
  used as-is when that layer is being discussed. This applies in prose, headings, and titles alike.
- **English prose.** The bundle and wiki are English-only.
- **No version numbers.** Package versions churn on every release; a version pinned in prose goes
  stale immediately. Describe capabilities, not version-gated ones.

## Enforcement

This is not just a style preference - `make okf-check` gates the knowledge bundle on it (along
with frontmatter shape, link validity, and coverage against the source inventory). A file that
violates the em-dash or brand-casing rule fails the gate before it can land. See
[build system](/process/build-system.md) for how the gate runs.

The wiki also runs a snippet gate that compiles every ```ts fence in the docs against the real
packages (kernel, react, admin, ui-kit). A code sample that references a service, provider, hook,
or constant that does not exist - or that uses the wrong import path - fails the gate the same way
a bad link does. Keep examples honest: reference real binding keys like `services.<ClassName>`,
real constants like `RequestMethods` and `RequestTypes` from
`packages/kernel/src/common/constants.ts`, and real error helpers like `getError` from
`@venizia/ignis-inversion`.

## Don't restyle the surrounding UI

Changing documentation content is in scope; changing the rendering surface is not. The wiki uses
native VitePress - no bespoke components or page-specific CSS for changelog or reference pages.
If a docs change seems to need custom UI, that is a signal to reshape the content, not to add
styling.

## Related

- [Build system](/process/build-system.md)
- [Coding style](/conventions/coding-style.md)
- [Gotchas](/conventions/gotchas.md)
