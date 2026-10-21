#!/usr/bin/env sh
# Compile the example into dist/: a Bun script has no bundler step of its own, so Bun bundles it.
set -eu
cd "$(dirname "$0")/.."

bun build --target bun --outdir dist src/index.ts
