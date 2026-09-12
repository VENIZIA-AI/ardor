.PHONY: all build build-all kernel react admin ardor ui-kit docs \
        agent-setup okf-check okf-gen okf-coverage okf-viz split-report surface-gen surface-check \
        wiki-links-check symbols-gen symbols-check releases-gen releases-check atlas-smoke catalog-check purity layer-check size-check examples-check lint-examples purity-test test-scripts lint-scripts \
        test test-all test-kernel test-react test-admin \
        help install clean setup-hooks \
        lint lint-packages \
        lint-kernel lint-react lint-admin lint-ardor lint-ui-kit \
        typecheck typecheck-all \
        update update-all update-kernel update-react update-admin update-ardor update-ui-kit

DEFAULT_GOAL := help

all: build

# ============================================================================
# INSTALL & CLEAN
# ============================================================================
install:
	@echo "📥 Installing dependencies..."
	@bun install
	@echo "✅ Install completed."

clean:
	@echo "🧹 Cleaning all packages..."
	@bun run --filter "*" clean

# ============================================================================
# GIT HOOKS
# ============================================================================
setup-hooks:
	@echo "🔧 Setting up git hooks..."
	@git config core.hooksPath .githooks
	@echo "✅ Git hooks configured to use .githooks directory."

# ============================================================================
# AGENT SETUP, KNOWLEDGE BUNDLE, REPOSITORY GATES
# ============================================================================
agent-setup:
	@bun .agents/plugin/setup.ts

okf-check:
	@bun .agents/knowledge-tools/okf.ts check

okf-gen:
	@bun .agents/knowledge-tools/okf.ts gen

okf-coverage:
	@bun .agents/knowledge-tools/okf.ts coverage

okf-viz:
	@bun .agents/knowledge-tools/okf.ts viz

split-report:
	@bun scripts/split-report.ts

# Reads the built .d.ts of every exports entry; run after `make build-all`.
surface-gen:
	@bun scripts/public-surface.ts gen

surface-check:
	@bun scripts/public-surface.ts check

wiki-links-check:
	@bun scripts/wiki-source-links.ts

# The Atlas `symbol` tool's table. Reads the same built .d.ts surface-gen does; run after a build.
symbols-gen:
	@bun scripts/atlas-symbols.ts gen

symbols-check:
	@bun scripts/atlas-symbols.ts check

# The Atlas `version` / `changes` tools' table, from release commits and changelog pages.
releases-gen:
	@bun scripts/atlas-releases.ts gen

releases-check:
	@bun scripts/atlas-releases.ts check

# Proves the atlas can be run from the IGNIS checkout against this repository.
atlas-smoke:
	@bun scripts/atlas-smoke.ts

catalog-check:
	@bun scripts/check-catalog.ts

purity:
	@echo "🔍 Checking browser purity for all claimed entries..."
	@bun scripts/purity/cli.ts

layer-check:
	@bun scripts/layer-boundaries.ts

# Bundle budgets, measured brotlied with every third-party peer external; run after a build.
size-check:
	@bun run --filter "@venizia/ardor-kernel" size
	@bun run --filter "@venizia/ardor-react" size
	@bun run --filter "@venizia/ardor-admin" size
	@bun run --filter "@venizia/ardor" size

purity-test:
	@echo "🔍 Running the purity probe's regression tests..."
	@bun test scripts/purity/__tests__

test-scripts:
	@echo "🔍 Running the repository gate scripts' regression tests..."
	@bun test scripts/__tests__

lint-scripts:
	@echo "🔍 Linting scripts/..."
	@bunx prettier --config scripts/.prettierrc.mjs -l 'scripts/**/*.ts'
	@bunx tsc -p scripts/tsconfig.json

# ============================================================================
# BUILD TARGETS
# A downstream package type-checks against the dist of its dependency, never its src, so the
# order below is the dependency order and must not be parallelised.
# ============================================================================
build: build-all

build-all: kernel react admin ardor ui-kit
	@echo "🚀 All packages rebuilt successfully."

kernel:
	@echo "📦 Rebuilding @venizia/ardor-kernel..."
	@bun run --filter "@venizia/ardor-kernel" rebuild

react: kernel
	@echo "📦 Rebuilding @venizia/ardor-react..."
	@bun run --filter "@venizia/ardor-react" rebuild

admin: react
	@echo "📦 Rebuilding @venizia/ardor-admin..."
	@bun run --filter "@venizia/ardor-admin" rebuild

ardor: admin
	@echo "📦 Rebuilding @venizia/ardor..."
	@bun run --filter "@venizia/ardor" rebuild

ui-kit:
	@echo "📦 Rebuilding @venizia/ardor-ui-kit..."
	@bun run --filter "@venizia/ardor-ui-kit" rebuild

docs:
	@echo "📦 Rebuilding wiki (VitePress)..."
	@bun run --filter "@venizia/ardor-docs" docs:build

# ============================================================================
# TEST TARGETS (Bun test runner only)
# ============================================================================
test: test-all

test-all: test-kernel test-react test-admin

test-kernel:
	@cd packages/kernel && bun run test $(BUN_TEST_FLAGS)

test-react:
	@cd packages/react && bun run test $(BUN_TEST_FLAGS)

test-admin:
	@cd packages/admin && bun run test $(BUN_TEST_FLAGS)

# ============================================================================
# TYPECHECK TARGETS
# ============================================================================
typecheck: typecheck-all

typecheck-all:
	@echo "🔎 Type-checking all packages..."
	@bun run --filter "./packages/*" typecheck

# ============================================================================
# FORCE UPDATE TARGETS - ARDOR tracks the HIGHEST published IGNIS line (prerelease included),
# never `latest`. `update` refreshes the root catalog first; per-package force-update skips
# catalogued ranges by design.
# ============================================================================
update:
	@echo "🔄 Moving every @venizia/* catalog entry to the highest published version..."
	@bun scripts/refresh-catalog.ts highest
	@bun run --filter "@venizia/*" force-update highest
	@bun install
	@echo "✅ Update completed."

update-all: update

update-kernel:
	@echo "🔄 Force updating @venizia/ardor-kernel..."
	@bun run --filter "@venizia/ardor-kernel" force-update highest

update-react:
	@echo "🔄 Force updating @venizia/ardor-react..."
	@bun run --filter "@venizia/ardor-react" force-update highest

update-admin:
	@echo "🔄 Force updating @venizia/ardor-admin..."
	@bun run --filter "@venizia/ardor-admin" force-update highest

update-ardor:
	@echo "🔄 Force updating @venizia/ardor..."
	@bun run --filter "@venizia/ardor" force-update highest

update-ui-kit:
	@echo "🔄 Force updating @venizia/ardor-ui-kit..."
	@bun run --filter "@venizia/ardor-ui-kit" force-update highest

# ============================================================================
# LINT TARGETS
# ============================================================================
lint: lint-packages lint-examples
	@echo "✅ Linting completed."

lint-packages:
	@echo "🔍 Linting all packages..."
	@bun run --filter "./packages/*" lint

lint-examples:
	@echo "🔍 Linting examples/..."
	@bun run --filter "./examples/*" lint

# Every example type-checks and builds against the built packages (dist, never src).
examples-check:
	@bun run --filter "./examples/*" build

lint-kernel:
	@echo "🔍 Linting @venizia/ardor-kernel..."
	@bun run --filter "@venizia/ardor-kernel" lint

lint-react:
	@echo "🔍 Linting @venizia/ardor-react..."
	@bun run --filter "@venizia/ardor-react" lint

lint-admin:
	@echo "🔍 Linting @venizia/ardor-admin..."
	@bun run --filter "@venizia/ardor-admin" lint

lint-ardor:
	@echo "🔍 Linting @venizia/ardor..."
	@bun run --filter "@venizia/ardor" lint

lint-ui-kit:
	@echo "🔍 Linting @venizia/ardor-ui-kit..."
	@bun run --filter "@venizia/ardor-ui-kit" lint

# ============================================================================
# HELP
# ============================================================================
help:
	@echo "Makefile for the ARDOR Monorepo"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main Targets:"
	@printf "  %-25s - %s\n" "all" 							"Alias for 'build'."
	@printf "  %-25s - %s\n" "build" 						"Rebuilds all packages (alias for 'build-all')."
	@printf "  %-25s - %s\n" "build-all" 				"Rebuilds all packages in dependency order."
	@printf "  %-25s - %s\n" "install" 					"Install all dependencies with bun."
	@printf "  %-25s - %s\n" "clean" 						"Clean build artifacts from all packages."
	@printf "  %-25s - %s\n" "typecheck" 				"Type-check every package without emitting."
	@printf "  %-25s - %s\n" "test" 						"Run every package test suite (alias for test-all)."
	@printf "  %-25s - %s\n" "docs" 						"Build the wiki (VitePress) with the sidebar gate."
	@printf "  %-25s - %s\n" "agent-setup" 			"Link AGENTS.md, skills and the session hook for your agent."
	@printf "  %-25s - %s\n" "surface-check" 		"Compare the built public surface against the snapshot."
	@printf "  %-25s - %s\n" "purity" 					"Probe kernel/react/admin dist for Node builtins and ra-core leaks."
	@printf "  %-25s - %s\n" "catalog-check" 		"Guard dependency versions against the root catalog."
	@printf "  %-25s - %s\n" "okf-check" 				"Validate the agent knowledge bundle."
	@printf "  %-25s - %s\n" "setup-hooks" 			"Configure git to use .githooks directory."
	@echo ""
	@echo "Force Update (fetch latest from NPM):"
	@printf "  %-25s - %s\n" "update" 					"Force update all packages from NPM registry."
	@printf "  %-25s - %s\n" "update-kernel" 		"Force update @venizia/ardor-kernel dependencies."
	@printf "  %-25s - %s\n" "update-react" 		"Force update @venizia/ardor-react dependencies."
	@printf "  %-25s - %s\n" "update-admin" 		"Force update @venizia/ardor-admin dependencies."
	@printf "  %-25s - %s\n" "update-ardor" 		"Force update @venizia/ardor dependencies."
	@printf "  %-25s - %s\n" "update-ui-kit" 		"Force update @venizia/ardor-ui-kit dependencies."
	@echo ""
	@echo "Individual Package Builds:"
	@printf "  %-25s - %s\n" "kernel" 					"Rebuilds @venizia/ardor-kernel (isomorphic core)."
	@printf "  %-25s - %s\n" "react" 						"Rebuilds @venizia/ardor-react (React bindings)."
	@printf "  %-25s - %s\n" "admin" 						"Rebuilds @venizia/ardor-admin (react-admin adapter)."
	@printf "  %-25s - %s\n" "ardor" 						"Rebuilds @venizia/ardor (umbrella entry point)."
	@printf "  %-25s - %s\n" "ui-kit" 					"Rebuilds @venizia/ardor-ui-kit (design system)."
	@echo ""
	@echo "Linting:"
	@printf "  %-25s - %s\n" "lint" 						"Lint all packages (alias for lint-packages)."
	@printf "  %-25s - %s\n" "lint-packages" 		"Lint packages/ directory only."
	@printf "  %-25s - %s\n" "lint-kernel" 			"Lint @venizia/ardor-kernel."
	@printf "  %-25s - %s\n" "lint-react" 			"Lint @venizia/ardor-react."
	@printf "  %-25s - %s\n" "lint-admin" 			"Lint @venizia/ardor-admin."
	@printf "  %-25s - %s\n" "lint-ardor" 			"Lint @venizia/ardor."
	@printf "  %-25s - %s\n" "lint-ui-kit" 			"Lint @venizia/ardor-ui-kit."
	@echo ""
	@echo "Other:"
	@printf "  %-25s - %s\n" "help" 						"Show this help message."
