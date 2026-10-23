#!/bin/sh
# Writes /usr/share/nginx/html/config.js from the container's environment, so one built image serves
# every environment: `docker run -e VITE_API_URL=https://api.example.com image`.
#
# The nginx image runs every executable file of /docker-entrypoint.d/ in `sort -V` order before it starts
# nginx. The 40 puts this after the base image's own scripts. A script without the executable bit is
# skipped, hence `COPY --chmod=0755` in the Dockerfile; the Dockerfile must not declare an ENTRYPOINT,
# which would replace the script that runs this directory.
#
# What is published: the variables named VITE_ followed by capitals, digits and underscores, and nothing
# else. That is Vite's own rule for what reaches the browser, so the same names work in dev and here.
# Every published value is readable by every visitor: never put a secret in a VITE_ variable. A name
# with SECRET, PASSWORD or TOKEN in it stops the container, to catch that mistake early (a name with KEY
# is fine: public keys are normal). Values are escaped as JavaScript string content, so no value can
# end its string or the file.
#
# RUNTIME_CONFIG_TARGET names another file, for the tests; it is not a VITE_ name, so it is never published.
set -eu

TARGET="${RUNTIME_CONFIG_TARGET:-/usr/share/nginx/html/config.js}"

# A read-only file is one the operator mounted over config.js: keep it as it is.
if [ -e "$TARGET" ] && [ ! -w "$TARGET" ]; then
  echo "[runtime-config] $TARGET is read-only (mounted): keeping the supplied file"
  exit 0
fi

# One awk program, so the values never pass through a shell expansion. ENVIRON holds them as they are.
BODY=$(awk '
function escape(text,   result, index_, character) {
  result = ""
  for (index_ = 1; index_ <= length(text); index_++) {
    character = substr(text, index_, 1)
    result = result ((character in escapes) ? escapes[character] : character)
  }
  return result
}

BEGIN {
  for (code = 1; code < 32; code++) {
    escapes[sprintf("%c", code)] = sprintf("\\u%04x", code)
  }
  escapes[sprintf("%c", 127)] = "\\u007f"
  escapes["\\"] = "\\\\"
  escapes["\""] = "\\\""
  escapes["<"] = "\\u003c"
  escapes[">"] = "\\u003e"
  escapes["&"] = "\\u0026"

  count = 0
  failed = 0
  for (name in ENVIRON) {
    if (name !~ /^VITE_[A-Z0-9_]+$/) {
      continue
    }
    if (name ~ /SECRET|PASSWORD|TOKEN/) {
      print "[runtime-config] " name " looks like a secret, and every VITE_ variable is published to every visitor: rename it or keep it out of VITE_" > "/dev/stderr"
      failed = 1
      continue
    }
    names[++count] = name
  }
  if (failed) {
    exit 1
  }

  for (i = 2; i <= count; i++) {
    current = names[i]
    for (j = i - 1; j >= 1 && names[j] > current; j--) {
      names[j + 1] = names[j]
    }
    names[j + 1] = current
  }

  for (i = 1; i <= count; i++) {
    printf "  \"%s\": \"%s\"%s\n", names[i], escape(ENVIRON[names[i]]), (i < count ? "," : "")
  }
}
' </dev/null) || {
  echo "[runtime-config] FATAL: config.js was not written" >&2
  exit 1
}

{
  printf 'window.__APP_CONFIG__ = Object.freeze({'
  if [ -n "$BODY" ]; then
    printf '\n%s\n' "$BODY"
  fi
  printf '});\n'
} >"$TARGET"

NAMES=$(printf '%s\n' "$BODY" | sed -n 's/^  "\([A-Z0-9_]*\)": .*/\1/p' | tr '\n' ' ')
echo "[runtime-config] wrote $TARGET with: ${NAMES:-nothing}"
