#!/bin/sh
# Writes the /api proxy of nginx only when the container has an upstream: `docker run -e API_UPSTREAM=http://api:3000`.
# With API_UPSTREAM unset or empty no /api location exists, which is what an app served behind a gateway wants.
#
# The nginx image runs every executable file of /docker-entrypoint.d/ in `sort -V` order before it starts nginx; the
# 45 puts this after the runtime-config script. nginx.conf.template includes /etc/nginx/conf.d/*.locations, and a
# glob that matches nothing is not an error. A script without the executable bit is skipped, hence `COPY --chmod=0755`
# in the Dockerfile.
#
# The upstream is written into the nginx configuration, so it must be an address and nothing else: a value with a
# character outside letters, digits, brackets (an IPv6 address) and `._:/@%+-` stops the container, naming the variable and never the value.
#
# API_PROXY_SOURCE and API_PROXY_TARGET name other files, for the tests; they are not VITE_ names, so never published.
set -eu

SOURCE="${API_PROXY_SOURCE:-/etc/nginx/snippets/api-proxy.conf}"
TARGET="${API_PROXY_TARGET:-/etc/nginx/conf.d/api-proxy.locations}"

# A file left from an earlier start must not outlive the variable that asked for it.
rm -f "$TARGET"

if [ -z "${API_UPSTREAM:-}" ]; then
  echo "[api-proxy] API_UPSTREAM is empty: no /api proxy"
  exit 0
fi

case "$API_UPSTREAM" in
  *[!][A-Za-z0-9._:/@%+-]*)
    echo "[api-proxy] FATAL: API_UPSTREAM has a character that is not part of an address" >&2
    exit 1
    ;;
esac

# Only these two: nginx's own variables ($api_upstream, $host) stay as they are.
envsubst '${API_UPSTREAM} ${NGINX_LOCAL_RESOLVERS}' < "$SOURCE" > "$TARGET"
echo "[api-proxy] /api goes to the upstream of API_UPSTREAM"
