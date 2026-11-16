#!/usr/bin/env sh
# Serve the example: the stub API on :3100 and Vite on :5173, which proxies /api to it. Ctrl-C stops both.
set -eu
cd "$(dirname "$0")/.."

bun run api/server.ts &
API=$!
trap 'kill "$API" 2>/dev/null' EXIT INT TERM
echo "[api] http://127.0.0.1:3100/api - sign in with admin / admin or viewer / viewer"

vite --config .configs/builders/vite.config.ts
