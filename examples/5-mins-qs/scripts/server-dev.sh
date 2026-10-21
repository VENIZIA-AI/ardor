#!/usr/bin/env sh
# Serve the example: the stub API on :3100 and Vite on :5173, which proxies /api to it. Ctrl-C stops both.
set -eu
cd "$(dirname "$0")/.."

bun run api/server.ts &
API=$!
trap 'kill "$API" 2>/dev/null' EXIT INT TERM

vite --config .configs/builders/vite.config.ts
