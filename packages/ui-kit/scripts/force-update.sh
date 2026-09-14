#!/bin/bash

# Usage: ./force-update.sh [latest|next|highest]
# Default: latest
# - latest/next: Use npm dist-tag to resolve version
# - highest: Use the highest released version (sorted by semver)

TAG="${1:-latest}"

if [ "$TAG" != "latest" ] && [ "$TAG" != "next" ] && [ "$TAG" != "highest" ]; then
  echo "ERROR | Invalid tag: $TAG (must be 'latest', 'next', or 'highest')"
  exit 1
fi

echo "START | Force updating from NPM registry (tag: $TAG)..."

EXTRA_PACKAGES=""

# Derived from package.json, never hardcoded: a hardcoded list silently goes stale when a new
# workspace dependency is added - that is how @venizia/ignis-filter went unrefreshed in core, and
# @venizia/ignis-inversion in filter. EXTRA_PACKAGES carries any non-@venizia pin.
DERIVED=$(jq -r '[(.dependencies // {}), (.devDependencies // {}), (.peerDependencies // {})] | add // {} | keys[] | select(startswith("@venizia/"))' package.json | sort -u | tr '\n' ' ')
PACKAGES="$EXTRA_PACKAGES $DERIVED"

if [ -z "$(echo "$PACKAGES" | tr -d ' ')" ]; then
  echo "DONE | No NPM-published dependencies to refresh."
  exit 0
fi

for pkg in $PACKAGES; do
  # Counted over the two blocks this script rewrites, never over a merged view of all three: a real
  # range in peerDependencies shadowed a `catalog:` in devDependencies, so the release rewrote the
  # one it could not see and broke `make catalog-check`.
  PINNABLE=$(jq -r --arg p "$pkg" '[(.dependencies // {}), (.devDependencies // {})] | map(.[$p] // empty) | map(select(test(":") | not)) | length' package.json)
  if [ "$PINNABLE" = "0" ]; then
    echo "[$pkg] nothing to pin - catalog:/workspace: or peer-only, SKIP..."
    continue
  fi

  echo "[$pkg] Fetching $TAG version..."

  if [ "$TAG" = "highest" ]; then
    # Get the highest released version by semver sort
    # jq, not `grep '"' | tail -1`: with --json, npm prints its E404 body on STDOUT, so the old
    # pipe turned the error text into the "version" and handed it to sed. A package that is not
    # published yet must resolve to nothing, so the loop skips it. npm already returns versions
    # semver-sorted, and a package with exactly one version returns a bare string, not an array.
    VERSION=$(npm view "$pkg" versions --json 2>/dev/null | jq -r 'if type == "array" then .[-1] elif type == "string" then . else empty end')
  else
    # Get version for specific dist-tag from npm registry
    VERSION=$(npm view "$pkg" dist-tags."$TAG" 2>/dev/null)
  fi

  if [ -z "$VERSION" ]; then
    echo "[$pkg] Could not fetch version, SKIP..."
    continue
  fi

  echo "[$pkg] $TAG version: $VERSION"

  # jq over named blocks, not sed over the file. Two things sed got wrong: it rewrote
  # peerDependencies, turning the compatibility window the author chose (`>=0.2.0-7`) into `^` and
  # silently narrowing what a consumer may install; and it matched protocol specifiers, so
  # `catalog:` reached the tarball as a literal and every consumer failed with
  # `lodash@catalog: failed to resolve`. jq round-trips this file byte-for-byte.
  UPDATED=$(jq --arg p "$pkg" --arg v "^${VERSION}" '
    reduce ("dependencies", "devDependencies") as $block (.;
      if (.[$block] | type) != "object" then .
      elif ((.[$block][$p] // "") == "") then .
      elif (.[$block][$p] | test(":")) then .
      else .[$block][$p] = $v
      end)
  ' package.json)
  printf "%s\n" "$UPDATED" > package.json

  echo "[$pkg] Updated to version ^$VERSION"
done

echo "DONE | Force update completed successfully!"
