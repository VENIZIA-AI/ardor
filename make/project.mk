# The shared build, lint and format targets of one package. A package Makefile includes this file:
#
#   include ../../make/project.mk
#
# Every tool comes from the package's node_modules/.bin, by absolute path: a recipe never depends on
# PATH (`sh ./scripts/build.sh` once died at `tsc-alias: not found`). The one exception is bun itself,
# which runs every recipe. Type checking is `bun check` (same diagnostics as `tsc --noEmit`, a
# fraction of the time); tsc still emits the JS and the .d.ts.
#
# Two programs per package. tsconfig.json type-checks src and the tests (Bun reads it too);
# .configs/tsconfig.build.json emits dist without the tests - a dist that carries __tests__ makes
# `bun test` run every test twice.

BIN := $(CURDIR)/node_modules/.bin
TSC := $(BIN)/tsc
TYPECHECK := bun check --no-pretty
BUILD_TSCONFIG := .configs/tsconfig.build.json

FMT_GLOB := "**/*.{ts,mts,tsx,js,mjs}"

# Paths a package keeps out of lint and format (relative to the package, `vulcan-preset/files/**`): the
# template of a generated app is linted by that app's own checks, not by the package.
LINT_IGNORE ?=
IGNORE_FLAGS = $(foreach pattern,$(LINT_IGNORE),--ignore-pattern '$(pattern)')
FMT_IGNORE = $(foreach pattern,$(LINT_IGNORE), "!$(pattern)")

.PHONY: build typecheck clean rebuild lint fmt size

# The build program too: it drops the Bun types, so a Bun global in src fails here, not in a consumer.
typecheck:
	@$(TYPECHECK) -p tsconfig.json
	@$(TYPECHECK) -p $(BUILD_TSCONFIG)

# tsc-alias reads the ROOT tsconfig: pointed at a .configs/ file it resolves `paths` against
# .configs/ and leaves every `@/` import unrewritten. --resolve-full-paths: Node's ESM loader refuses
# `./base` and `./base/index` and wants `./base/index.js`, which tsc leaves as written.
build:
	@echo "START | Building $(notdir $(CURDIR))..."
	@$(TSC) -p $(BUILD_TSCONFIG) --extendedDiagnostics
	@$(BIN)/tsc-alias -p tsconfig.json --resolve-full-paths
	@echo "DONE | Build completed successfully!"

# A stale .tsbuildinfo next to a .configs/ tsconfig makes tsc think it is up to date and emit
# nothing - a "DONE" build with an empty dist.
clean:
	@rm -rf dist *.tsbuildinfo .configs/*.tsbuildinfo

# Type-check before cleaning: a failure after clean leaves an empty dist, which looks like a hundred
# unrelated import failures downstream.
rebuild: typecheck clean
	@$(MAKE) --no-print-directory build

lint:
	@$(BIN)/oxlint -c .configs/oxlint.config.mts --deny-warnings $(IGNORE_FLAGS) .
	@$(BIN)/eslint -c .configs/eslint.config.mjs $(IGNORE_FLAGS) .
	@$(BIN)/oxfmt -c .configs/oxfmt.config.mts --check $(FMT_GLOB)$(FMT_IGNORE)

fmt:
	@$(BIN)/oxlint -c .configs/oxlint.config.mts --fix $(IGNORE_FLAGS) .
	@$(BIN)/eslint -c .configs/eslint.config.mjs --fix $(IGNORE_FLAGS) .
	@$(BIN)/oxfmt -c .configs/oxfmt.config.mts $(FMT_GLOB)$(FMT_IGNORE)

# Bundle budget from the package.json "size-limit" block, brotlied, every third-party peer external.
size:
	@$(BIN)/size-limit
