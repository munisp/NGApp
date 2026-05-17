.PHONY: build run clean

SERVICE_NAME := payment-service
GO_FILES := $(wildcard *.go) $(wildcard */*.go)

build:
	@echo "Building $(SERVICE_NAME)..."
	@go build -o $(SERVICE_NAME) main.go

run: build
	@echo "Running $(SERVICE_NAME)..."
	@./$(SERVICE_NAME)

clean:
	@echo "Cleaning up..."
	@rm -f $(SERVICE_NAME)
	@rm -rf vendor
