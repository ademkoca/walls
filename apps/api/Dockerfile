# syntax=docker/dockerfile:1
# Walls API image, built from the repository root:
#   docker build -f apps/api/Dockerfile .
# Runs the API (dist/server.mjs); `node dist/migrate.mjs` applies pending migrations.
# Deployment: deploy/README.md.

FROM node:22-bookworm-slim AS base
WORKDIR /repo
# The pnpm version pinned in package.json (Node 22's Corepack cannot run pnpm 12).
COPY package.json ./
RUN npm install --global "$(node -p "require('./package.json').packageManager")"

# Third-party production dependencies. The build bundles the workspace packages, so only
# their manifests are needed here; copying nothing else keeps this layer (and the image layer
# made from it) unchanged until a dependency changes. List every workspace package the API
# depends on.
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
COPY packages/validation/package.json packages/validation/
RUN pnpm --filter @walls/api deploy --prod /out

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@walls/api..."
RUN pnpm --filter @walls/api build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
# dist/migrate.mjs reads the SQL files from ../migrations.
COPY --from=build /repo/packages/database/migrations ./migrations
USER node
EXPOSE 4000
CMD ["node", "dist/server.mjs"]
