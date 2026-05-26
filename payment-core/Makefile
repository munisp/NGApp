.PHONY: help build up down restart logs ps clean test health backup

help:
	@echo "Next-Generation Payment Switch - Docker Deployment"
	@echo ""
	@echo "Available commands:"
	@echo "  make build     - Build all Docker images"
	@echo "  make up        - Start all services"
	@echo "  make down      - Stop all services"
	@echo "  make restart   - Restart all services"
	@echo "  make logs      - View logs from all services"
	@echo "  make ps        - List running services"
	@echo "  make clean     - Remove all containers and volumes"
	@echo "  make test      - Run health checks on all services"
	@echo "  make health    - Check health of all services"
	@echo "  make backup    - Backup PostgreSQL database"

build:
	@echo "Building Docker images..."
	docker-compose build

up:
	@echo "Starting all services..."
	docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 10
	@make health

down:
	@echo "Stopping all services..."
	docker-compose down

restart:
	@echo "Restarting all services..."
	docker-compose restart

logs:
	docker-compose logs -f

ps:
	docker-compose ps

clean:
	@echo "WARNING: This will remove all containers and volumes!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "Cleanup complete"; \
	fi

test:
	@echo "Running health checks..."
	@make health

health:
	@echo "Checking service health..."
	@echo ""
	@echo "Payment Gateway:"
	@curl -s http://localhost:8001/api/v1/payments/health || echo "  ✗ Not responding"
	@echo ""
	@echo "Fraud Detection Service:"
	@curl -s http://localhost:8002/api/v1/fraud/health || echo "  ✗ Not responding"
	@echo ""
	@echo "Settlement Service:"
	@curl -s http://localhost:8003/api/v1/settlement/health || echo "  ✗ Not responding"
	@echo ""
	@echo "Offline Payments:"
	@curl -s http://localhost:8004/api/v1/offline/health || echo "  ✗ Not responding"
	@echo ""
	@echo "Fraud Detection:"
	@curl -s http://localhost:8005/api/v1/fraud/health || echo "  ✗ Not responding"
	@echo ""

backup:
	@echo "Backing up PostgreSQL database..."
	@mkdir -p backups
	docker-compose exec -T postgres pg_dump -U payment_user payment_switch > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup complete: backups/backup_$$(date +%Y%m%d_%H%M%S).sql"

# Service-specific commands
logs-payment:
	docker-compose logs -f payment-gateway

logs-fraud:
	docker-compose logs -f fraud-detection-service

logs-settlement:
	docker-compose logs -f settlement-service

logs-offline:
	docker-compose logs -f offline-payments-service

logs-db:
	docker-compose logs -f postgres

# Scaling commands
scale-payment:
	docker-compose up -d --scale payment-gateway=3

scale-fraud:
	docker-compose up -d --scale fraud-detection-service=3
