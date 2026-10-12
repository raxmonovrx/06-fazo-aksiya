# Kontekst = repo ildizi
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat && corepack enable
WORKDIR /app

FROM base AS build
ENV DATABASE_URL="postgresql://u:p@localhost:5432/db"
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @fazo/api...
COPY apps/api apps/api
RUN pnpm --filter @fazo/api exec prisma generate && pnpm --filter @fazo/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
RUN mkdir -p /app/storage && chown node:node /app/storage
WORKDIR /app/apps/api
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA STORAGE_DIR=/app/storage
USER node
EXPOSE 4600
# Migratsiya → seed (idempotent) → API
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/seed.js && node dist/main.js"]
