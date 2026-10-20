#!/usr/bin/env sh
# Compile the example for production: `vite build` writes dist/.
set -eu
cd "$(dirname "$0")/.."

vite build --config .configs/builders/vite.config.ts
