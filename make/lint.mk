# Lint and format the packages, the wiki and scripts/. The examples carry their own package.json
# scripts, so make does not drive them: `bun scripts/examples.ts check` does.

# Each project lints itself, from its own .configs/ and with its own tools (its node_modules/.bin).
# oxlint owns the rules, ESLint runs only naming-convention (oxlint has no port yet), bun fmt formats with
# the project's oxfmt config, passed explicitly (it also formats md and json when given no glob: always pass one).
# Paths are ignored through .gitignore: `ignorePatterns` resolve against .configs/, not the project.
FMT_GLOB := "**/*.{ts,mts,tsx,js,mjs}"
BUN_FMT_FLAGS := --no-script --config .configs/formatters/oxfmt.config.mts
# $(1) project dir; $(2) what oxlint and ESLint lint (default .); $(3) what bun fmt checks.
LINT_PROJECT = cd $(1) && node_modules/.bin/oxlint -c .configs/lints/oxlint.config.mts --deny-warnings $(or $(2),.) && node_modules/.bin/eslint -c .configs/lints/eslint.config.mjs $(or $(2),.) && bun fmt $(BUN_FMT_FLAGS) --check $(or $(3),$(FMT_GLOB))
FIX_PROJECT = cd $(1) && node_modules/.bin/oxlint -c .configs/lints/oxlint.config.mts --fix $(or $(2),.) && node_modules/.bin/eslint -c .configs/lints/eslint.config.mjs --fix $(or $(2),.) && bun fmt $(BUN_FMT_FLAGS) $(or $(3),$(FMT_GLOB))

LINT_PKG_TARGETS := $(addprefix lint-,$(PACKAGES))
FIX_PKG_TARGETS := $(addprefix lint-fix-,$(PACKAGES))

.PHONY: lint lint-all lint-packages lint-wiki lint-scripts lint-fix lint-fix-packages lint-fix-wiki \
        $(LINT_PKG_TARGETS) $(FIX_PKG_TARGETS)

lint: lint-packages
	@echo "✅ Linting completed."

lint-all: lint-packages lint-wiki lint-scripts
	@echo "✅ All linting completed."

lint-packages: $(LINT_PKG_TARGETS)

lint-fix: lint-fix-packages

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

# `scripts/` is not a workspace member: bun fmt picks its style from the root package.json (it lists oxfmt),
# and bun check reads scripts/tsconfig.json.
lint-scripts:
	@echo "🔍 Linting scripts/..."
	@bun fmt --no-script --config scripts/.configs/formatters/oxfmt.config.mts --check "scripts/**/*.{ts,mts}"
	@bun check --no-pretty -p scripts/tsconfig.json
