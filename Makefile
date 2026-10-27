# The ARDOR monorepo. Each file under make/ holds one job; `make help` lists every target.
# make/project.mk is not included here: it is the per-package include, used by packages/*/Makefile.

# A bare `make` prints the target list; `make build` builds.
.DEFAULT_GOAL := help

# Every package directory under packages/, in dependency order. Each per-package target (`<pkg>`,
# `update-<pkg>`, `lint-<pkg>`, `lint-fix-<pkg>`, `test-<pkg>`, `purity-<pkg>`, `clean-install-<pkg>`)
# is generated from this list - add a package here and every target exists for it.
PACKAGES := kernel react admin ardor

# The npm name of a package directory, read from its package.json: $(call PKG_NAME,kernel).
PKG_NAME = $(shell sed -n 's/^  "name": "\(.*\)",$$/\1/p' packages/$(1)/package.json)

# The wiki link and anchor gates are VULCAN's (wiki-links-check, wiki-anchors-check); they need the repository
# the wiki links point into. The generated reference tables name symbols and paths of the code, not links, so the
# link gate does not read them.
WIKI_REPO := VENIZIA-AI/ardor
WIKI_LINKS_FLAGS := --skip .agents/knowledge/reference/public-surface.md,.agents/knowledge/reference/source-map.md,.agents/knowledge/reference/binding-keys.md,.agents/knowledge/reference/makefile-targets.md

# VULCAN's targets (vulcan-sync, vulcan-doctor, agent-setup, okf-*, surface-*, atlas-symbols, atlas-releases).
-include node_modules/@venizia/vulcan/base/make/vulcan.mk

include make/build.mk
include make/knowledge.mk
include make/release.mk
include make/lint.mk
include make/test.mk
include make/help.mk
