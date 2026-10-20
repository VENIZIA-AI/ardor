#!/usr/bin/env sh
# Lint this example with oxlint, eslint and oxfmt. `sh scripts/lint.sh` checks; `--fix` fixes.
set -eu
cd "$(dirname "$0")/.."

FILES='**/*.{js,mjs,ts,mts,tsx}'
ESLINT_CACHE='--cache --cache-location node_modules/.cache/eslint/'

if [ "${1:-}" = "--fix" ]; then
  oxlint -c .configs/lints/oxlint.config.mts --fix
  eslint -c .configs/lints/eslint.config.mjs $ESLINT_CACHE --fix .
  oxfmt -c .configs/formatters/oxfmt.config.mts "$FILES"
else
  oxlint -c .configs/lints/oxlint.config.mts --deny-warnings
  eslint -c .configs/lints/eslint.config.mjs $ESLINT_CACHE .
  oxfmt -c .configs/formatters/oxfmt.config.mts --check "$FILES"
fi
