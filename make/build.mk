# Install, clean, git hooks, the package build order, the wiki build, and the force-update targets.

UPDATE_TARGETS := $(addprefix update-,$(PACKAGES))

.PHONY: install clean setup-hooks build build-all docs typecheck typecheck-all typecheck-examples \
        $(PACKAGES) $(UPDATE_TARGETS)

# ----------------------------------------------------------------------------
# INSTALL & CLEAN
# ----------------------------------------------------------------------------
install:
	@echo "📥 Installing dependencies..."
	@bun install
	@echo "✅ Install completed."

clean:
	@echo "🧹 Cleaning all packages..."
	@$(foreach p,$(PACKAGES),$(MAKE) --no-print-directory -C packages/$(p) clean &&) true
	@bun run --filter "*" clean

# ----------------------------------------------------------------------------
# GIT HOOKS
# ----------------------------------------------------------------------------
setup-hooks:
	@echo "🔧 Setting up git hooks..."
	@git config core.hooksPath .githooks
	@echo "✅ Git hooks configured to use .githooks directory."

# ----------------------------------------------------------------------------
# BUILD TARGETS
# A downstream package type-checks against the dist of its dependency, never its src (B-05), so
# the graph below is the dependency order and must not be parallelised:
# kernel → react → admin → ardor.
# ----------------------------------------------------------------------------
build: build-all

build-all: $(PACKAGES)
	@echo "🚀 All packages rebuilt successfully."

react: kernel
admin: react
ardor: admin

# Each package builds through its own Makefile (make/project.mk); this file only orders them.
$(PACKAGES):
	@echo ""
	@echo "📦 Rebuilding $(call PKG_NAME,$@)..."
	@$(MAKE) --no-print-directory -C packages/$@ rebuild

docs:
	@echo "📦 Rebuilding wiki (VitePress)..."
	@bun run --filter "@venizia/ardor-docs" docs:build

typecheck: typecheck-all

typecheck-all:
	@echo "🔎 Type-checking all packages..."
	@$(foreach p,$(PACKAGES),$(MAKE) --no-print-directory -C packages/$(p) typecheck &&) true

# An example imports the built packages, so this needs `make build-all` first.
EXAMPLES := $(notdir $(patsubst %/,%,$(wildcard examples/*/)))

typecheck-examples:
	@echo "🔎 Type-checking the examples..."
	@$(foreach e,$(EXAMPLES),bun run --cwd examples/$(e) typecheck &&) true

# ----------------------------------------------------------------------------
# FORCE UPDATE TARGETS - ARDOR tracks the HIGHEST published IGNIS line (prerelease included),
# never `latest`. The root catalog is refreshed first, by `bun scripts/build/refresh-catalog.ts highest`; the
# per-package force-update skips catalogued ranges by design. The release workflow runs both.
# ----------------------------------------------------------------------------
$(UPDATE_TARGETS): update-%:
	@echo "🔄 Force updating $(call PKG_NAME,$*)..."
	@bun run --filter "$(call PKG_NAME,$*)" force-update highest
