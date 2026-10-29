# Package test suites, type-check, the browser-purity gate, the clean-install gate, the bundle and
# layering gates, and the gate scripts' own tests.

# Packages with an entry claimed browser-pure (scripts/checks/purity/manifest.ts) - all of them.
PURE := $(PACKAGES)

TEST_TARGETS := $(addprefix test-,$(PACKAGES))
PURITY_TARGETS := $(addprefix purity-,$(PACKAGES))
CLEAN_INSTALL_TARGETS := $(addprefix clean-install-,$(PACKAGES))

.PHONY: test test-all test-scripts gates gates-refreshed links-check copies-check purity purity-test clean-install layer-check cycles-check \
        size-check $(TEST_TARGETS) $(PURITY_TARGETS) $(CLEAN_INSTALL_TARGETS)

# ----------------------------------------------------------------------------
# TEST TARGETS (Bun test runner only)
# The one home of the test command is the package's `make test` (make/project.mk): CI calls these
# targets, and so should you. BUN_TEST_FLAGS is an optional pass-through (`--isolate`,
# `--parallel`). Needs a build first (B-05). A package with no suite says so and passes.
# ----------------------------------------------------------------------------
export BUN_TEST_FLAGS

test: test-all

test-all: $(TEST_TARGETS)

$(TEST_TARGETS): test-%:
	@$(MAKE) --no-print-directory -C packages/$* test

# The repository gate scripts' own regression tests - nothing else runs them.
test-scripts:
	@echo "🔍 Running the repository gate scripts' regression tests..."
	@bun test scripts/release/__tests__ scripts/preset/__tests__ scripts/checks/__tests__

# ----------------------------------------------------------------------------
# GATES - the local twin of the Test job of package-release.yml: the same targets, in the same order.
# scripts/release/__tests__/gates-twin.test.ts keeps the two lists equal. Needs `bun install`. Run it
# without -j: the order is the point.
# ----------------------------------------------------------------------------
GATE_TARGETS := links-check copies-check $(PACKAGES) $(addprefix lint-,$(PACKAGES)) $(addprefix test-,$(PACKAGES)) \
                test-scripts purity-test $(addprefix purity-,$(PACKAGES)) catalog-check preset-smoke

gates:
	@$(foreach target,$(GATE_TARGETS),$(MAKE) --no-print-directory $(target) &&) true

# `gates` after the Test job's catalog refresh, in a scratch copy under .agents/local/tmp: what a plain checkout cannot see.
# The commands come from the workflow (scripts/release/__tests__/gates-refreshed.test.ts). About two minutes; run it before every dispatch.
gates-refreshed:
	@bun scripts/release/gates-refreshed.ts

# Every ARDOR sibling resolves to the workspace, never to a registry tarball (the first gate of the Test job).
links-check:
	@$(foreach p,$(PACKAGES),bun scripts/release/release-gates.ts links packages/$(p) &&) true

# Every @venizia/* package resolves to one version, never a stable copy next to a prerelease (the second gate of the Test job).
copies-check:
	@bun scripts/release/release-gates.ts single-copy

# ----------------------------------------------------------------------------
# PURITY TARGETS
# Bundles each entry claimed browser-pure and fails on node builtins or globals.
# Requires the package's dist - run the matching build target first.
# ----------------------------------------------------------------------------
purity:
	@echo "🔍 Checking browser purity for all claimed entries..."
	@bun x --no-install devz check purity --claims scripts/checks/purity/manifest.ts

# The positive controls of the shared purity engine, run against ARDOR's fixtures and claims. They live outside every package, so nothing else runs them.
purity-test:
	@echo "🔍 Running the purity gate's regression tests..."
	@bun test scripts/checks/purity/__tests__

$(addprefix purity-,$(PURE)): purity-%:
	@echo "🔍 Checking browser purity for $(call PKG_NAME,$*)..."
	@bun x --no-install devz check purity --claims scripts/checks/purity/manifest.ts $*

# ----------------------------------------------------------------------------
# CLEAN-INSTALL TARGETS
# Packs every package and loads each published entry from an empty project (Bun, Node ESM, browser
# build). Run after a build; one package at a time takes its siblings from the registry.
# ----------------------------------------------------------------------------
clean-install:
	@echo "🔍 Loading every published sub-path from a clean install..."
	@bun scripts/checks/clean-install/cli.ts

$(CLEAN_INSTALL_TARGETS): clean-install-%:
	@echo "🔍 Loading every published sub-path of $* from a clean install..."
	@bun scripts/checks/clean-install/cli.ts $*

# ----------------------------------------------------------------------------
# LAYERING AND BUNDLE GATES - run after a build.
# ----------------------------------------------------------------------------
layer-check:
	@bun scripts/checks/layer-boundaries.ts

# `--max 0` is what makes this a gate; without it the script only reports.
cycles-check:
	@$(foreach p,$(PACKAGES),bun x --no-install devz check module-cycles packages/$(p)/dist --max 0 &&) true

# Bundle budgets, measured brotlied with every third-party peer external.
size-check:
	@$(foreach p,$(PACKAGES),$(MAKE) --no-print-directory -C packages/$(p) size &&) true
