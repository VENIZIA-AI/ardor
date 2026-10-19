# The ARDOR monorepo. Each file under make/ holds one job; `make help` lists every target.
# make/project.mk is not included here: it is the per-package include, used by packages/*/Makefile.

.PHONY: all

# A bare `make` prints the target list; `make all` / `make build` builds.
.DEFAULT_GOAL := help

all: build

# Every package directory under packages/, in dependency order. Each per-package target (`<pkg>`,
# `update-<pkg>`, `lint-<pkg>`, `fmt-<pkg>`, `test-<pkg>`, `purity-<pkg>`, `clean-install-<pkg>`)
# is generated from this list - add a package here and every target exists for it.
PACKAGES := kernel react admin ardor

# The npm name of a package directory, read from its package.json: $(call PKG_NAME,kernel).
PKG_NAME = $(shell sed -n 's/^  "name": "\(.*\)",$$/\1/p' packages/$(1)/package.json)

# VULCAN's targets (vulcan-sync, vulcan-doctor, agent-setup, okf-*, surface-*, atlas-symbols, atlas-releases).
-include node_modules/@venizia/vulcan/base/make/vulcan.mk

include make/build.mk
include make/knowledge.mk
include make/release.mk
include make/lint.mk
include make/test.mk
include make/help.mk
