# AI-Powered Fraud Detection Service

This document provides a comprehensive overview of the AI-Powered Fraud Detection service, including its architecture, implementation details, and deployment instructions.

## 1. Overview

The AI-Powered Fraud Detection service is a real-time, high-performance microservice designed to score financial transactions for fraud risk. It leverages a hybrid approach, combining Graph Neural Networks (GNNs), traditional machine learning models, and a rule-based engine to achieve high accuracy and explainability. The service is optimized for low-latency scoring, consistently achieving a p99 latency of less than 100ms.

### Key Features

- **Hybrid Fraud Detection**: Combines GNNs, ML, and rules for a comprehensive approach.
- **Real-Time Scoring**: Provides fraud scores in under 100ms.
- **High Throughput**: Designed to handle thousands of transactions per second.
- **Scalable**: Deployed on Kubernetes with Horizontal Pod Autoscaling (HPA).
- **Resilient**: Built with Dapr for service discovery, retries, and circuit breaking.
- **Observable**: Exposes Prometheus metrics for monitoring and alerting.

## 2. Architecture

The service follows a microservices architecture and is designed to be deployed as a containerized application on Kubernetes. It integrates with other platform components such as Redis for caching, Kafka for event streaming, and a PostgreSQL database for storing historical data.

### Data Flow

1.  **Request Ingestion**: The service receives a transaction scoring request via its REST API.
2.  **Feature Extraction**: It asynchronously fetches historical data from Redis and extracts a rich set of features from the transaction.
3.  **Parallel Scoring**: The service concurrently scores the transaction using three different methods:
    *   **GNN Model**: A Graph Attention Network (GAT) analyzes the transaction in the context of its local network to identify suspicious patterns.
    *   **ML Model**: A pre-trained gradient boosting model (XGBoost or LightGBM) scores the transaction based on its features.
    *   **Rule Engine**: A set of hand-crafted rules flags transactions that match known fraud patterns.
4.  **Ensemble Scoring**: The scores from the three methods are combined using a weighted average to produce a final fraud score.
5.  **Risk Assessment**: The final score is used to determine a risk level (LOW, MEDIUM, HIGH, CRITICAL).
6.  **Response Generation**: The service returns a detailed response including the fraud score, risk level, and an explanation of the decision.

## 3. Code Implementation (`main.py`)

The service is implemented in Python using FastAPI for the web framework and PyTorch Geometric for the GNN model.

### GNN Model Integration (`TransactionGNN` class)

The core of the AI-powered fraud detection is the `TransactionGNN` model, which is a Graph Attention Network (GAT). This model is specifically designed to capture the complex relationships between entities in a financial transaction network.

- **Graph Construction**: For each incoming transaction, a localized graph is constructed in real-time. This graph includes the current transaction, the payer, the payee, and their recent transaction history.
- **Feature Engineering**: The nodes in the graph are enriched with a variety of features, including transaction amount, channel, time, and historical behavior.
- **Attention Mechanism**: The GAT model uses a self-attention mechanism to weigh the importance of different nodes in the graph, allowing it to focus on the most relevant information for fraud detection.
- **Inference**: The model performs a forward pass on the graph to compute a fraud probability score.

### <100ms Scoring Logic

Achieving a p99 latency of less than 100ms for fraud scoring is a critical requirement. This is accomplished through a combination of optimizations:

- **Asynchronous Operations**: The service uses `asyncio` to perform I/O-bound operations (e.g., fetching data from Redis) and CPU-bound operations (e.g., model inference) in parallel.
- **Model Quantization**: The PyTorch GNN model is quantized to 8-bit integers (`qint8`), which significantly reduces the model size and speeds up inference on CPU.
- **Optimized Data Structures**: The service uses efficient data structures and algorithms for feature extraction and graph construction.
- **Caching**: Historical user data and transaction networks are cached in Redis to minimize database queries.
- **Connection Pooling**: The Redis client uses a connection pool to avoid the overhead of establishing new connections for each request.
- **Efficient Web Server**: Uvicorn is used as the ASGI server, which is known for its high performance.

## 4. Dapr Integration (`fraud-detection-dapr.yaml`)

The service is fully integrated with Dapr to leverage its powerful building blocks for building resilient and observable microservices.

- **State Management**: Dapr is used to manage the service's state in Redis, providing a consistent and reliable way to store and retrieve data.
- **Pub/Sub**: The service subscribes to a Kafka topic for asynchronous event-driven processing.
- **Service Invocation**: Dapr is used for secure and reliable service-to-service communication.
- **Resiliency**: The Dapr manifest defines resiliency policies, including timeouts, retries, and circuit breakers, to handle failures gracefully.
- **Observability**: Dapr provides distributed tracing and metrics out of the box, which are integrated with Zipkin and Prometheus.

## 5. Kubernetes Deployment (`fraud-detection-service.yaml`)

The service is designed to be deployed on Kubernetes with a production-ready configuration.

- **High Availability**: The deployment is configured with multiple replicas and a Pod Disruption Budget (PDB) to ensure high availability.
- **Autoscaling**: A Horizontal Pod Autoscaler (HPA) is configured to automatically scale the number of replicas based on CPU, memory, and custom metrics.
- **Resource Management**: The deployment specifies resource requests and limits to ensure predictable performance and prevent resource contention.
- **Health Checks**: Liveness, readiness, and startup probes are configured to ensure the service is healthy and ready to receive traffic.
- **Security**: The deployment runs as a non-root user and includes a NetworkPolicy to restrict ingress and egress traffic.

## 6. How to Run

1.  **Build the Docker image**:

    ```bash
    docker build -t fraud-detection-service:latest .
    ```

2.  **Deploy to Kubernetes**:

    ```bash
    kubectl apply -f ../../deployment/kubernetes/fraud-detection-service.yaml
    kubectl apply -f ../../deployment/dapr/fraud-detection-dapr.yaml
    ```

3.  **Send a scoring request**:

    ```bash
    curl -X POST http://<fraud-detection-service-ip>:8000/score -H "Content-Type: application/json" -d @sample-transaction.json
    ```

## 7. Conclusion

The AI-Powered Fraud Detection service is a critical component of the Next-Generation Payment Switch, providing a powerful and scalable solution for real-time fraud detection. By combining state-of-the-art AI techniques with a robust and resilient architecture, the service helps to protect the platform and its users from financial fraud.

