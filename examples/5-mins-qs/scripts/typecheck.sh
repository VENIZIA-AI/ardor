#!/usr/bin/env sh
# Type-check the app and its stub API: two programs, two tsconfigs.
set -eu
cd "$(dirname "$0")/.."

bun check --no-pretty -p tsconfig.json
bun check --no-pretty -p api/tsconfig.json
