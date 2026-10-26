#!/bin/sh
set -e

echo "START | Building application..."

bun run docs:clean

# Before vitepress, because an unlinked page is not a dead link - the build stays green while a
# reader has no way to reach the page.
bun scripts/check-sidebar.mts

# Every ```ts fence compiles against the built packages, so a page cannot describe an API that
# does not exist.
bun scripts/check-snippets.mts

vitepress build site

echo "DONE | Build completed successfully!"
