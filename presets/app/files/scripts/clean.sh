#!/usr/bin/env sh
# Remove what `sh scripts/compile.sh` wrote.
set -eu
cd "$(dirname "$0")/.."

rm -rf dist
