#!/bin/bash
# Aimywhatsapp — VPS Deploy Script (AlmaLinux 8 / RHEL)
# Safe for cPanel/WHM servers — does NOT touch Apache, MySQL, or port 80/443
set -e

REPO="https://github.com/crusader0161/aimywhatsapp.git"
DEPLOY_DIR="/opt/aimywhatsapp"
OPENROUTER_KEY="${OPENROUTER_API_KEY:-}"
JINA_KEY="${JINA_API_KEY:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

# ── 1. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo -y 2>/dev/null || true
  dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  log "Docker installed: $(docker --version)"
else
  log "Docker already installed: $(docker --version)"
fi

# ── 2. Open firewall ports (CSF safe) ────────────────────────────────────────
log "Opening ports 3000 and 3001 in CSF firewall..."
if command -v csf &>/dev/null; then
  # Add to CSF allow list only if not already there
  grep -q "^3000$" /etc/csf/csf.allow 2>/dev/null || echo "3000" >> /etc/csf/csf.allow
  grep -q "^3001$" /etc/csf/csf.allow 2>/dev/null || echo "3001" >> /etc/csf/csf.allow
  # Add to TCP_IN in csf.conf
  sed -i 's/^TCP_IN = "\(.*\)"/TCP_IN = "\1,3000,3001"/' /etc/csf/csf.conf 2>/dev/null || true
  csf -r 2>/dev/null || true
  log "CSF firewall updated"
else
  # Fallback: firewalld
  firewall-cmd --permanent --add-port=3000/tcp --add-port=3001/tcp 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
  log "firewalld updated"
fi

# ── 3. Clone / Update repo ────────────────────────────────────────────────────
if [ -d "$DEPLOY_DIR/.git" ]; then
  log "Updating existing repo..."
  cd "$DEPLOY_DIR" && git fetch origin && git reset --hard origin/main
else
  log "Cloning repo..."
  git clone "$REPO" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"

# ── 4. Generate secrets ───────────────────────────────────────────────────────
JWT_ACCESS=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
DB_PASS=$(openssl rand -base64 20 | tr -dc 'a-zA-Z0-9' | head -c 20)
REDIS_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)

# ── 5. Write .env ─────────────────────────────────────────────────────────────
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
log "Server IP: $SERVER_IP"

cat > .env << EOF
NODE_ENV=production
API_PORT=3001
WEB_PORT=3000
APP_URL=http://${SERVER_IP}:3000
API_URL=http://${SERVER_IP}:3001

# Database
DB_NAME=aimywhatsapp
DB_USER=aimybot
DB_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql://aimybot:${DB_PASS}@postgres:5432/aimywhatsapp

# Redis
REDIS_PASSWORD=${REDIS_PASS}
REDIS_URL=redis://:${REDIS_PASS}@redis:6379

# Qdrant
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=

# JWT (auto-generated)
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# AI
OPENROUTER_API_KEY=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
JINA_API_KEY=jina_c2b98eefdbc94d9b91fd7a3cf2b4a738Kkw2yP9oTZ358iYZzlkKtQsYb26y
DEFAULT_AI_MODEL=anthropic/claude-sonnet-4-5
JINA_EMBEDDING_MODEL=jina-embeddings-v3

# Storage
STORAGE_TYPE=local
STORAGE_PATH=./data/uploads
WA_SESSION_PATH=./data/wa-sessions

# Misc
LOG_LEVEL=info
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000
EOF

log ".env created"

# ── 6. Create data directories ────────────────────────────────────────────────
mkdir -p data/uploads data/wa-sessions
log "Data directories ready"

# ── 7. Build and start with Docker Compose ────────────────────────────────────
log "Pulling base images..."
docker compose pull postgres redis qdrant 2>/dev/null || docker-compose pull postgres redis qdrant

log "Starting infrastructure (postgres, redis, qdrant)..."
docker compose up -d postgres redis qdrant 2>/dev/null || docker-compose up -d postgres redis qdrant

log "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U aimybot -d aimywhatsapp &>/dev/null && break || true
  sleep 2
  echo -n "."
done
echo ""

log "Building application..."
docker compose build api web 2>/dev/null || docker-compose build api web

log "Running database migrations..."
docker compose run --rm api sh -c "npx prisma migrate deploy" 2>/dev/null || \
docker-compose run --rm api sh -c "npx prisma migrate deploy"

log "Starting all services..."
docker compose up -d 2>/dev/null || docker-compose up -d

# ── 8. Health check ───────────────────────────────────────────────────────────
log "Waiting for API to start..."
for i in $(seq 1 20); do
  curl -sf "http://localhost:3001/health" &>/dev/null && break || true
  sleep 3
  echo -n "."
done
echo ""

if curl -sf "http://localhost:3001/health" &>/dev/null; then
  log "✅ API is healthy!"
else
  warn "API health check failed — check logs: docker compose logs api"
fi

# ── 9. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Aimywhatsapp deployed successfully! 🎉   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Dashboard: ${GREEN}http://${SERVER_IP}:3000${NC}"
echo -e "  API:       ${GREEN}http://${SERVER_IP}:3001${NC}"
echo -e "  Health:    ${GREEN}http://${SERVER_IP}:3001/health${NC}"
echo ""
echo "  Logs:      docker compose logs -f"
echo "  Status:    docker compose ps"
echo ""
