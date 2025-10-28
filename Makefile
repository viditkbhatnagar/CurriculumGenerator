.PHONY: help setup install dev build test lint format clean migrate deploy-staging deploy-production health-check backup

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Run initial setup
	@bash scripts/setup.sh

install: ## Install all dependencies
	@echo "Installing Node.js dependencies..."
	@npm install

dev: ## Start all services in development mode
	@bash scripts/dev.sh

build: ## Build all packages
	@npm run build

test: ## Run all tests
	@npm run test

lint: ## Lint all code
	@npm run lint

format: ## Format all code
	@npm run format

clean: ## Clean build artifacts and dependencies
	@echo "Cleaning build artifacts..."
	@rm -rf node_modules packages/*/node_modules packages/*/.next packages/*/dist packages/*/build
	@echo "Clean complete"

migrate: ## Run database migrations
	@cd packages/backend && npm run migrate

migrate-down: ## Rollback last migration
	@cd packages/backend && npm run migrate:down

# Deployment targets (Render)
deploy-staging: ## Deploy to staging environment on Render
	@./scripts/deploy.sh staging

deploy-production: ## Deploy to production environment on Render
	@./scripts/deploy.sh production

# Health checks
health-check: ## Run health checks on local services
	@./scripts/health-check.sh local

health-check-staging: ## Run health checks on staging
	@./scripts/health-check.sh staging

health-check-production: ## Run health checks on production
	@./scripts/health-check.sh production

# Database operations
db-seed: ## Seed database with sample data
	@cd packages/backend && npm run seed

db-reset: ## Reset database (WARNING: deletes all data)
	@cd packages/backend && npm run db:reset

# Backup
backup: ## Run manual backup
	@./scripts/backup.sh

# Local services management
services-start: ## Start local MongoDB and Redis
	@echo "Starting MongoDB..."
	@brew services start mongodb-community || sudo systemctl start mongod
	@echo "Starting Redis..."
	@brew services start redis || sudo systemctl start redis
	@echo "Services started"

services-stop: ## Stop local MongoDB and Redis
	@echo "Stopping MongoDB..."
	@brew services stop mongodb-community || sudo systemctl stop mongod
	@echo "Stopping Redis..."
	@brew services stop redis || sudo systemctl stop redis
	@echo "Services stopped"

services-status: ## Check status of local services
	@echo "MongoDB status:"
	@brew services list | grep mongodb || systemctl status mongod
	@echo ""
	@echo "Redis status:"
	@brew services list | grep redis || systemctl status redis
