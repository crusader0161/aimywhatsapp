.PHONY: setup dev build start stop clean reset logs db-migrate db-studio

# First-time setup
setup:
	@echo "🚀 Setting up Aimywhatsapp..."
	@[ -f .env ] || cp .env.example .env && echo "📋 .env created from .env.example — please edit it"
	@docker compose -f docker-compose.dev.yml up -d
	@sleep 5
	@npm install
	@cd apps/api && npx prisma generate && npx prisma migrate dev --name init
	@echo "✅ Setup complete! Run: make dev"

# Start development servers
dev:
	@docker compose -f docker-compose.dev.yml up -d
	@npm run dev

# Build for production
build:
	@npm run build

# Start infrastructure only
infra-up:
	@docker compose -f docker-compose.dev.yml up -d

# Stop infrastructure
infra-down:
	@docker compose -f docker-compose.dev.yml down

# Production deploy
start:
	@docker compose up -d

# Stop production
stop:
	@docker compose down

# View logs
logs:
	@docker compose logs -f

# Database migration
db-migrate:
	@cd apps/api && npx prisma migrate dev

# Database studio (UI)
db-studio:
	@cd apps/api && npx prisma studio

# Reset database (DANGEROUS)
db-reset:
	@cd apps/api && npx prisma migrate reset --force

# Generate Prisma client
db-generate:
	@cd apps/api && npx prisma generate

# Clean build artifacts
clean:
	@rm -rf apps/api/dist apps/web/.next
	@echo "✅ Cleaned"

# Full reset (DANGEROUS - deletes data)
reset:
	@docker compose -f docker-compose.dev.yml down -v
	@rm -rf apps/api/dist apps/web/.next node_modules apps/api/node_modules apps/web/node_modules
	@echo "✅ Full reset complete"

# Install deps
install:
	@npm install
