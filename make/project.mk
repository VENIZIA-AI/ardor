# The shared build, lint and format targets of one package. A package Makefile includes this file:
#
#   include ../../make/project.mk
#
# Every tool comes from the package's node_modules/.bin, by absolute path: a recipe never depends on
# PATH (`sh ./scripts/build.sh` once died at `tsc-alias: not found`). The one exception is bun itself,
# which runs every recipe. Type checking is `bun check` (same diagnostics as `tsc --noEmit`, a
# fraction of the time); tsc still emits the JS and the .d.ts.
#
# Every library package exposes the same targets: build, typecheck, lint, lint-fix, test and clean
# (rebuild and size are extras). An app uses package.json scripts instead; see the
# knowledge page "App script standard".
#
# Two programs per package. tsconfig.json type-checks src and the tests (Bun reads it too);
# .configs/builders/tsconfig.build.json emits dist without the tests - a dist that carries __tests__ makes
# `bun test` run every test twice.

BIN := $(CURDIR)/node_modules/.bin
TSC := $(BIN)/tsc
TYPECHECK := bun check --no-pretty
BUILD_TSCONFIG := .configs/builders/tsconfig.build.json
# Further build programs of one package, each with its own types: a Node-only entry cannot share the
# browser program, whose `types` is empty. They are type-checked and emitted like the main one.
EXTRA_BUILD_TSCONFIGS ?=

# The style is the [fmt] section of the root bunfig.toml: bun fmt finds it from this folder up. A bare `bun fmt`
# also formats markdown, so the glob is always given: every type bun fmt supports except markdown, and it reaches
# package.json, whose keys bun fmt sorts.
# --no-script runs the formatter even if a package has an `fmt` script.
FMT_GLOB := "**/*.{ts,mts,tsx,js,mjs,json,jsonc,yml,yaml,css,html,vue}"
BUN_FMT := bun fmt --no-script

.PHONY: build typecheck clean rebuild lint lint-fix test size

# The build program too: it drops the Bun types, so a Bun global in src fails here, not in a consumer.
typecheck:
	@$(TYPECHECK) -p tsconfig.json
	@$(TYPECHECK) -p $(BUILD_TSCONFIG)
	@$(foreach config,$(EXTRA_BUILD_TSCONFIGS),$(TYPECHECK) -p $(config) &&) true

# tsc-alias reads the ROOT tsconfig: pointed at a .configs/ file it resolves `paths` against
# .configs/ and leaves every `@/` import unrewritten. --resolve-full-paths: Node's ESM loader refuses
# `./base` and `./base/index` and wants `./base/index.js`, which tsc leaves as written.
build:
	@echo "START | Building $(notdir $(CURDIR))..."
	@$(TSC) -p $(BUILD_TSCONFIG) --extendedDiagnostics
	@$(foreach config,$(EXTRA_BUILD_TSCONFIGS),$(TSC) -p $(config) &&) true
	@$(BIN)/tsc-alias -p tsconfig.json --resolve-full-paths
	@echo "DONE | Build completed successfully!"

# A stale .tsbuildinfo next to a .configs/ tsconfig makes tsc think it is up to date and emit
# nothing - a "DONE" build with an empty dist.
clean:
	@rm -rf dist *.tsbuildinfo .configs/builders/*.tsbuildinfo

# Type-check before cleaning: a failure after clean leaves an empty dist, which looks like a hundred
# unrelated import failures downstream.
rebuild: typecheck clean
	@$(MAKE) --no-print-directory build

lint:
	@$(BIN)/oxlint -c .configs/lints/oxlint.config.mts --deny-warnings .
	@$(BIN)/eslint -c .configs/lints/eslint.config.mjs .
	@$(BUN_FMT) --check $(FMT_GLOB)

lint-fix:
	@$(BIN)/oxlint -c .configs/lints/oxlint.config.mts --fix .
	@$(BIN)/eslint -c .configs/lints/eslint.config.mjs --fix .
	@$(BUN_FMT) $(FMT_GLOB)

# The test-only settings (B-08) are set here, in the test command, and the preload installs the package's DOM or
# storage stub: a bare `bun test` inside a package skips both and may fail.
# BUN_TEST_FLAGS is an optional pass-through (`--isolate`, `--parallel`). Needs a build first (B-05).
# A package with no suite sets `HAS_TESTS := no` before the include.
HAS_TESTS ?= yes
BUN_TEST_FLAGS ?=
# Where bun looks for tests, default the whole package. `ardor` limits it to src: its dist holds the
# preset's own test files, which only run inside a generated app.
TEST_PATHS ?=

test:
ifeq ($(HAS_TESTS),yes)
	@NODE_ENV=test bun test --preload ./src/__tests__/setup.ts $(BUN_TEST_FLAGS) $(TEST_PATHS)
else
	@echo "ℹ️  No test suite in this package - skipping."
endif

# Bundle budget from the package.json "size-limit" block, brotlied, every third-party peer external.
size:
	@$(BIN)/size-limit
