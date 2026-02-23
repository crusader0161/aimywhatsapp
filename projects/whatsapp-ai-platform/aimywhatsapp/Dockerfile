FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Install all deps (hoisted via npm workspaces) ─────────────────────────────
FROM base AS deps
COPY package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY package-lock.json* ./
RUN npm install --legacy-peer-deps

# ── Build API ─────────────────────────────────────────────────────────────────
FROM base AS api-builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd apps/api && npx prisma generate && npm run build

# ── Build Web (standalone output) ─────────────────────────────────────────────
FROM base AS web-builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:7779/api/v1
ARG NEXT_PUBLIC_WS_URL=http://localhost:7779
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# --- API ---
COPY --from=api-builder /app/apps/api/dist        ./apps/api/dist
COPY --from=api-builder /app/apps/api/prisma      ./apps/api/prisma
# Copy ALL root node_modules (hoisted — contains everything the API needs)
COPY --from=api-builder /app/node_modules         ./node_modules

# --- Web (standalone) ---
# standalone server + its own mini node_modules
COPY --from=web-builder /app/apps/web/.next/standalone  ./apps/web/standalone
COPY --from=web-builder /app/apps/web/.next/static      ./apps/web/standalone/apps/web/.next/static
COPY --from=web-builder /app/apps/web/public            ./apps/web/standalone/apps/web/public

# Root manifests
COPY package.json turbo.json ./

# Data dirs
RUN mkdir -p data/uploads data/wa-sessions

# Startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000 3001

CMD ["./docker-entrypoint.sh"]
