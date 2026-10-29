# The dependency catalog gate and the package release dispatch.

.PHONY: catalog-check release-plan release preset-build preset-smoke

# Every catalogued dependency is referenced as "catalog:" (root workspaces.catalog), none drifted.
catalog-check:
	@bun x --no-install devz check catalog --glob 'examples/*/package.json' --glob 'docs/*/package.json' --glob 'presets/*/preset.json' --preset-prefix presets/

# Plans one release run for the packages and dispatches the release workflow once; --dry-run prints the dispatch.
release-plan:
	@bun scripts/release/release.ts --dry-run

release:
	@bun scripts/release/release.ts $(ARGS)

# Writes the VULCAN preset of @venizia/ardor with this release's versions (packages/ardor/dist/presets/app).
# Run it after the build: `make ardor` cleans dist first.
preset-build:
	@bun scripts/preset/vulcan-preset.ts

# Creates an app from the packed preset in a scratch folder under .agents/local/tmp (its own git repository) and checks it.
# Needs `make build-all` first. VULCAN_CMD, VULCAN_TGZ and IGNIS_DIR are described in scripts/preset/preset-smoke.ts.
preset-smoke:
	@bun scripts/preset/preset-smoke.ts $(ARGS)
