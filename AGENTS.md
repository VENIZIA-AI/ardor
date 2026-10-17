# AGENTS.md

How to work in the ARDOR repository. **This file is routing only** - it holds no rules and no
facts, it points to where both live.

This is the **only tracked instruction file**. ARDOR's agent tooling is **VULCAN**
(`@venizia/vulcan`, configured in `.configs/vulcan.config.ts`), which writes the gitignored
per-developer adapters (`CLAUDE.md`, `.claude/settings.json`, `.claude/skills/`):

```bash
make vulcan-sync      # or make agent-setup; re-run after a pull that touched .configs/ or .agents/
make vulcan-doctor    # checks the project still follows VULCAN
```

## Must read first

| Read before you touch anything | What lives there |
|---|---|
| **`node_modules/@venizia/vulcan/base/rules.md`** | **The VULCAN base rules** - write boundaries, security, process, build and the coding style every VENIZIA project shares. Cited `V-W-01`, `V-C-02`. |
| **[`.agents/rules.md`](.agents/rules.md)** | **ARDOR's rules** - what ARDOR adds to the base: write boundaries (W), security (S), process (P), build (B), code (C). Cited by bare ID. |
| **[`.agents/knowledge/index.md`](.agents/knowledge/index.md)** | **THE facts** - what ARDOR is and why, the monorepo layout, design decisions, the gotchas, per-package concepts, conventions, playbooks. |

All three are mandatory, for every agent, on every task. The two rules that cost the most when skipped:
**P-09** every status message opens with the minimap, and **B-05** a downstream test suite runs
`dist`, not `src`.

## Two homes for everything

Nothing lives in two places. Every piece of project information has exactly one home:

- **`.agents/`** - what agents read: ARDOR's rules, the knowledge bundle, the project skills and hooks.
- **`docs/wiki/`** - the human-facing VitePress site: guides, references, changelogs.

Source code is the ground truth for both. When prose and code disagree, the code wins and the prose
is a bug (P-03). The wiki and the bundle are separate audiences; never conflate them (V-C-13).

There are **no per-package agent files** - a package carries no local `CLAUDE.md`. Read its concept
in the knowledge bundle instead.

## The knowledge bundle (`.agents/knowledge/`)

Canonical, tool-neutral facts for ARDOR, in Open Knowledge Format (markdown + YAML frontmatter, one
concept per file, links are the graph edges). Start at `.agents/knowledge/index.md`.

It is also served over MCP by **`ardor-atlas`** (registered in `.mcp.json`): the IGNIS atlas
(`@venizia/ignis-atlas`) run against this checkout - one server, two frameworks - answering over the
wiki, the changelogs and this bundle:

| Tool | Use it for |
|---|---|
| `search` | Find a chunk by keyword - pass `corpus: "knowledge"` to search this bundle only |
| `get` | Read one chunk in full, by the id a search hit returned |
| `symbol` | An exported symbol's package, signature and source `file:line` |
| `version` | The `@venizia/*` versions a project declares and has installed, next to the newest release |
| `changes` | The changelog entries between two versions of one package, or between two dates |

The full contract, and what goes stale, is in [Atlas MCP server](.agents/knowledge/reference/atlas-mcp.md).

Maintaining it is rule P-03: change a fact in the code, update the concept and `log.md` in the same
change. Generated content comes from `make okf-gen`; `make okf-check` validates and is not a commit
gate. The `knowledge-sync` skill (shipped by VULCAN) re-verifies the bundle against the code
periodically, with ARDOR's [area map](.agents/knowledge/process/knowledge-sync-areas.md).

## Shared agent assets (`.agents/`)

```
.agents/
├── rules.md          # ARDOR's rules - W · S · P · B · C, cited by ID, on top of the VULCAN base
├── knowledge/        # THE knowledge bundle
├── knowledge-tools/  # ARDOR's okf gen · check · coverage · viz (until VULCAN's okf reads the config)
├── skills/           # ARDOR's own skills (update-wiki) - linked into .claude/skills/ by vulcan-sync
├── hooks/            # ARDOR's own hooks (minimap.ts) - registered in .configs/vulcan.config.ts
└── plans/            # gitignored - saved specs and plans, local to each developer
```

VULCAN ships the shared skills (`knowledge-sync`, `docs-writing`) and hooks (the rules digest,
`guard-writes`); a project adds its own and never redefines a shipped one. A skill is a procedure
you follow; a concept is material you consult. Neither is duplicated in the other. Before adding a
skill, check the task is not already covered by one here, by VULCAN or by Claude Code.

## Per-tool files (CLAUDE.md)

This `AGENTS.md` is the single source. `make vulcan-sync` writes `CLAUDE.md` as one line,
`@AGENTS.md`, never a copy. `.claude/` is gitignored, so what everyone shares is declared in
`.configs/vulcan.config.ts` and merged into your `.claude/settings.json` by the same sync, over your
personal keys: VULCAN's rules digest, ARDOR's minimap hook, and `guard-writes`, which asks before
a database write, a deploy or a mutating HTTP call. Nothing else blocks a command.
