.PHONY: help build up down restart logs logs-mongodb clean dev prod rebuild backup

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker images
	docker compose build

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

restart: ## Restart the bot (dev)
	docker compose restart bot

restart-prod: ## Restart production bot
	docker compose restart bot-prod

logs: ## View bot logs (dev, follow)
	docker compose logs -f bot

logs-prod: ## View production bot logs
	docker compose logs -f bot-prod

logs-mongodb: ## View MongoDB logs
	docker compose logs -f mongodb

logs-all: ## View all service logs
	docker compose logs -f

clean: ## Stop services and remove volumes (WARNING: deletes database!)
	@echo "WARNING: This will delete all database data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v; \
	fi

dev: ## Start in development mode (default)
	docker compose up -d bot

prod: ## Start in production mode
	docker compose --profile prod up -d bot-prod

rebuild: ## Rebuild and restart services
	docker compose down
	docker compose build --no-cache
	docker compose up -d

backup: ## Backup MongoDB database
	@mkdir -p ./backups
	docker compose exec mongodb mongodump \
		--uri="mongodb://$${MONGO_ROOT_USERNAME}:$${MONGO_ROOT_PASSWORD}@localhost:27017/$${MONGO_DATABASE:-vikala}?authSource=admin" \
		--out=/tmp/backup
	docker cp vikala-mongodb:/tmp/backup ./backups/vikala-$(shell date +%Y%m%d-%H%M%S)
	@echo "Backup created in ./backups/"

restore: ## Restore MongoDB database (requires BACKUP_DIR variable)
	@if [ -z "$(BACKUP_DIR)" ]; then \
		echo "Error: BACKUP_DIR not specified"; \
		echo "Usage: make restore BACKUP_DIR=./backups/vikala-20240101-120000"; \
		exit 1; \
	fi
	docker cp $(BACKUP_DIR) vikala-mongodb:/tmp/restore
	docker compose exec mongodb mongorestore \
		--uri="mongodb://$${MONGO_ROOT_USERNAME}:$${MONGO_ROOT_PASSWORD}@localhost:27017/$${MONGO_DATABASE:-vikala}?authSource=admin" \
		/tmp/restore

status: ## Show status of all services
	docker compose ps

shell: ## Open shell in bot container (dev)
	docker compose exec bot sh

shell-prod: ## Open shell in production bot container
	docker compose --profile prod exec bot-prod sh

shell-mongodb: ## Open MongoDB shell
	docker compose exec mongodb mongosh \
		mongodb://$${MONGO_ROOT_USERNAME}:$${MONGO_ROOT_PASSWORD}@localhost:27017/$${MONGO_DATABASE:-vikala}?authSource=admin
