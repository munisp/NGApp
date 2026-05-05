.PHONY: dev build test lint clean

# Frontend
dev-web:
	cd web && npm run dev

build-web:
	cd web && npm run build

# Go services
build-go:
	cd services/go/crm-services && go build ./cmd/...

test-go:
	cd services/go/crm-services && go test ./...

lint-go:
	cd services/go/crm-services && golangci-lint run ./...

# Rust services
build-rust:
	cd services/rust/bulk-sender && cargo build
	cd services/rust/usage-metering && cargo build

test-rust:
	cd services/rust/bulk-sender && cargo test
	cd services/rust/usage-metering && cargo test

# Python services
install-python:
	cd services/python/campaign-analytics && pip install -r requirements.txt

# All
build: build-go build-rust build-web

test: test-go test-rust

# Docker
docker-up:
	cd deploy/docker && docker compose up -d

docker-down:
	cd deploy/docker && docker compose down

docker-build:
	cd deploy/docker && docker compose build

clean:
	cd services/go/crm-services && go clean ./...
	cd services/rust/bulk-sender && cargo clean
	cd services/rust/usage-metering && cargo clean
	cd web && rm -rf dist node_modules
