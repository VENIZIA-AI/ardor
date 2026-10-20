#!/usr/bin/env sh
# Remove what the lint and the type check cache.
set -eu
cd "$(dirname "$0")/.."

rm -rf node_modules/.cache *.tsbuildinfo
