.PHONY: help build up down restart logs logs-mongodb clean dev prod rebuild rebuild-prod backup

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

rebuild-prod: ## Rebuild and restart production services
	docker compose --profile prod down
	docker compose --profile prod build --no-cache
	docker compose --profile prod up -d bot-prod

backup: ## Backup MongoDB database
	@mkdir -p ./backups
	@echo "Creating database backup..."
	@docker compose exec -T mongodb bash -c 'mongodump \
		--host=localhost \
		--port=27017 \
		--authenticationDatabase=admin \
		--username="$$MONGO_INITDB_ROOT_USERNAME" \
		--password="$$MONGO_INITDB_ROOT_PASSWORD" \
		--db=vikala-dev \
		--out=/tmp/backup; \
		mkdir -p /tmp/backup'
	@docker cp vikala-mongodb:/tmp/backup ./backups/vikala-$(shell date +%Y%m%d-%H%M%S)
	@docker compose exec -T mongodb rm -rf /tmp/backup
	@echo "Backup created in ./backups/"

restore: ## Restore MongoDB database (requires BACKUP_DIR variable)
	@if [ -z "$(BACKUP_DIR)" ]; then \
		echo "Error: BACKUP_DIR not specified"; \
		echo "Usage: make restore BACKUP_DIR=./backups/db-20240101-120000"; \
		exit 1; \
	fi
	@echo "Restoring database from $(BACKUP_DIR)..."
	@docker cp $(BACKUP_DIR) vikala-mongodb:/tmp/restore
	@docker compose exec -T mongodb bash -c 'mongorestore \
		--host=localhost \
		--port=27017 \
		--authenticationDatabase=admin \
		--username="$$MONGO_INITDB_ROOT_USERNAME" \
		--password="$$MONGO_INITDB_ROOT_PASSWORD" \
		--db=vikala-dev \
		/tmp/restore/vikala'
	@docker compose exec -T mongodb rm -rf /tmp/restore
	@echo "Database restored successfully"

status: ## Show status of all services
	docker compose ps

shell: ## Open shell in bot container (dev)
	docker compose exec bot sh

shell-prod: ## Open shell in production bot container
	docker compose --profile prod exec bot-prod sh

shell-mongodb: ## Open MongoDB shell
	docker compose exec mongodb mongosh \
		mongodb://$${MONGO_ROOT_USERNAME}:$${MONGO_ROOT_PASSWORD}@localhost:27017/$${MONGO_DATABASE:-vikala}?authSource=admin
