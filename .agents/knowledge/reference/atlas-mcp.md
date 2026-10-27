---
type: Reference
title: Atlas MCP server
description: What the atlas MCP server (registered as `atlas`, naming itself ardor-atlas) is - VULCAN's atlas run against this checkout, and against IGNIS beside it - its tools and corpora, where symbol, version and changes get their answers, and when those answers go stale.
resource: .agents/vulcan.manifest.json
tags: [reference, atlas, mcp, tooling]
---

<!-- okf:generated:contents start -->
**Contents**

- [How it runs](#how-it-runs)
- [Corpora](#corpora)
- [Tools](#tools)
- [Symbols and releases](#symbols-and-releases)
- [When an answer is stale](#when-an-answer-is-stale)
- [The prebuilt index of this repository](#the-prebuilt-index-of-this-repository)
- [Related](#related)
<!-- okf:generated:contents end -->

`atlas` (registered under that key in `.mcp.json`, a per-machine file that `vulcan sync` writes and git ignores) is the MCP server agents query for this bundle, the wiki and the changelogs (rule
P-01). ARDOR ships no atlas package of its own: the server is VULCAN's atlas (`@venizia/vulcan-atlas`,
pinned through `@venizia/vulcan`), run against this checkout. The markdown it serves is read live.
Nothing behind `symbol`, `version` and `changes` is committed any more: atlas reads symbols from the
`.d.ts` and computes releases from git tags when it is asked.

## How it runs

`vulcan sync` registers it as `bun x --no-install vulcan x atlas mcp --root .`.

- **Pinned by the dev dependency.** The atlas version is the one `@venizia/vulcan` pins in the root
  `package.json`; `scripts/checks/atlas-smoke.ts` runs the same command. `--no-install` keeps `bun x` from
  fetching the unrelated unscoped `vulcan` package before `bun install` ran.
- **Bun only.** The index is `bun:sqlite` FTS5; a Node host cannot start the server.
- **`--root .` makes it ARDOR's.** atlas reads the committed `.agents/vulcan.manifest.json` and
  nothing else of the project: it never imports `.configs/vulcan.config.mts`. `make vulcan-sync`
  writes the manifest from that config, so a changed `packages` list, `knowledge` path or
  `atlas.sources` entry reaches atlas only after a sync, and the manifest is committed so another
  project's `atlas.sources` can read ARDOR.
- **IGNIS is served beside ARDOR.** `atlas.sources` in `.configs/vulcan.config.mts` lists IGNIS
  (`VENIZIA-AI/ignis` at `develop`), so one server answers over both projects and every hit names
  its `source`. atlas fetches a source with git into `$XDG_CACHE_HOME/vulcan/atlas/v1/` and asks the
  remote for the ref's commit and tags on each start. An unreachable source is reported
  `UNAVAILABLE` in the `initialize` reply and the server still serves the rest; with the remote
  down but a cache present it serves the last commit and says `OFFLINE`.
- **The server introduces itself as `ardor-atlas`**, and is registered as `atlas`, whether or not a source is served beside this checkout.
- **Changing the server itself.** Edit the gitignored `.mcp.json` locally to run the atlas CLI of a VULCAN checkout
  beside this one; the next `vulcan sync` rewrites it.
  `make atlas-smoke` takes the same override through `ARDOR_ATLAS_CLI`.

## Corpora

| Corpus | Directory | Chunk id prefix |
|---|---|---|
| `wiki` | `docs/wiki/content`, minus `changelogs/` | `wiki:` |
| `changelog` | `docs/wiki/content/changelogs` | `changelog:` |
| `knowledge` | `.agents/knowledge` | `okf:` |

Only `.md` files are indexed, split into H2 and H3 chunks. Before every call the server fingerprints
the markdown (file count, newest modification time, total bytes) and rebuilds the index when it
moved, so an edited concept or wiki page is searchable on the next call - no restart, no generation
step. Ranking is bm25 times an authority weight: a changelog chunk ranks below a canonical page. IGNIS's index is built once per commit. `search` takes a `source` (`ardor` or
`ignis`) to narrow a query to one project, and `get` takes one only when two sources hold the same id.

## Tools

| Tool | Answers | Backed by |
|---|---|---|
| `search` | Chunks matching a keyword query; `corpus` narrows it to one corpus and `source` to one project. Page with `nextOffset`, not `offset + limit` - a reply-size budget can trim a page | The live index; a one-word query that exactly names an exported symbol also carries a `symbol` brief |
| `get` | One chunk by a search hit's id, or a whole document with the anchor dropped; a long body pages by `cursor` | The live index |
| `symbol` | An exported symbol's package, specifier, kind, signature and source `file` and `line`, plus up to five doc chunk ids; an unknown name answers `matches: []` with the `closest` names | The built `.d.ts` of the `packages` list |
| `version` | The `@venizia/*` versions a project declares and has installed, next to the newest release of each live package | The git tags |
| `changes` | The changelog entries between two versions of one package, or between two dates | The git tags and the changelogs' `packages:` |

A package is named the same way in every tool. A value resolves by npm name, then that name without
its scope, then directory, then alias, case-blind, and every answer carries the npm name:

- `symbol`'s `package` filter and `changes`' `package` both take `@venizia/ardor-react`, `ardor-react`
  or `react`.
- A directory that two served projects share is ambiguous. `kernel` is both ARDOR's and IGNIS's, so
  `changes` with `package: kernel` fails and lists the npm names; ask for `@venizia/ardor-kernel`.
  `symbol` does not fail on it: it answers with the matches from every source, each naming its own.
- `version` fills `behind` for an ARDOR package like any other: a package whose installed exact
  version orders below its newest tag. A version it cannot resolve to one exact value (a range,
  `workspace:`) is skipped, never guessed. It reads the `package.json` and `node_modules` of its
  `cwd`, and ARDOR's own root declares no ARDOR package, so asked there it reports VULCAN and
  `@venizia/dev-configs` while `snapshot` lists every package of both projects.

## Symbols and releases

Neither has a file in `reference/`. Both are derived from the repository when atlas needs them, and
`make atlas-symbols` and `make atlas-releases` print exactly what atlas reads.

**Symbols** come from the `.d.ts` of the live `packages` in `.configs/vulcan.config.mts`: every
exported symbol of every `.d.ts` entry in their `exports` maps, with the kind the
[public surface](/reference/public-surface.md) records, a one-line signature capped at 300
characters, and the `src/` file and line recovered through the `.d.ts.map` declaration maps. A symbol
re-exported from a third-party declaration carries `external: true`, its `file` inside
`node_modules`. It reads `dist`, so `symbol` answers that the packages are not built until
`make build-all` ran. IGNIS's symbols come from its packages installed in this checkout's
`node_modules`, else from the newest npm release a pull cached.

**Releases** are computed from the git tags `<dir>-v<version>` (the manifest's `tagPattern`; the
default, and what the release workflow creates). A tag outside HEAD's history releases nothing, and
a retired package (`ui-kit`) keeps its old tags as history. Changelogs join the table by their
frontmatter:

- `packages:` lists the npm names an entry is about. An explicit `packages: []` says the entry is
  about no package, such as repository tooling; an entry that declares none appears in no package's
  `changes` window, and `make okf-check-strict` reports it. `make changelogs-migrate` writes the
  list into entries that lack one, once, for review.
- An entry falls after the releases that existed before the commit that added it. An uncommitted
  entry counts as newer than every release, and a `release: '<npm name>@<version>'` line places it
  by hand.

## When an answer is stale

- **The tags move.** The release table is built when the server starts, so a tag pushed or fetched
  afterwards is invisible to this repository's `version` and `changes` until the MCP client
  restarts the server. A shallow clone has no history: the tools answer that no release was found,
  hence `fetch-depth: 0` in CI. A release chain leaves nothing to refresh - `scripts/release/release.ts`
  and the workflow push the tags and that is all.
- **A stale local `dist`.** Symbols are read from the built declarations, which atlas fingerprints
  before each question and reloads when they moved (`declarationsFingerprintOf`), so a rebuild is
  picked up without a restart. A source change that was not rebuilt answers with the old symbols.
- **A changelog page** moves `changes` when it is added, and again when it is committed - an
  uncommitted page has no commit position yet.
- **A manifest edit** reaches atlas only after `make vulcan-sync`.
- **A source** is as old as the commit the cache holds, or the last one served while offline.

None of these is a CI gate any more: the old `symbols-check` and `releases-check` are gone, because
nothing is committed to compare. `make atlas-smoke` is manual and gates nothing: it starts VULCAN's
server against this repository and checks that it names itself `ardor-atlas`,
lists the five tools, finds `no-auth-paths` in the knowledge corpus and the data provider page in
the wiki, and resolves `useInjectable` to `@venizia/ardor-react`.

## The prebuilt index of this repository

ARDOR publishes the atlas index of its own commits, so a project that declares ARDOR as a source downloads it instead of building it. `.github/workflows/atlas-index.yml` runs on a push to `main`, to `develop` or of a tag, builds the index through VULCAN's action (`VENIZIA-AI/vulcan/.github/actions/atlas-index`, pinned by commit to the installed VULCAN release, a bump is a deliberate pull request), signs it with the Actions secret `ATLAS_INDEX_KEY` and attaches the pair to the release `atlas-index`. The public half of the key is `atlas.index.keys` in `.configs/vulcan.config.mts`, rendered into `.agents/vulcan.manifest.json`; a reader accepts a pair only when a listed key verifies it, and otherwise builds locally as before. The job has `contents: write` and nothing else does; the secret is read only by the publishing step; `scripts/release/__tests__/atlas-index-workflow.test.ts` holds those rules. **Known limit:** the release workflow pushes its release commits and tags with the Actions token, and GitHub starts no workflow from those pushes, so a release tag of ARDOR gets no pair until ARDOR moves to a VULCAN whose release runs the action itself (0.4.7); the next push to `develop` covers the head. Rotating the key: make a new key, replace the secret, replace the public key in the config and run `vulcan sync`; pairs signed by the old key then stop verifying and readers build locally.

## Related

- [Build, run, test](/overview/build-run-test.md) - the repository gates, the atlas ones among them
- [Release and publish](/process/release-publish.md) - the release chain whose tags atlas reads
- [Updating the wiki](/process/updating-the-wiki.md) - the pages the `wiki` and `changelog` corpora index
- [Public surface](/reference/public-surface.md) - the name-and-kind snapshot the symbol answers extend
