# Lint and format the packages, the wiki and scripts/. The examples have no lint script of their own
# to run here: their files are format-checked by `lint-files` below.

# Each project lints itself, from its own .configs/ and with its own tools (its node_modules/.bin).
# oxlint owns the rules, ESLint runs only naming-convention (oxlint has no port yet), bun fmt formats.
# The style is the [fmt] section of the root bunfig.toml, which bun fmt finds from the project folder up.
# A bare `bun fmt` also formats markdown, so the glob is always given: every type bun fmt supports except markdown
# (code, json, yaml, css, html, vue). Json includes package.json: bun fmt sorts its keys, and a release keeps them sorted
# (`npm version` and force-update.sh change values in place). bun.lock, dist and node_modules are never reached.
# Paths are ignored through .gitignore: `ignorePatterns` resolve against .configs/, not the project.
FMT_GLOB := "**/*.{ts,mts,tsx,js,mjs,json,jsonc,yml,yaml,css,html,vue}"
# The tracked files that belong to no project make lints: the root package.json (bun fmt sorts its keys), CI and release
# workflows, the agent and VULCAN files, the presets (templates and preset.json), and the examples (their package.json
# included).
FILES_GLOBS := "package.json" ".github/**/*.{ts,mts,json,yml,yaml}" ".agents/**/*.{ts,mts,json}" ".configs/*.{ts,mts,json}" "presets/**/*.{ts,tsx,mts,js,mjs,json,css,html}" "examples/**/*.{ts,mts,tsx,js,mjs,json,yml,yaml,css,html,vue}"
# $(1) project dir; $(2) what oxlint and ESLint lint (default .); $(3) what bun fmt checks.
LINT_PROJECT = cd $(1) && node_modules/.bin/oxlint -c .configs/lints/oxlint.config.mts --deny-warnings $(or $(2),.) && node_modules/.bin/eslint -c .configs/lints/eslint.config.mjs $(or $(2),.) && bun fmt --no-script --check $(or $(3),$(FMT_GLOB))
FIX_PROJECT = cd $(1) && node_modules/.bin/oxlint -c .configs/lints/oxlint.config.mts --fix $(or $(2),.) && node_modules/.bin/eslint -c .configs/lints/eslint.config.mjs --fix $(or $(2),.) && bun fmt --no-script $(or $(3),$(FMT_GLOB))

LINT_PKG_TARGETS := $(addprefix lint-,$(PACKAGES))
FIX_PKG_TARGETS := $(addprefix lint-fix-,$(PACKAGES))

.PHONY: lint lint-all lint-packages lint-wiki lint-scripts lint-files lint-fix lint-fix-packages lint-fix-wiki \
        fmt-files \
        $(LINT_PKG_TARGETS) $(FIX_PKG_TARGETS)

lint: lint-packages
	@echo "✅ Linting completed."

lint-all: lint-packages lint-wiki lint-scripts lint-files
	@echo "✅ All linting completed."

lint-packages: $(LINT_PKG_TARGETS)

lint-fix: lint-fix-packages lint-fix-wiki fmt-files

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

lint-files:
	@echo "🔍 Linting the files outside the projects..."
	@bun fmt --no-script --check $(FILES_GLOBS)

fmt-files:
	@bun fmt --no-script $(FILES_GLOBS)

# `scripts/` is not a workspace member: bun fmt takes the root bunfig.toml like the other projects, and
# bun check reads scripts/tsconfig.json.
lint-scripts:
	@echo "🔍 Linting scripts/..."
	@cd scripts && bun fmt --no-script --check $(FMT_GLOB)
	@bun check --no-pretty -p scripts/tsconfig.json
