---
title: The unused scripts and make targets are gone
description: ARDOR's repository drops the examples runner and the scripts and make targets nothing called, keeps the examples' format checked, and runs the atlas smoke in CI.
packages: []
---

# Changelog - 2026-10-24

## The unused scripts and make targets are gone

<Badge type="info" text="Enhancement" />

**In one line.** The repository's own tooling lost the scripts and make targets that nothing called, the examples runner among them, and `make lint-fix` now fixes the wiki too.

## What changed

- **No examples runner.** `scripts/examples.ts` is deleted with the pre-commit step and the two CI steps that ran it. Nothing builds or type-checks the three examples any more; each keeps its own `compile` and `typecheck` scripts for use by hand, and `make lint-files` still checks their format.
- **Unused scripts deleted.** `scripts/release-local.ts` (publishing from a developer machine; a release goes through `scripts/release.ts` and the workflow only), `.github/scripts/test-release.ts` (no caller), `docs/wiki/scripts/docs-rebuild.sh` (no reference) and the wiki's `docs:check-sidebar` script (the build runs the check itself) are gone.
- **Unused targets deleted.** `make all` (an alias of `make build`), `make update` and `make update-all` are gone; the release workflow already runs `scripts/refresh-catalog.ts` and `force-update` itself, and `make update-<pkg>` stays for one package.
- **`make lint-fix` covers the wiki.** It now runs `lint-fix-wiki` next to the packages, as `make lint-all` already ran `lint-wiki`.
- **Atlas smoke in CI.** `make atlas-smoke`, which proves the atlas serves this checkout over MCP, is a step of the build job in `ci.yml`, after the build, because its symbol lookup reads the built types.

## Who is affected

- **A maintainer.** A release is only dispatched: `bun scripts/release.ts --version <x.y.z> --issue <N> --yes` (dry run first with `--dry-run`).
- **A contributor.** The pre-commit hook runs `make lint-all` only, which is faster. Replace `make all` with `make build`, and `make update` with `bun scripts/refresh-catalog.ts highest` followed by `bun run --filter "@venizia/*" force-update highest`.
