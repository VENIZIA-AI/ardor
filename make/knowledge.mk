# The report targets ARDOR adds to VULCAN's (the wiki link gates, wiki-links-check and wiki-anchors-check, are VULCAN's too, configured in the Makefile). The knowledge bundle and the
# generated reference tables (okf-*, surface-*, symbols-*, releases-*) are VULCAN targets (vulcan.mk).
# surface-* and symbols-* read the built .d.ts: run them after `make build-all`.

.PHONY: split-report atlas-smoke api-undocumented

split-report:
	@bun x --no-install devz check split-report --dist dist

# Fails when an export reachable from a published package has no TSDoc (D-06). Needs `make build-all` first.
api-undocumented:
	@bun x --no-install vulcan x atlas api undocumented

# Proves VULCAN's atlas serves this checkout over MCP.
atlas-smoke:
	@bun scripts/checks/atlas-smoke.ts
