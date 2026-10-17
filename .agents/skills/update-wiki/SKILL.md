---
name: update-wiki
description: Update ARDOR framework wiki documentation (changelogs, references, guides) based on recent code changes
user-invocable: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Agent
---

# Update Wiki Documentation

You are updating the ARDOR framework wiki. Its pages live in `docs/wiki/content/`; the playbook with the full rules is `.agents/knowledge/process/updating-the-wiki.md`.

## Arguments

`$ARGUMENTS` tells you what to document. Examples:
- `/update-wiki add changelog for model authorize settings` - create a changelog
- `/update-wiki update authorization reference docs` - update existing reference
- `/update-wiki add guide for model authorization setup` - create a guide

If no arguments, ask what to document.

## Wiki Structure

```
docs/wiki/content/
├── changelogs/          # Date-prefixed: YYYY-MM-DD-slug.md, plus template.md and index.md
├── guides/
│   ├── get-started/
│   └── migration/
├── references/          # One page per topic: application, data-provider, hooks, types, ...
├── extensions/
└── best-practices/
```

## Process

### 1. Understand the changes

- Read the relevant source files that were changed
- Use `git diff develop` or `git log --oneline -20` to understand recent changes
- Identify: what changed, why, breaking changes, new APIs, migration steps

### 2. Determine doc type

| Type | When | Naming |
|------|------|--------|
| **Changelog** | New feature, breaking change, significant refactor | `changelogs/YYYY-MM-DD-slug.md` |
| **Reference** | New/updated API surface | `references/<topic>.md` |
| **Guide** | How-to, tutorial, concept explanation | `guides/<category>/file.md` |

### 3. Write the documentation

#### For changelogs

Follow the template at `docs/wiki/content/changelogs/template.md`, and add a row to `docs/wiki/content/changelogs/index.md`. Key sections:
- Frontmatter with title and description
- Overview bullet points
- Breaking Changes (with before/after code)
- New Features (with problem/solution/example/benefits)
- Files Changed table
- Migration Guide (if breaking)
- "No Breaking Changes" section (if none)

Only include sections that apply. Remove empty template sections.

#### For references

- Start with a brief description of what the module does
- Document every public interface, class, method, decorator
- Include TypeScript signatures
- Add usage examples
- Document options objects with all fields

#### For guides

- Start with what the reader will learn
- Step-by-step instructions
- Complete, runnable code examples
- Link to relevant reference docs

### 4. Update sidebar (if new file)

If you created a new doc file, update the VitePress sidebar config:

**File:** `docs/wiki/site/.vitepress/config.mts`

Add the new page to the appropriate sidebar section.

### 5. Update index pages

If the doc belongs to a category with an `index.md`, add a link to the new doc there.

### 6. Run the gates

From `docs/wiki`: `bun scripts/check-sidebar.mts` and `bun scripts/check-snippets.mts` (snippets compile against the built `dist`, so build first). From the repo root: `make wiki-links-check`.

## Style Rules

- Use TypeScript for all code examples
- Import from `@venizia/ardor` in examples, or from a sub-package path when the page is about one (`@venizia/ardor-kernel/repository`)
- Match the technical depth of existing docs - direct, no hand-holding
- Use GitHub-flavored markdown alerts: `> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`
- Tables for structured comparisons (files changed, API surfaces, config options)
- Before/after code blocks for breaking changes
- Keep frontmatter `title` under 80 chars, `description` under 160 chars
