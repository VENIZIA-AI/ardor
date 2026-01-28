#!/bin/sh

echo "START | Building application..."

tsc -p tsconfig.build.json --extendedDiagnostics && tsc-alias -p tsconfig.build.json

echo "DONE | Build completed successfully!"
