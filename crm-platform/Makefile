.PHONY: help dev build test lint clean docker-up docker-down

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Frontend ---
dev: ## Start frontend dev server
	cd web && npm run dev

build: ## Production build
	cd web && npm run build

test-frontend: ## Run frontend unit tests
	cd web && npx vitest run

lint-frontend: ## Lint frontend code
	cd web && npx eslint src/

# --- Go Backend ---
go-build: ## Build Go services
	cd services/go/crm-services && go build ./cmd/main.go

go-test: ## Run Go tests
	cd services/go/crm-services && go test ./...

go-vet: ## Vet Go code
	cd services/go/crm-services && go vet ./cmd/

go-run: ## Run Go services
	cd services/go/crm-services && go run ./cmd/main.go

# --- Python ---
py-test: ## Run Python tests
	cd services/python/sales-agent && python -m pytest -v
	cd services/python/predictive-analytics && python -m pytest -v

# --- All Tests ---
test: test-frontend go-test py-test ## Run all tests

# --- Docker ---
docker-up: ## Start all Docker services
	docker compose -f deploy/docker/docker-compose.yml up -d

docker-down: ## Stop all Docker services
	docker compose -f deploy/docker/docker-compose.yml down

docker-build: ## Build Docker images
	docker compose -f deploy/docker/docker-compose.yml build

docker-infra: ## Start infrastructure only (postgres, redis, kafka)
	docker compose -f deploy/docker/docker-compose.yml up -d postgres redis kafka

# --- Cleanup ---
clean: ## Clean build artifacts
	rm -rf web/dist
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
