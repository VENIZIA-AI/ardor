#!/usr/bin/env sh
# Remove what `sh scripts/compile.sh` and the type check wrote.
set -eu
cd "$(dirname "$0")/.."

rm -rf dist *.tsbuildinfo
