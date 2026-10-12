# Kontekst = repo ildizi
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @fazo/web...
COPY apps/web apps/web
ARG NEXT_PUBLIC_BOT_USERNAME=FazoClub_bot
ENV NEXT_PUBLIC_BOT_USERNAME=$NEXT_PUBLIC_BOT_USERNAME NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @fazo/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=4601
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 4601
CMD ["node", "apps/web/server.js"]
