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
# Required variables: APP_REQUIRED_ENV lists, comma separated, the variables the app cannot run without,
# for example `ENV APP_REQUIRED_ENV="VITE_API_URL,API_UPSTREAM"` in the app's Dockerfile (an operator
# overrides it with `-e`). A listed variable that is unset or empty stops the container with exit 1, and
# the message names every missing one - never a value. Any variable name can be listed, not only VITE_
# ones; a spaces-only or empty entry is skipped, and an entry that is not a variable name is an error.
# Nothing listed checks nothing. A mounted config.js is kept before any check, as the operator supplied it.
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

  # Names only, in the order declared; a value never reaches a message.
  entries = split(ENVIRON["APP_REQUIRED_ENV"], declared, ",")
  missing = ""
  for (position = 1; position <= entries; position++) {
    entry = declared[position]
    gsub(/^[ \t]+/, "", entry)
    gsub(/[ \t]+$/, "", entry)
    if (entry == "") {
      continue
    }
    if (entry !~ /^[A-Za-z_][A-Za-z0-9_]*$/) {
      print "[runtime-config] FATAL: APP_REQUIRED_ENV entry " position " is not a variable name (letters, digits and _, not starting with a digit)" > "/dev/stderr"
      failed = 1
      continue
    }
    if (entry in seen) {
      continue
    }
    seen[entry] = 1
    if (!(entry in ENVIRON) || ENVIRON[entry] == "") {
      missing = missing (missing == "" ? "" : ", ") entry
    }
  }
  if (missing != "") {
    print "[runtime-config] FATAL: required variable(s) missing or empty: " missing > "/dev/stderr"
    failed = 1
  }

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
