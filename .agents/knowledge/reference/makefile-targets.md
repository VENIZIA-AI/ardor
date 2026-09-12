---
type: Reference
title: Makefile targets
description: Every make target, its prerequisites, and what it does (generated).
resource: Makefile
tags: [reference, make, build]
---

> Generated from source - do not edit; run `make okf-gen`. Playbook: [build system](/process/build-system.md).

**57 targets.**

| Target | Depends on | Description |
|---|---|---|
| `make all` | `build` | - |
| `make install` | - | Installing dependencies |
| `make clean` | - | Cleaning all packages |
| `make setup-hooks` | - | Setting up git hooks |
| `make agent-setup` | - | - |
| `make okf-check` | - | - |
| `make okf-gen` | - | - |
| `make okf-coverage` | - | - |
| `make okf-viz` | - | - |
| `make split-report` | - | - |
| `make surface-gen` | - | - |
| `make surface-check` | - | - |
| `make wiki-links-check` | - | - |
| `make symbols-gen` | - | - |
| `make symbols-check` | - | - |
| `make releases-gen` | - | - |
| `make releases-check` | - | - |
| `make atlas-smoke` | - | - |
| `make catalog-check` | - | - |
| `make purity` | - | Checking browser purity for all claimed entries |
| `make layer-check` | - | - |
| `make size-check` | - | - |
| `make purity-test` | - | Running the purity probe's regression tests |
| `make test-scripts` | - | Running the repository gate scripts' regression tests |
| `make lint-scripts` | - | Linting scripts/ |
| `make build` | `build-all` | - |
| `make build-all` | `kernel react admin ardor ui-kit` | All packages rebuilt successfully. |
| `make kernel` | - | Rebuilding @venizia/ardor-kernel |
| `make react` | `kernel` | Rebuilding @venizia/ardor-react |
| `make admin` | `react` | Rebuilding @venizia/ardor-admin |
| `make ardor` | `admin` | Rebuilding @venizia/ardor |
| `make ui-kit` | - | Rebuilding @venizia/ardor-ui-kit |
| `make docs` | - | Rebuilding wiki (VitePress) |
| `make test` | `test-all` | - |
| `make test-all` | `test-kernel test-react test-admin` | - |
| `make test-kernel` | - | - |
| `make test-react` | - | - |
| `make test-admin` | - | - |
| `make typecheck` | `typecheck-all` | - |
| `make typecheck-all` | - | Type-checking all packages |
| `make update` | - | Moving every @venizia/* catalog entry to the highest published version |
| `make update-all` | `update` | - |
| `make update-kernel` | - | Force updating @venizia/ardor-kernel |
| `make update-react` | - | Force updating @venizia/ardor-react |
| `make update-admin` | - | Force updating @venizia/ardor-admin |
| `make update-ardor` | - | Force updating @venizia/ardor |
| `make update-ui-kit` | - | Force updating @venizia/ardor-ui-kit |
| `make lint` | `lint-packages lint-examples` | Linting completed. |
| `make lint-packages` | - | Linting all packages |
| `make lint-examples` | - | Linting examples/ |
| `make examples-check` | - | - |
| `make lint-kernel` | - | Linting @venizia/ardor-kernel |
| `make lint-react` | - | Linting @venizia/ardor-react |
| `make lint-admin` | - | Linting @venizia/ardor-admin |
| `make lint-ardor` | - | Linting @venizia/ardor |
| `make lint-ui-kit` | - | Linting @venizia/ardor-ui-kit |
| `make help` | - | Makefile for the ARDOR Monorepo |
