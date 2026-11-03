---
type: Playbook
title: Writing a changelog entry
description: The shape of a wiki changelog entry, the parts every entry needs, and the template to copy.
tags: [process, changelog, docs]
---

# Writing a changelog entry

<!-- okf:generated:contents start -->
**Contents**

- [What gets an entry](#what-gets-an-entry)
- [What every entry needs](#what-every-entry-needs)
- [Optional frontmatter](#optional-frontmatter)
- [Template](#template)
<!-- okf:generated:contents end -->

An entry is a file in `docs/wiki/content/changelogs/` named `YYYY-MM-DD-<slug>.md`. The changelog index
(`/changelogs/`) is built from the entries themselves: add the file and it appears, grouped by year, with
no table to edit. Copy the template below.

## What gets an entry

The changelog records only what affects the users of the published packages (`@venizia/ardor`,
`-kernel`, `-react`, `-admin`) and what they can use. Ask: does a user see or do something different?

| Gets an entry | Gets none |
|---|---|
| A new feature, API, hook, option or preset | Release tooling, CI and workflows, guards and gates |
| Changed behaviour, or a breaking change with its upgrade step | A refactor with no behaviour change |
| A bug fix a user could hit | Tests, agent rules and skills, the knowledge bundle, internal docs |
| A security fix | Repository hygiene: formatting, lint setup, scripts, make targets, the wiki's own look |
| A deprecation or a removal | A version promotion with no code change |

A pull request with only the right-hand kind of change gets no entry, and a release of such work has none
either. A mixed pull request gets an entry for the left-hand part only. Write the user's benefit and what
to do about it, in a few lines; the implementation stays in the code and the knowledge bundle.

## What every entry needs

| Part | Where | Rule |
|---|---|---|
| **Badge** | one `<Badge>` line under the first heading | Keep the ones that apply: New Feature, Enhancement, Bug Fix, Security, Behavior Change, Breaking Change. The first types the entry on the index and in the filters. |
| **`packages:`** | frontmatter | The npm names whose code changed, from `packages[].name`. An entry about no package is internal and has no place here. `okf check --strict` fails an entry without the list. |
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
# Mandatory: the npm names whose code changed in this release.
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
