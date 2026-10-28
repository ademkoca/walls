# syntax=docker/dockerfile:1
# Walls web image (Next.js standalone server), built from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://walls.rs .
# Deployment: deploy/README.md.

FROM node:22-bookworm-slim AS base
WORKDIR /repo
# The pnpm version pinned in package.json (Node 22's Corepack cannot run pnpm 12).
COPY package.json ./
RUN npm install --global "$(node -p "require('./package.json').packageManager")"

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@walls/web..."
# Read at build time: compiled into the pages (site URL, map tiles, the demo-site banner) and
# the response headers (SITE_INDEXING=off for a preview). Changing one needs a new image.
ARG NEXT_PUBLIC_SITE_URL
ARG SITE_INDEXING
ARG NEXT_PUBLIC_DEMO_SITE
ARG NEXT_PUBLIC_MAP_TILE_URL
ARG NEXT_PUBLIC_MAP_ATTRIBUTION
# The API container's address on the Compose network (deploy/compose.yaml); compiled into
# the /api rewrite, although Caddy sends /api requests to the API directly.
ENV NEXT_OUTPUT=standalone \
    API_INTERNAL_URL=http://api:4000 \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @walls/web build

FROM node:22-bookworm-slim
# HOSTNAME must be 0.0.0.0: Docker sets it to the container ID, and the standalone server
# listens on HOSTNAME.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
