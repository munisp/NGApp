APP_NAME=underwriting-risk-integrator
BUILD_DIR=./bin
CMD_DIR=./cmd
CONFIG_DIR=./configs
K8S_DIR=./deployments

.PHONY: all build run clean docker-build docker-push k8s-apply

all: build

build:
	@echo "Building $(APP_NAME)..."
	@go build -o $(BUILD_DIR)/$(APP_NAME) $(CMD_DIR)/main.go

run: build
	@echo "Running $(APP_NAME)..."
	@$(BUILD_DIR)/$(APP_NAME)

clean:
	@echo "Cleaning up..."
	@rm -rf $(BUILD_DIR)
	@go clean

docker-build:
	@echo "Building Docker image..."
	@docker build -t $(APP_NAME):latest .

docker-push:
	@echo "Pushing Docker image (requires login)..."
	@docker push $(APP_NAME):latest

k8s-apply:
	@echo "Applying Kubernetes manifests..."
	@kubectl apply -f $(K8S_DIR)/k8s.yaml
