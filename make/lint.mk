# Lint and format the packages, the wiki and scripts/. The examples carry their own package.json
# scripts, so make does not drive them: `bun scripts/examples.ts check` does.

# Each project lints itself, from its own .configs/ and with its own tools (its node_modules/.bin).
# oxlint owns the rules, ESLint runs only naming-convention (oxlint has no port yet), bun fmt formats.
# The style is the [fmt] section of the root bunfig.toml, which bun fmt finds from the project folder up.
# A bare `bun fmt` also formats md and json, so the glob is always given. It names package.json too: bun fmt sorts
# its keys, and a release keeps them sorted (`npm version` and force-update.sh change values in place).
# Paths are ignored through .gitignore: `ignorePatterns` resolve against .configs/, not the project.
FMT_GLOB := "**/*.{ts,mts,tsx,js,mjs}" "**/package.json"
# $(1) project dir; $(2) what oxlint and ESLint lint (default .); $(3) what bun fmt checks.
LINT_PROJECT = cd $(1) && node_modules/.bin/oxlint -c .configs/lints/oxlint.config.mts --deny-warnings $(or $(2),.) && node_modules/.bin/eslint -c .configs/lints/eslint.config.mjs $(or $(2),.) && bun fmt --no-script --check $(or $(3),$(FMT_GLOB))
FIX_PROJECT = cd $(1) && node_modules/.bin/oxlint -c .configs/lints/oxlint.config.mts --fix $(or $(2),.) && node_modules/.bin/eslint -c .configs/lints/eslint.config.mjs --fix $(or $(2),.) && bun fmt --no-script $(or $(3),$(FMT_GLOB))

LINT_PKG_TARGETS := $(addprefix lint-,$(PACKAGES))
FIX_PKG_TARGETS := $(addprefix lint-fix-,$(PACKAGES))

.PHONY: lint lint-all lint-packages lint-wiki lint-scripts lint-manifests lint-fix lint-fix-packages lint-fix-wiki \
        fmt-manifests \
        $(LINT_PKG_TARGETS) $(FIX_PKG_TARGETS)

lint: lint-packages
	@echo "✅ Linting completed."

lint-all: lint-packages lint-wiki lint-scripts lint-manifests
	@echo "✅ All linting completed."

lint-packages: $(LINT_PKG_TARGETS)

lint-fix: lint-fix-packages fmt-manifests

lint-fix-packages: $(FIX_PKG_TARGETS)

# Static pattern rules: make skips implicit-rule search for .PHONY targets, so a plain `lint-%`
# would never match. The release workflow calls `make lint-<package dir>`.
$(LINT_PKG_TARGETS): lint-%:
	@echo "🔍 Linting packages/$*..."
	@$(MAKE) --no-print-directory -C packages/$* lint

$(FIX_PKG_TARGETS): lint-fix-%:
	@$(MAKE) --no-print-directory -C packages/$* lint-fix

# The wiki ESLint config skips site/ (the VitePress theme API spells `Layout` and `enhanceApp`).
lint-wiki:
	@echo "🔍 Linting docs/wiki..."
	@$(call LINT_PROJECT,docs/wiki)

lint-fix-wiki:
	@$(call FIX_PROJECT,docs/wiki)

# The package.json files outside the projects make lints (the packages and the wiki format their own): the root one, and
# the examples', which make does not drive. bun fmt sorts their keys, with the same bunfig.toml.
lint-manifests:
	@echo "🔍 Linting the root and example package.json..."
	@bun fmt --no-script --check "package.json" "examples/*/package.json"

fmt-manifests:
	@bun fmt --no-script "package.json" "examples/*/package.json"

# `scripts/` is not a workspace member: bun fmt takes the root bunfig.toml like the other projects, and
# bun check reads scripts/tsconfig.json.
lint-scripts:
	@echo "🔍 Linting scripts/..."
	@cd scripts && bun fmt --no-script --check "**/*.{ts,mts}"
	@bun check --no-pretty -p scripts/tsconfig.json
