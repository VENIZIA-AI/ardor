---
type: Playbook
title: Writing a changelog entry
description: The version folder of the changelog, what an item and its migration block need, and the checks that read them.
tags: [process, changelog, docs]
---

# Writing a changelog entry

The changelog is one folder per version, `docs/wiki/content/changelogs/<X.Y.Z>/`, from 0.4.5 on
(`knowledge.migrationFrom`). The folder of the next stable is the changelog of the work in progress: every
change a user sees is a line in it, each prerelease edits it, and it states the net change from the previous
stable. The files named `YYYY-MM-DD-<slug>.md` up to `knowledge.datedUntil` (2026-11-15) are history: do not
add or edit one (`vulcan changelog check` fails a dated file later than `datedUntil`). The index (`/changelogs/`) and the
page of a version (`/changelogs/<X.Y.Z>`) are built from the folders by the shared theme, so there is no table
row and no sidebar link to add.

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

## The version folder

| File | Holds |
|---|---|
| `log.md` | Frontmatter `title`, `version`, `packages` (npm names whose code changed, from `packages[].name`) and, for a stable only, `released: YYYY-MM-DD`; then one plain sentence for the version; then Keep a Changelog sections in the order Breaking, Deprecated, Added, Changed, Fixed, Security. |
| `migration.yaml` | One block per Breaking or Deprecated item, keyed by the item id at the top level of the file. |

An item is one line: `- **Title** \`item-id\` (\`@venizia/ardor-kernel\`, \`@venizia/ardor\`): what changed and what to do, in plain words.` The id is lower-case words joined by `-` and unique in the folder; the package list is optional and every name in it must be a package of the project. A change to an item that shipped in a prerelease edits that line: the folder says what the stable changes, not the history of the prereleases. A released folder (one with `released:`) is never edited.

## The migration block

A Breaking or Deprecated item has a block in `migration.yaml`, and a block has an item. A behaviour-only break counts: the block says what the app now sees and does.

```yaml
redis-factory-per-topology:             # the item id
  symbols: [RedisHelperFactory.create]  # the names an app's code uses: Name, Name.member or a module specifier
  upgrade:
    before: |-
      RedisHelper.new()
    after: |-
      RedisHelperFactory.create()
  downgrade:
    steps:
      - Call RedisHelper.new() again
  data: Stored tokens keep the old prefix.   # optional: stored data that does not cross the boundary
  codemod: namespace                         # optional: the name `ardor codemod --list` prints
```

List the symbols as the app spells them before the change (a removed or renamed name is not in the new exports, so the check does not look them up). `before`/`after` and `steps` are alternatives, never both, in `upgrade` and in `downgrade`. A plain YAML scalar that holds a colon followed by a space is read as a map: reword it or quote it. The codemod is named, never a command: `knowledge.codemodCommand` (`ardor codemod`) is the runner, and a name must be one of `ardor codemod --list`.

## Checks

| Command | What it fails |
|---|---|
| `make changelog-check` (part of `make lint-all`) | a Breaking or Deprecated item with no block, a block with no item, a package the project does not declare, an invalid `log.md` or block, a codemod name `ardor codemod --list` does not print, a dated file later than `datedUntil`, more than one folder without `released:`, a folder in progress that is not above every released one |
| `bun x vulcan changelog check --history --base <last stable tag>` | a released folder that changed since the base, a stable at or above `migrationFrom` with no folder, a dated file later than `datedUntil` added or edited |
