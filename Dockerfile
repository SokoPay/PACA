# One image for both apps — docker-compose.prod.yml picks the process per service.
FROM node:22-bookworm-slim AS build

# Prisma's query engine needs OpenSSL at build (generate) and run time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The repo's .npmrc pins script-shell to Git Bash for Windows dev; it is excluded
# by .dockerignore, and this makes the intent explicit.
ENV npm_config_script_shell=/bin/sh \
    NEXT_TELEMETRY_DISABLED=1

# Manifests first so `npm ci` stays cached until dependencies actually change.
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN npm ci

COPY . .

# Inlined into the browser bundle at build time. "/api/v1" = same origin, routed
# to the API by Caddy.
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Public site address (canonical URLs, sitemap, social cards), Google Analytics 4
# measurement ID and Google Search Console verification code. Empty = feature off.
ARG NEXT_PUBLIC_SITE_URL=https://pac-a.org
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
ENV NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

RUN npm run db:generate \
  && npm run build --workspace=@paca/api \
  && npm run build --workspace=@paca/web

# Writable paths for the unprivileged runtime user: uploaded documents and
# Next's on-disk cache.
RUN mkdir -p /data/uploads \
  && chown -R node:node /data /app/apps/web/.next

ENV NODE_ENV=production
USER node
