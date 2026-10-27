---
type: Playbook
title: Writing a changelog entry
description: The shape of a wiki changelog entry, the parts every entry needs, and the template to copy.
tags: [process, changelog, docs]
---

# Writing a changelog entry

<!-- okf:generated:contents start -->
**Contents**

- [What every entry needs](#what-every-entry-needs)
- [Optional frontmatter](#optional-frontmatter)
- [Template](#template)
<!-- okf:generated:contents end -->

An entry is a file in `docs/wiki/content/changelogs/` named `YYYY-MM-DD-<slug>.md`. The changelog index
(`/changelogs/`) is built from the entries themselves: add the file and it appears, grouped by year, with
no table to edit. Copy the template below.

## What every entry needs

| Part | Where | Rule |
|---|---|---|
| **Badge** | one `<Badge>` line under the first heading | Keep the ones that apply: New Feature, Enhancement, Bug Fix, Security, Behavior Change, Breaking Change. The first types the entry on the index and in the filters. |
| **`packages:`** | frontmatter | The npm names whose code changed, from `packages[].name`; `[]` for repository tooling. `okf check --strict` fails an entry without the list. |
| **Upgrade note for a breaking change** | the `## Breaking changes` section | Who is affected, then Before and After code or numbered steps. Delete the section when nothing breaks. |
| **Who is affected** | `## Who is affected` | Each audience, and whether it must act ("No action needed" where true). |

The title and the description (one plain sentence) are the entry's card on the index. The shared index lives in `docs/wiki/site/.vitepress/theme/shared/` (copied from VULCAN, never edited here). An optional
`summary:` (one or two plain sentences) replaces the description there when the card needs better text.

## Optional frontmatter

| Field | Use |
|---|---|
| `summary:` | The card text on the index and the feed; defaults to `description:`. |
| `type: release` | Marks a release overview (the batch page with the upgrade checklist) as its own type. A file name with `batch-overview`, or a title ending "(Overview)", does the same. |
| `release: '<npm name>@<version>'` | Places an entry git would place wrongly (a backfill); it must name a tag that exists. The index shows this version; without it the first x.y.z of the title is shown. |
| `badges: [...]` | Overrides the `<Badge>` line when the types are wanted without the markup. |

## Template

````markdown
---
title: [Short, plain title - what a user would search for]
description: [One sentence, plain - what changed and why it matters]
# Mandatory: the npm names whose code changed in this release; [] for repository tooling.
packages: ['@venizia/ardor']
---

# Changelog - YYYY-MM-DD

## [Main Title/Focus Area]

<!-- Keep only the badges that apply -->
<Badge type="tip" text="New Feature" /> <Badge type="tip" text="Enhancement" /> <Badge type="info" text="Bug Fix" /> <Badge type="danger" text="Security" /> <Badge type="warning" text="Breaking Change" />

**In one line.** [One plain sentence: what this release is, for a user.]

## What changed

- **[Thing 1].** [One crisp point in plain language - what changed, not the internal how.]
- **[Thing 2].** [One crisp point in plain language.]
- **[Thing 3].** [One crisp point in plain language.]

<!-- Group with ### sub-heads only if there are many bullets -->

## Who is affected

- **[Audience or situation 1].** [Are they impacted, and do they need to act? Say "No action needed" where true.]
- **[Audience or situation 2].** [Are they impacted, and do they need to act?]

## Breaking changes

<!-- ONLY include this section if there are breaking changes - delete it otherwise -->

> [!WARNING]
> [One sentence: who this affects and why.]

**Before:**

```typescript
// Code that no longer works
```

**After:**

```typescript
// New pattern
```

<!-- Or, for a non-code migration, a short numbered list -->
1. [Step one]
2. [Step two]

## Details

<!-- Optional - the "why/how". Keep it tight: bullets, a short code example, a small table. No wall-of-text paragraphs. -->

- [Why/how point 1]
- [Why/how point 2]

| File | Package |
|------|---------|
| `src/path/to/file.ts` | core |
````

The entry's own first heading (`# Changelog - date`), its title heading and its badge line are replaced on
the page by a title block built from the same fields; write them as the template shows so the page and the
source both read well.
