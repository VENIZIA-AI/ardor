#!/usr/bin/env sh
# Lint this package with oxlint, eslint and oxfmt.
#   sh scripts/lint.sh                  checks the whole package
#   sh scripts/lint.sh --fix            fixes the whole package
#   sh scripts/lint.sh [--fix] <files>  handles only those files (paths relative to the package)
# Paths to skip go in .lintignore (gitignore style): oxlint and oxfmt do not apply the ignorePatterns
# of a config kept in .configs/ to the package.
set -eu
cd "$(dirname "$0")/.."

ESLINT_CACHE='--cache --cache-location node_modules/.cache/eslint/'
FIX=
if [ "${1:-}" = "--fix" ]; then
  FIX=1
  shift
fi

OX_IGNORE=
ESLINT_IGNORE=
if [ -f .lintignore ]; then
  OX_IGNORE='--ignore-path .lintignore'
  while IFS= read -r PATTERN || [ -n "$PATTERN" ]; do
    case "$PATTERN" in
      '' | '#'*) ;;
      *) ESLINT_IGNORE="$ESLINT_IGNORE --ignore-pattern $PATTERN" ;;
    esac
  done < .lintignore
fi
# The option strings are split on spaces below; a pattern in them must stay a glob, not expand.
set -f

WHOLE=
ESLINT_QUIET=
UNMATCHED=
if [ $# -eq 0 ]; then
  WHOLE=1
  set -- .
else
  # Keep only the files the linters handle; a list without one has nothing to lint.
  for FILE; do
    shift
    case "$FILE" in
      *.ts | *.tsx | *.mts | *.js | *.mjs) set -- "$@" "$FILE" ;;
    esac
  done
  if [ $# -eq 0 ]; then
    exit 0
  fi
  ESLINT_QUIET=--no-warn-ignored
  UNMATCHED=--no-error-on-unmatched-pattern
fi

if [ -n "$FIX" ]; then
  oxlint -c .configs/oxlint.config.mts $OX_IGNORE $UNMATCHED --fix "$@"
  eslint -c .configs/eslint.config.mjs $ESLINT_CACHE $ESLINT_QUIET $ESLINT_IGNORE --fix "$@"
else
  oxlint -c .configs/oxlint.config.mts $OX_IGNORE $UNMATCHED --deny-warnings "$@"
  eslint -c .configs/eslint.config.mjs $ESLINT_CACHE $ESLINT_QUIET $ESLINT_IGNORE "$@"
fi

# The whole package goes to oxfmt as a glob, so it formats the same files the linters check.
if [ -n "$WHOLE" ]; then
  set -- '**/*.{ts,tsx,mts,js,mjs}'
fi
if [ -n "$FIX" ]; then
  oxfmt -c .configs/oxfmt.config.mts $OX_IGNORE $UNMATCHED "$@"
else
  oxfmt -c .configs/oxfmt.config.mts $OX_IGNORE $UNMATCHED --check "$@"
fi
