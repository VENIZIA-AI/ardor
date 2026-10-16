---
type: Playbook
title: Git workflow
description: Branch naming, commit style, PR target, and the pre-commit hook for ARDOR.
resource: CONTRIBUTING.md
tags: [process, git, contributing]
---

## Steps

1. Sync with `develop` before branching: `git fetch upstream && git checkout develop && git merge
   upstream/develop` (or `origin` if you have direct push access), then branch off it.
2. Name the branch by its kind:
   - `feature/description` for new features
   - `fix/description` for bug fixes
   - `docs/description` for documentation-only changes
   - `chore/description` for maintenance (deps, config)
3. Commit using Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
4. Before committing, run `make build` and fix lint to catch style and type issues early - the
   pre-commit hook (below) will block a commit that fails lint anyway. `make fmt` applies the lint
   fixes and oxfmt to every package (`make fmt-<pkg>` for one, `make fmt-wiki` for the wiki); an
   example keeps its own `lint:fix` script.
5. If git hooks aren't wired up yet, run `make setup-hooks` once - it runs `git config
   core.hooksPath .githooks`, pointing git at the repo's `.githooks/` directory instead of
   `.git/hooks/`.
6. `.githooks/pre-commit` then runs on every commit: it `cd`s to the repo root and runs `make
   lint-all` (the four packages, `docs/wiki` and `scripts/`) and then `bun scripts/examples.ts
   check` (every example's lint and typecheck, so it needs a build) under `set -e` - any lint
   failure aborts the commit before it is created. That is the hook's only check - no test step and
   no other gate. The tests and the remaining gates (purity, size-check and the rest) run only in
   the manually dispatched CI workflow (see [Testing](/process/testing.md)) or when you run them
   yourself; nothing runs them automatically. The release workflow runs none of them either - it
   rebuilds through the Makefile dependency chain, lints only the released package and checks its
   `dist` artifacts (see [release and publish](/process/release-publish.md)). The gate list lives in
   the Repository gates section of [Build, run, test](/overview/build-run-test.md).
7. Push the branch and open a Pull Request that targets `develop`. Never target `main` - `main`
   only accepts merges FROM `develop`, and releases off it are tagged in git (see
   [release and publish](/process/release-publish.md) for the actual per-package release
   mechanism, which is separate from `main`/`develop` merges).
8. PR title should also follow Conventional Commits format (e.g. `feat: add data provider retry
   logic`). Include what and why in the description, link related issues, and clearly call out
   breaking changes - especially anything that touches `RequestMethods`/`RequestTypes` in
   `packages/kernel/src/common/constants.ts`, the data provider pipeline, or public hook/service
   signatures, since those are consumed directly by app code built on ARDOR.

## Related

- [Release and publish](/process/release-publish.md)
- [Build system](/process/build-system.md)
- [Testing](/process/testing.md)
