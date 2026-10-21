# The image of {{app}}: the app compiled by Vite, served by nginx.
#
# Build it from the monorepo root, so the workspace packages and the lockfile are in the context:
#
#   docker build -f {{appPath}}/.configs/builders/Dockerfile -t {{app}} \
#     --build-arg APP_BUILD_COMMIT="$(git rev-parse HEAD)" \
#     --build-arg APP_BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)" .
#   docker run --rm -p 8080:8080 -e API_UPSTREAM=http://api:3000 {{app}}
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
# without it stops here: an image must always say which commit it runs.
ARG APP_BUILD_COMMIT=
ARG APP_BUILD_BRANCH=
ARG APP_BUILD_VERSION=
RUN test -n "$APP_BUILD_COMMIT" || { echo "Pass --build-arg APP_BUILD_COMMIT=\$(git rev-parse HEAD)" >&2; exit 1; }

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

# Where /api goes: a compose service name, a cluster service, an address.
ENV API_UPSTREAM=http://api:3000

# No ENTRYPOINT on purpose: the base image's /docker-entrypoint.sh renders the templates.
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
