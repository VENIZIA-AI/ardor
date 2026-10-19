---
type: Convention
title: File splitting
description: When to split a long file, which axis to cut along, and the measurable signal that a split went too far - the IGNIS convention, applied to ARDOR.
resource: packages/kernel/src
tags: [conventions, structure, readability]
---

Length alone is not a defect. A file is too long when it serves **more than one stage of a
lifecycle**, not when it passes a line count. A wrapper around a large external API is long because
that API is large - splitting it by size makes several files nobody can navigate instead of one file
nobody can read. This is IGNIS's convention, kept identical so a reader moves between the two
repositories without relearning it.

## The soft threshold

**500 lines is a prompt to explain, not a rule to obey.** Past it, the author should be able to name
the single job the file does. If naming that job needs the word "and", the file has a seam. If the
job is genuinely one thing that takes many lines, leave it and say so. There is no hard cap and no
lint rule: a cap produces files that satisfy the cap.

## The axis: lifecycle stage, not layer and not CRUD verb

Split a concept's folder by **what stage of its life the code serves** - for a request service, for
example: building the request, sending it, recovering auth, reading the response. Splitting by CRUD
verb instead (`create.ts`, `update.ts`) produces near-twin files: a change to one has to be
remembered in the other. Splitting by layer scatters one narrative across files a reader has to
reassemble.

## Naming

Name the piece after its **role or stage**, never after the folder it sits in and never by number
(V-C-17): `services/response-reader.ts`, not `services/network-request-response-reader.ts`.

## The signal that a split went too far

Measure coupling **among the extracted pieces**, not the parent's fan-out. Count the relative (`./`)
imports each new file makes to its siblings:

- **Zero or one per extracted piece** - the pieces are leaves. A reader opens the parent, then at
  most one leaf, and never chains from leaf to leaf.
- **Three or four per extracted piece** - the cut went through the middle of a flow rather than
  between two stages.

**The parent may import all of its pieces.** What matters is whether the leaves know about each
other. When a piece would have to call back into a sibling, do not extract it - leave it in the
parent.

## Tools

- `make split-report` - hub candidates, stray `types.ts`, folders without a barrel, files over 500
  lines, cycles per package. Informational.
- `make cycles-check` - fails on an import cycle in any `dist`. Bun turns cycle members into lazy
  initializers, and a barrel over one can export `undefined`.
- `make surface-check` - the public surface equals [Public surface](/reference/public-surface.md).
  It records exported names and kinds only, so it catches an export added, removed or renamed, not a
  changed signature. A split that changes the symbol list is wrong.
- `make wiki-links-check` - every source path the wiki or this bundle names still exists. It
  catches paths a split forgot to update.

Before moving a file, sweep its importers including inline `import('./x').Y` types and tests; the
clean rebuild (`make <pkg>`) is the real completeness check.

All four ARDOR packages declare `"sideEffects": false`, so a bundler may drop a module whose only
effect is a statement run at load time. Never let a split move registration or other work into module
scope; it belongs in code a caller runs.

## Related

- [Splitting a hub file by topic](/process/splitting-a-hub-file.md) - the ordered steps
- [Public surface](/reference/public-surface.md)
- [Build system](/process/build-system.md)
