#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║      Aimywhatsapp Setup Script       ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# Check node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Found: $(node -v)"
  exit 1
fi

# Check .env
if [ ! -f .env ]; then
  echo -e "${YELLOW}📋 Creating .env from .env.example...${NC}"
  cp .env.example .env
  echo -e "${YELLOW}⚠️  Please edit .env and add your API keys before continuing.${NC}"
  echo ""
  echo "  Required:"
  echo "  - ANTHROPIC_API_KEY"
  echo "  - OPENAI_API_KEY (for embeddings)"
  echo "  - JWT_ACCESS_SECRET + JWT_REFRESH_SECRET (run: openssl rand -hex 32)"
  echo "  - ENCRYPTION_KEY (run: openssl rand -hex 16)"
  echo ""
  read -p "Press Enter after editing .env to continue..."
fi

# Start infrastructure
echo -e "${GREEN}🐳 Starting infrastructure (PostgreSQL, Redis, Qdrant)...${NC}"
docker compose -f docker-compose.dev.yml up -d

# Wait for PostgreSQL
echo -e "${YELLOW}⏳ Waiting for PostgreSQL...${NC}"
sleep 5
until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U aimybot 2>/dev/null; do
  sleep 2
done
echo "✅ PostgreSQL ready"

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm install

# Generate Prisma client
echo -e "${GREEN}🗃️  Setting up database...${NC}"
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
cd ../..

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "  Start development servers:"
echo "  ${BLUE}npm run dev${NC}"
echo ""
echo "  Dashboard: http://localhost:3000"
echo "  API:       http://localhost:3001"
echo "  Qdrant UI: http://localhost:6333/dashboard"
echo ""
