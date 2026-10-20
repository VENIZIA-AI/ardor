#!/usr/bin/env sh
# Compile this app for production: `vite build` writes dist/.
set -eu
cd "$(dirname "$0")/.."

vite build --config .configs/builders/vite.config.mts
