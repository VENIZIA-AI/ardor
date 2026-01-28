.PHONY: all build build-all admin \
        help install clean setup-hooks \
        lint lint-packages \
        lint-admin \
        update update-all update-admin 

DEFAULT_GOAL := help

all: build

# ============================================================================
# INSTALL & CLEAN
# ============================================================================
install:
	@echo "📥 Installing dependencies (with force-update via postinstall)..."
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
# BUILD TARGETS
# ============================================================================
build: build-all

build-all: admin
	@echo "🚀 All packages rebuilt successfully."

admin:
	@echo "📦 Rebuilding @venizia/ardor-admin..."
	@bun run --filter "@venizia/ardor-admin" rebuild

# ============================================================================
# FORCE UPDATE TARGETS (fetch latest from NPM registry)
# Note: 'bun install' triggers postinstall which runs force-update automatically
# ============================================================================
update: install

update-all: install

update-admin:
	@echo "🔄 Force updating @venizia/ardor-admin..."
	@bun run --filter "@venizia/ardor-admin" force-update

# ============================================================================
# LINT TARGETS
# ============================================================================
lint: lint-packages
	@echo "✅ Linting completed."

lint-packages:
	@echo "🔍 Linting all packages..."
	@bun run --filter "./packages/*" lint

lint-admin:
	@echo "🔍 Linting @venizia/ardor-admin..."
	@bun run --filter "@venizia/ardor-admin" --elide-lines=0 lint

# ============================================================================
# HELP
# ============================================================================
help:
	@echo "Makefile for the @venizia/ardor Monorepo"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main Targets:"
	@printf "  %-25s - %s\n" "all" 							"Alias for 'build'."
	@printf "  %-25s - %s\n" "build" 						"Rebuilds all packages (alias for 'build-all')."
	@printf "  %-25s - %s\n" "build-all" 				"Rebuilds all packages in the correct order."
	@printf "  %-25s - %s\n" "install" 					"Install all dependencies with bun."
	@printf "  %-25s - %s\n" "clean" 						"Clean build artifacts from all packages."
	@printf "  %-25s - %s\n" "setup-hooks" 			"Configure git to use .githooks directory."
	@echo ""
	@echo "Force Update (fetch latest from NPM):"
	@printf "  %-25s - %s\n" "update" 					"Force update all packages from NPM registry."
	@printf "  %-25s - %s\n" "update-all" 			"Same as 'update'."
	@printf "  %-25s - %s\n" "update-admin" 		"Force update @venizia/ardor-admin dependencies."
	@echo ""
	@echo "Individual Package Builds:"
	@printf "  %-25s - %s\n" "admin" 						"Rebuilds @venizia/ardor-admin."
	@echo ""
	@echo "Linting:"
	@printf "  %-25s - %s\n" "lint" 						"Lint all packages (alias for lint-packages)."
	@printf "  %-25s - %s\n" "lint-packages" 		"Lint packages/ directory only."
	@printf "  %-25s - %s\n" "lint-admin" 			"Lint @venizia/ardor-admin."
	@echo ""
	@echo "Other:"
	@printf "  %-25s - %s\n" "help" 						"Show this help message."
	@echo ""
	@echo "Development (use bun run directly):"
	@printf "  %-25s - %s\n" "bun run docs:dev" "Start documentation site in development mode."
	@printf "  %-25s - %s\n" "bun run mcp:dev" "Start MCP server in development mode."