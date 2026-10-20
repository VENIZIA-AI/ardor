# The dependency catalog gate and the package release dispatch.

.PHONY: catalog-check release-plan release preset-build preset-smoke

# Every catalogued dependency is referenced as "catalog:" (root workspaces.catalog), none drifted.
catalog-check:
	@bun scripts/check-catalog.ts

# Dispatches the release workflow one package at a time, in dependency order, waiting for each.
release-plan:
	@bun scripts/release.ts --dry-run

release:
	@bun scripts/release.ts $(ARGS)

# Writes the VULCAN preset of @venizia/ardor with this release's versions (packages/ardor/dist/vulcan-preset).
# Run it after the build: `make ardor` cleans dist first.
preset-build:
	@bun scripts/vulcan-preset.ts

# Creates an app from the packed preset in a temp folder outside this repository and checks it.
# Needs `make build-all` first. VULCAN_CMD, VULCAN_TGZ and IGNIS_DIR are described in scripts/preset-smoke.ts.
preset-smoke:
	@bun scripts/preset-smoke.ts $(ARGS)
