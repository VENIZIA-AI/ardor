---
title: ARDOR's agent tooling is VULCAN
description: The ARDOR repository sets up coding agents, its knowledge bundle and its atlas through VULCAN instead of its own scripts. Nothing changes for an application that uses ARDOR.
packages: []
---

# Changelog - 2026-10-17

## ARDOR's agent tooling is VULCAN

<Badge type="tip" text="Enhancement" />

**In one line.** ARDOR's own agent setup script, generators and atlas tables are replaced by `@venizia/vulcan`, configured by one file in the repository.

```bash
bun install
make vulcan-sync     # writes CLAUDE.md, .claude/settings.json and the skill links
make vulcan-doctor   # vulcan doctor: OK
```

## What changed

- **VULCAN is a root dev dependency**, pinned to its 0.2.0 prereleases that day, and configured in `.configs/vulcan.config.ts` (renamed `.mts` with VULCAN 0.3.0): the rule slot, the knowledge roots, the `packages` list and the atlas sources. `make vulcan-sync` (alias `make agent-setup`) writes the gitignored adapters, `make vulcan-doctor` checks the repository follows VULCAN, and CI runs the doctor.
- **The rules come in two layers.** The VULCAN base rules ship in `node_modules/@venizia/vulcan/base/rules.md` and are cited `V-...`. `.agents/rules.md` keeps only what ARDOR adds: the coding rules C-01, C-02, C-04 and C-06 to C-17 became V-C-01, V-C-02, V-C-04 and V-C-06 to V-C-17, C-03, C-05 and C-18 stay ARDOR's, and the wiki rules are a D group (D-01 to D-05; D-05 is ARDOR's: build the packages before the docs gates, because every `ts` fence compiles against `dist`).
- **The knowledge bundle is rendered from the config.** `make okf-gen` renders the reference pages, ARDOR's two page renderers live in `.agents/okf/`, and CI checks the bundle with `make okf-check-strict`. Every changelog entry names its packages in its frontmatter (`packages: []` for an entry about the repository tooling).
- **The atlas is VULCAN's.** `.mcp.json` runs `vulcan x atlas mcp`, and `atlas.sources` adds IGNIS's `develop` branch. The tables ARDOR committed (`reference/symbols.json`, `reference/releases.json`) are no longer committed, and `scripts/release.ts` no longer refreshes them.
- **What was deleted.** `.agents/plugin/`, `.agents/knowledge-tools/`, `scripts/vulcan-bridge.ts`, ARDOR's `update-wiki` skill (VULCAN's `docs-update` replaces it) and the minimap hook (the minimap block of `.agents/rules.md` prints with the rules).

## Who is affected

- **Applications that use ARDOR.** No action needed. The published packages and their API are unchanged.
- **Contributors to the ARDOR repository.**
  - Run `bun install`, then `make vulcan-sync`, after you pull. Repeat the sync until every line reads `unchanged`.
  - Run `bun x vulcan sync --prune` once, to remove the stale minimap and `update-wiki` entries from your `.claude/settings.json`, and delete the SessionStart entry for `.agents/plugin/claude/hooks/session-start.ts`.
  - Cite the coding rules by their `V-C-` IDs.

## Details

| File | Package |
|------|---------|
| `package.json`, `Makefile`, `make/knowledge.mk`, `make/help.mk`, `.configs/vulcan.config.ts` | repository |
| `.mcp.json`, `.github/workflows/ci.yml` | repository |
| `.agents/rules.md`, `.agents/okf/`, `AGENTS.md`, `CONTRIBUTING.md` | repository |
