# The image of {{app}}: the app compiled by Vite, served by nginx.
#
# Build it from the monorepo root, so the workspace packages and the lockfile are in the context:
#
#   docker build -f {{appPath}}/.configs/builders/Dockerfile -t {{app}} \
#     --build-arg APP_BUILD_COMMIT="$(git rev-parse HEAD)" \
#     --build-arg APP_BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)" .
#   docker run --rm -p 8080:8080 -e API_UPSTREAM=http://api:3000 -e VITE_API_URL=/api {{app}}
#
# The preset cannot know which workspace packages this app needs, so the whole context is copied (the
# .dockerignore at the root filters it), then installed and built. A project can list the packages by
# hand instead, copying each package.json first, so a change in a source file does not redo the install.

# -------------------------------------------------------------------------------
# Dependencies stage
# -------------------------------------------------------------------------------
FROM docker.io/oven/bun:1.4.3-alpine AS deps

# A private registry, when the build runs where the public one is not reachable. Empty by default.
ARG BUN_CONFIG_REGISTRY=
ENV BUN_CONFIG_REGISTRY=${BUN_CONFIG_REGISTRY}

RUN mkdir -p /home/bun/app && chown -R bun:bun /home/bun/app
WORKDIR /home/bun/app
USER bun

COPY --chown=bun . .
# An environment file in the context would stay in the COPY layer, whatever is deleted afterwards: stop
# here, and keep them out with the root .dockerignore (`**/.env`, `**/.env.*`, `!**/.env.example`).
RUN leaked="$(find . -name '.env*' ! -name '.env.example' -not -path '*/node_modules/*')"; \
    if [ -n "$leaked" ]; then echo "Secrets in the build context: $leaked - add **/.env and **/.env.* to the root .dockerignore" >&2; exit 1; fi
RUN bun install --frozen-lockfile --ignore-scripts

# -------------------------------------------------------------------------------
# Build stage
# -------------------------------------------------------------------------------
FROM deps AS builder

# The image has no .git (the .dockerignore drops it), so the commit comes in as a build argument. A build
# without a commit sha stops here: an image must always say which commit it runs. Before a first commit
# `git rev-parse HEAD` prints the word HEAD, which is not a sha either.
ARG APP_BUILD_COMMIT=
ARG APP_BUILD_BRANCH=
ARG APP_BUILD_VERSION=
RUN case "$APP_BUILD_COMMIT" in \
      '' | *[!0-9a-f]* | ? | ?? | ??? | ???? | ????? | ??????) \
        echo "Pass --build-arg APP_BUILD_COMMIT=\$(git rev-parse HEAD) after a first commit; got: $APP_BUILD_COMMIT" >&2; \
        exit 1 ;; \
    esac

WORKDIR /home/bun/app/{{appPath}}
RUN bun run compile

# -------------------------------------------------------------------------------
# Production stage
# -------------------------------------------------------------------------------
FROM docker.io/nginxinc/nginx-unprivileged:1.30.4-alpine AS production

ARG APP_BUILD_COMMIT=
LABEL org.opencontainers.image.revision="${APP_BUILD_COMMIT}"

# The base image's entrypoint turns every /etc/nginx/templates/*.template into /etc/nginx/conf.d/*,
# replacing ${API_UPSTREAM} and leaving nginx's own variables ($uri, $host) as they are.
COPY --from=builder /home/bun/app/{{appPath}}/.configs/builders/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder --chown=101:101 /home/bun/app/{{appPath}}/dist /usr/share/nginx/html

# The runtime config: this script writes /usr/share/nginx/html/config.js from the VITE_ environment variables
# when the container starts. 0755 because the base entrypoint skips a script without the executable bit; the
# file it rewrites is the one the build copied from src/public, owned by 101 above.
COPY --from=builder --chmod=0755 /home/bun/app/{{appPath}}/.configs/builders/docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

# Where /api goes: a compose service name, a cluster service, an address (an origin, with no path).
ENV API_UPSTREAM=http://api:3000

# The variables the app cannot run without, comma separated. A container that starts without one of them,
# or with it empty, stops and names it instead of falling back to a build-time value. Any name works, not
# only VITE_ ones; `-e APP_REQUIRED_ENV=...` overrides the list for one environment. Uncomment and list yours:
# ENV APP_REQUIRED_ENV=VITE_API_URL

# The base image reads the DNS servers of /etc/resolv.conf into ${NGINX_LOCAL_RESOLVERS}, which the template
# gives to `resolver`: nginx looks the upstream up per request, so the container starts without it.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

# No ENTRYPOINT on purpose: the base image's /docker-entrypoint.sh renders the templates and runs the
# scripts of /docker-entrypoint.d/ (a custom ENTRYPOINT would replace it and skip both).
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
