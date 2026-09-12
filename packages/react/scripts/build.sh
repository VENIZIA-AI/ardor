#!/bin/sh
set -e

echo "START | Building application..."

tsc -p tsconfig.build.json --extendedDiagnostics
tsc-alias -p tsconfig.build.json

echo "DONE | Build completed successfully!"
