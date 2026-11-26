EXTRA_BUILD_TSCONFIGS := .configs/builders/tsconfig.vite.build.json .configs/builders/tsconfig.codemod.build.json
TEST_PATHS := ./src

include ../../make/project.mk

# The `ardor` bin alone: it imports no other package, so it builds with nothing else built. Its
# .tsbuildinfo goes first, or tsc takes a missing output for up to date.
.PHONY: codemod-bin
codemod-bin:
	@rm -f .configs/builders/tsconfig.codemod.build.tsbuildinfo
	@$(TSC) -p .configs/builders/tsconfig.codemod.build.json
