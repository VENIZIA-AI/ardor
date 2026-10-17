---
title: ARDOR's agent tooling is VULCAN
description: The ARDOR repository sets up coding agents through VULCAN (@venizia/vulcan) - the shared rules, hooks and skills of every VENIZIA project - instead of its own setup script. Nothing changes for an application that uses ARDOR.
---

# Changelog - 2026-10-17

## ARDOR's agent tooling is VULCAN

<Badge type="tip" text="Enhancement" />

**In one line.** `make vulcan-sync` replaces ARDOR's own agent setup script, and the coding style ARDOR shared with IGNIS now comes from the VULCAN base rules.

```bash
bun install
make vulcan-sync     # writes CLAUDE.md, .claude/settings.json and the skill links
make vulcan-doctor   # vulcan doctor: OK
```

## What changed

- **VULCAN sets up your agent.** `@venizia/vulcan` is a root dev dependency, configured in `.configs/vulcan.config.ts`. `make vulcan-sync` (alias `make agent-setup`) writes the gitignored adapters. `make vulcan-doctor` checks the repository follows VULCAN, and CI runs it.
- **The rules come in two layers.** The VULCAN base rules ship in `node_modules/@venizia/vulcan/base/rules.md` and are cited `V-...`. `.agents/rules.md` keeps only what ARDOR adds. The coding rules C-01, C-02, C-04 and C-06 to C-17 are now V-C-01, V-C-02, V-C-04 and V-C-06 to V-C-17. C-03, C-05 and C-18 stay ARDOR's.
- **The shared skills and hooks ship with VULCAN.** `knowledge-sync` and `docs-writing` are VULCAN skills. VULCAN's session hook prints the rules, and its `guard-writes` hook asks before a database write, a deploy or a mutating HTTP call. ARDOR adds `update-wiki` (now in `.agents/skills/`) and a hook that prints the minimap shape.
- **`.agents/plugin/` is gone.** The setup script, the shared settings, the session hook and ARDOR's copy of `knowledge-sync` were replaced by VULCAN's.

## Who is affected

- **Applications that use ARDOR.** No action needed. The published packages and their API are unchanged.
- **Contributors to the ARDOR repository.**
  - Run `make vulcan-sync` after you pull. Repeat it until every line reads `unchanged` - VULCAN 0.1.0-0 can need three runs.
  - Delete the SessionStart entry for `.agents/plugin/claude/hooks/session-start.ts` from your `.claude/settings.json`. The file no longer exists, and the sync keeps entries it did not write.
  - Cite the coding rules by their `V-C-` IDs.

## Details

VULCAN 0.1.0-0's `okf` and `atlas` tools do not read the project config yet; on ARDOR they would render IGNIS's packages. Until they do, `scripts/vulcan-bridge.ts` sends the `okf-*`, `surface-*`, `symbols-*` and `releases-*` targets to ARDOR's own generators. The target names stay the same.

| File | Package |
|------|---------|
| `package.json`, `Makefile`, `make/knowledge.mk`, `make/help.mk`, `.configs/vulcan.config.ts` | repository |
| `scripts/vulcan-bridge.ts`, `.github/workflows/ci.yml` | repository |
| `.agents/rules.md`, `.agents/skills/`, `.agents/hooks/`, `AGENTS.md`, `CONTRIBUTING.md` | repository |
