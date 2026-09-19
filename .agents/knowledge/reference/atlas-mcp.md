---
type: Reference
title: Atlas MCP server
description: What the ardor-atlas MCP server is - IGNIS's atlas run against this checkout - its tools and corpora, and the two generated tables behind symbol, version and changes, with why they go stale.
resource: .mcp.json
tags: [reference, atlas, mcp, tooling]
---

`ardor-atlas` is the MCP server agents query for this bundle, the wiki and the changelogs (rule
P-01). ARDOR ships no atlas package of its own: the server is IGNIS's `@venizia/ignis-atlas`, run
against this checkout. The markdown it serves is read live; the two JSON tables behind `symbol`,
`version` and `changes` are generated, committed, and go stale.

## How it runs

`.mcp.json` registers it as `bunx @venizia/ignis-atlas@<exact version> mcp --root .`.

- **Pinned, not `latest`.** The `latest` dist-tag still points at a build that predates
  family-checkout support, so an unpinned `bunx` cannot serve ARDOR. The same pin is repeated in
  `scripts/atlas-smoke.ts` - move both together.
- **Bun only.** The index is `bun:sqlite` FTS5; a Node host cannot start the server.
- **`--root .` makes it ARDOR's.** A root is a family checkout when `docs/wiki/content`,
  `docs/wiki/content/changelogs` and `.agents/knowledge` exist and the root `package.json` is named
  `@venizia/<family>-workspace` - here `@venizia/ardor-workspace`, so the server names itself
  `ardor-atlas`. An explicit `--root` that is not a checkout exits 2 rather than falling back to the
  IGNIS wiki snapshot packaged inside the release, which would answer from the wrong framework.
- **Changing the server itself.** `.mcp.local.example.json` runs
  `bun ../ignis/packages/atlas/src/cli.ts mcp --root .` from an IGNIS checkout beside this one; copy
  it to the gitignored `.mcp.local.json` or edit `.mcp.json` locally. `make atlas-smoke` takes the
  same override through `ARDOR_ATLAS_CLI`.

## Corpora

| Corpus | Directory | Chunk id prefix |
|---|---|---|
| `wiki` | `docs/wiki/content`, minus `changelogs/` | `wiki:` |
| `changelog` | `docs/wiki/content/changelogs` | `changelog:` |
| `knowledge` | `.agents/knowledge` | `okf:` |

Only `.md` files are indexed, split into H2 and H3 chunks. Before every call the server fingerprints
the markdown (file count, newest modification time, total bytes) and rebuilds the index when it
moved, so an edited concept or wiki page is searchable on the next call - no restart, no generation
step. Ranking is bm25 times an authority weight: a changelog chunk ranks below a canonical page, and
`log.md` lower still.

## Tools

| Tool | Answers | Backed by |
|---|---|---|
| `search` | Chunks matching a keyword query; `corpus` narrows it to one corpus. Page with `nextOffset`, not `offset + limit` - a reply-size budget can trim a page | The live index; a one-word query that exactly names an exported symbol also carries a `symbol` brief from `symbols.json` |
| `get` | One chunk by a search hit's id, or a whole document with the anchor dropped; a long body pages by `cursor` | The live index |
| `symbol` | An exported symbol's package, specifier, kind, signature and source `file` and `line`, plus up to five doc chunk ids; an unknown name answers with the closest names | `reference/symbols.json` |
| `version` | The `@venizia/*` versions a project declares and has installed, next to the newest release of each live package | `reference/releases.json` |
| `changes` | The changelog entries between two versions of one package, or between two dates | `reference/releases.json` |

Package names are where the IGNIS-built server shows through - its name mapping knows only
`@venizia/ignis-*`:

- `symbol`'s `package` filter matches `ardor-react` or `@venizia/ardor-react`, never a bare `react`.
- `changes` takes the directory name (`kernel`); `@venizia/ardor-kernel` is an unknown package.
- `version` never fills `behind` for an ARDOR package, however old the installed version - compare
  `installed` against `snapshot` yourself.

## The generated tables

Both live in `reference/`, come from a script, and are never hand-edited. The server reads them once
at startup, so a regenerated table reaches an MCP client only after the server restarts. A missing or
unreadable table leaves the server up and the tool answering that the build has no such table.

**`symbols.json`** - `scripts/atlas-symbols.ts`, `make symbols-gen`. Every exported symbol of every
`.d.ts` entry in the `exports` maps of the five packages, with the kind `public-surface.ts` records, a
one-line signature capped at 300 characters, and the `src/` file and line recovered through the
`.d.ts.map` declaration maps. A symbol re-exported from a third-party declaration carries
`external: true`, its `file` inside `node_modules`. It reads `dist`, so it throws until the packages
are built.

**`releases.json`** - `scripts/atlas-releases.ts`, `make releases-gen`. No build needed:

- `releases` - every `chore(<package>): release v<version> [<mode>]` commit, per package: version,
  date, short sha, and first-parent position, which is what separates two releases of one day.
- `changelogs` - every dated `YYYY-MM-DD-*.md` page under `docs/wiki/content/changelogs`: id, title,
  the first `<Badge>` text as its kind, the position of the commit that added it, and the packages
  it names - a `packages:` frontmatter list, else a `Package` table column, else `@venizia/ardor...`
  mentions, else `packages/<dir>` paths. A page none of these answer names no package and never
  appears in a package's `changes` window; `gen` prints how many there are.
- `livePackages` - the directories under `packages/` that carry a manifest.

## Why they go stale

- **Every release.** `releases.json` is generated from release commits, so it lacks exactly the chain
  that just shipped: `version`'s `snapshot` lags the registry and `changes` answers "unknown version".
  `scripts/release.ts` regenerates both tables after the whole chain - never per package, since every
  release commit has to exist first - then commits `chore(atlas): refresh the generated tables for
  the release` and pushes it when they moved. `--no-tables` skips that. `scripts/release-local.ts`
  and a hand-dispatched workflow run refresh nothing.
- **A changelog page** moves `releases.json` when it is added, and again when it is committed - an
  uncommitted page has no commit position yet.
- **A public-surface change** moves `symbols.json` once the packages are rebuilt. The refresh in
  `release.ts` builds nothing first, so a stale local `dist` writes a stale table.

`make symbols-check` and `make releases-check` compare each committed table with a fresh render, and
`make test-scripts` runs the same checks (skipped when a table is absent) - in the manually
dispatched CI, after `make build-all`. Release commits only exist in full history, so both CI jobs
check out with `fetch-depth: 0`. `make atlas-smoke` is manual and gates nothing: it starts the pinned
server against this repository and checks that it names itself `ardor-atlas`, lists the five tools,
finds `no-auth-paths` in the knowledge corpus and the data provider page in the wiki, and resolves
`useInjectable` to `@venizia/ardor-react`.

## Related

- [Build, run, test](/overview/build-run-test.md) - the repository gates, the atlas ones among them
- [Release and publish](/process/release-publish.md) - the release chain that ends in the refresh
- [Updating the wiki](/process/updating-the-wiki.md) - the pages the `wiki` and `changelog` corpora index
- [Public surface](/reference/public-surface.md) - the name-and-kind snapshot the symbol table extends
