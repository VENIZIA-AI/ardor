# The image of {{app}}: the app compiled by Vite, served by nginx.
#
# Build it from the monorepo root, so the workspace packages and the lockfile are in the context:
#
#   docker build -f {{appPath}}/.configs/builders/Dockerfile -t {{app}} .
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
RUN bun install --frozen-lockfile --ignore-scripts

# -------------------------------------------------------------------------------
# Build stage
# -------------------------------------------------------------------------------
FROM deps AS builder

WORKDIR /home/bun/app/{{appPath}}
# The build reads no environment file: what differs per environment is set when the container runs.
RUN rm -f .env .env.*
RUN bun run compile

# -------------------------------------------------------------------------------
# Production stage
# -------------------------------------------------------------------------------
FROM docker.io/nginxinc/nginx-unprivileged:1.30.4-alpine AS production

# The base image's entrypoint turns every /etc/nginx/templates/*.template into /etc/nginx/conf.d/*,
# replacing ${API_UPSTREAM} and leaving nginx's own variables ($uri, $host) as they are.
COPY --from=builder /home/bun/app/{{appPath}}/.configs/builders/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder --chown=101:101 /home/bun/app/{{appPath}}/dist /usr/share/nginx/html

# Where /api goes. It must resolve when nginx starts: a compose service name, a cluster service, an address.
ENV API_UPSTREAM=http://api:3000

# No ENTRYPOINT on purpose: the base image's /docker-entrypoint.sh renders the templates.
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
