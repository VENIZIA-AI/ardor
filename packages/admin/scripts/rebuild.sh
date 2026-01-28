#!/bin/sh

echo "\nGenerating index..."
bun run gen:index

echo "\nCleaning up resources ..."
bun run clean

echo "\nBuilding latest release..."
bun run build

echo "\nPLEASE PUSH LATEST BUILT FOR ANY CHANGE(S)"
