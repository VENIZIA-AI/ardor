# The wiki link gates and the report targets ARDOR adds to VULCAN's. The knowledge bundle and the
# generated reference tables (okf-*, surface-*, symbols-*, releases-*) are VULCAN targets (vulcan.mk).
# surface-* and symbols-* read the built .d.ts: run them after `make build-all`.

.PHONY: split-report wiki-links-check wiki-anchors-check atlas-smoke

split-report:
	@bun scripts/split-report.ts

wiki-links-check:
	@bun scripts/wiki-source-links.ts

# Dead `#fragment` links. Reads the emitted ids, so it needs a build - run `make docs` first.
wiki-anchors-check:
	@bun scripts/wiki-anchors.ts

# Proves VULCAN's atlas serves this checkout over MCP.
atlas-smoke:
	@bun scripts/atlas-smoke.ts
