#!/bin/sh
set -e

# Type-check BEFORE cleaning: `clean` removes dist, so a type error found after it would leave an
# empty dist behind a cascade of unrelated import failures in every consumer.
echo "\nType-checking before touching dist ..."
tsc --noEmit -p tsconfig.test.json

echo "\nCleaning up resources ..."
bun run clean

echo "\nBuilding latest release..."
bun run build

echo "\nPLEASE PUSH LATEST BUILT FOR ANY CHANGE(S)"
