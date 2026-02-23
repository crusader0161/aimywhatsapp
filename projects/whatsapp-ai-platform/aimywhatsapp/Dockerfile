FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Install all deps ──────────────────────────────────────────────────────────
FROM base AS deps
# Copy workspace manifests
COPY package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
# Copy lockfile if it exists (use .dockerignore to exclude node_modules)
COPY package-lock.json* ./
RUN npm install --legacy-peer-deps

# ── Build API ─────────────────────────────────────────────────────────────────
FROM base AS api-builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd apps/api && npx prisma generate && npm run build

# ── Build Web ─────────────────────────────────────────────────────────────────
FROM base AS web-builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy API build
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=api-builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Web build
COPY --from=web-builder /app/apps/web/.next ./apps/web/.next
COPY --from=web-builder /app/apps/web/public ./apps/web/public
COPY --from=web-builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=web-builder /app/apps/web/package.json ./apps/web/package.json

# Root manifests
COPY package.json turbo.json ./

# Data dirs
RUN mkdir -p data/uploads data/wa-sessions

# Startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000 3001

CMD ["./docker-entrypoint.sh"]
