---
title: Every package builds, lints and formats through make
description: The ARDOR repository adopts the IGNIS make layout - a one-line Makefile per package over make/project.mk, a root Makefile split into make/*.mk, and the build tsconfig in .configs/. Nothing changes for an application that uses ARDOR.
packages: ['@venizia/ardor-kernel']
---

# Changelog - 2026-10-16

## Every package builds, lints and formats through make

<Badge type="tip" text="Enhancement" />

**In one line.** ARDOR now builds the way IGNIS does: each package is driven by `make/project.mk`, and every per-package target comes from one `PACKAGES` list.

```makefile
# packages/kernel/Makefile
include ../../make/project.mk
```

## What changed

- **One include per package.** `make/project.mk` holds `build`, `typecheck`, `clean`, `rebuild`, `lint`, `fmt` and `size`. Every tool runs from the package's `node_modules/.bin` by absolute path. A package `package.json` keeps only `force-update` and `prepublishOnly` (`make rebuild`). `scripts/build.sh`, `clean.sh` and `rebuild.sh` are gone.
- **The root Makefile is split.** `make/build.mk`, `knowledge.mk`, `release.mk`, `lint.mk`, `test.mk` and `help.mk` each hold one job. `lint-<pkg>`, `fmt-<pkg>`, `test-<pkg>`, `purity-<pkg>` (new), `clean-install-<pkg>` and `update-<pkg>` are generated from `PACKAGES := kernel react admin ardor`. A bare `make` prints the target list.
- **Two tsconfigs per package.** The root `tsconfig.json` type-checks `src` and the tests, with the Bun types. `.configs/tsconfig.build.json` emits `dist` without them. `tsconfig.test.json` and the root `tsconfig.build.json` are gone. The four `dist` trees are byte-identical to the previous build.
- **The test command lives in make.** `make test-<pkg>` runs `bun test` with `.env.test` and the setup preload. No package has a `test` script any more.
- **Examples run outside make.** `bun scripts/examples.ts check` lints and type-checks every example; `build` builds them. The pre-commit hook runs `make lint-all` and then `examples.ts check`.

## Who is affected

- **Applications that use ARDOR.** No action needed. The published packages and their API are unchanged.
- **Contributors to the ARDOR repository.**
  - `bun run lint:fix` becomes `make fmt` (or `make fmt-<pkg>`).
  - `bun run build` inside a package becomes `make <pkg>`.
  - `bun run test` becomes `make test-<pkg>`.
  - `make lint-all` now also lints `docs/wiki`.

## Details

- **Bun's async matchers.** Since the root tsconfig carries the Bun types, type-aware lint now sees test code fully. Bun types `rejects` and `resolves` as `void`, so `await expect(task).rejects.toThrow()` fails `await-thenable`. Tests now write `expect(await task)`, or `expect(await rejectionOf(task))` with a helper in `src/__tests__/rejection.ts`, without a cast.
- **Release scope.** `scripts/release-scope.ts` counts a change to `tsconfig.json` or `.configs/tsconfig.build.json` as a reason to release.

| File | Package |
|------|---------|
| `Makefile`, `make/*.mk` | repository |
| `Makefile`, `tsconfig.json`, `.configs/tsconfig.build.json`, `package.json` | kernel, react, admin, ardor |
| `scripts/examples.ts`, `scripts/release-scope.ts`, `.githooks/pre-commit`, `.github/workflows/ci.yml` | repository |
| `src/__tests__/rejection.ts` | kernel, admin |
