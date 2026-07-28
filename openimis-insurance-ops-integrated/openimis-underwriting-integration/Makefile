.PHONY: all build clean k8s-apply

PRODUCER_DIR := underwriting-producer
CONSUMER_DIR := openimis-consumer
K8S_DIR := k8s

all: build

build: build-producer build-consumer

build-producer:
	@echo "Building Underwriting Producer..."
	@cd $(PRODUCER_DIR) && go mod tidy
	@docker build -t underwriting-producer:latest -f $(PRODUCER_DIR)/Dockerfile .

build-consumer:
	@echo "Building OpenIMIS Consumer..."
	@cd $(CONSUMER_DIR) && go mod tidy
	@docker build -t openimis-consumer:latest -f $(CONSUMER_DIR)/Dockerfile .

k8s-apply:
	@echo "Applying Kubernetes manifests..."
	@kubectl apply -f $(K8S_DIR)/underwriting-producer.yaml
	@kubectl apply -f $(K8S_DIR)/openimis-consumer.yaml

clean:
	@echo "Cleaning up..."
	@rm -f $(PRODUCER_DIR)/underwriting-producer
	@rm -f $(CONSUMER_DIR)/openimis-consumer
	@rm -rf $(PRODUCER_DIR)/pkg/events
	@rm -rf $(CONSUMER_DIR)/pkg/events
	@rm -f $(PRODUCER_DIR)/go.sum
	@rm -f $(CONSUMER_DIR)/go.sum
