# Insurance Platform

This repository contains the implementation of a next-generation insurance platform built with a microservices architecture using Go and Python. The platform leverages a modern technology stack to provide a scalable, resilient, and secure solution for insurance policy management, payments, and analytics.

## Architecture

The platform is designed as a set of loosely coupled microservices that communicate via gRPC and a Kafka event bus. This design allows for independent development, deployment, and scaling of each service.

### Key Components

- **Payment Service (Go):** Handles all financial transactions, integrating with TigerBeetle for atomic, double-entry accounting.
- **Policy Service (Go):** Manages the lifecycle of insurance policies, from creation to renewal and cancellation. It uses Temporal for orchestrating complex business workflows.
- **Verification Service (Python):** Provides NIN (National Identification Number) and CAC (Corporate Affairs Commission) verification by integrating with external APIs.
- **Mojaloop Integration:** The platform is designed to integrate with Mojaloop for interoperable mobile payments, following the Mojaloop API specification.
- **Lakehouse Architecture:** A comprehensive data platform for advanced analytics, built on Delta Lake, Apache Spark, Apache Flink, and Ray. It supports both streaming and batch processing for real-time insights and machine learning.
- **Observability and Security:** The platform includes a robust observability stack with OpenSearch, Grafana, and Prometheus. Security is enhanced with Wazuh for threat detection and OpenAppSec for web application security.

## Technology Stack

- **Backend:** Go, Python
- **Databases:** PostgreSQL, TigerBeetle, Redis
- **Messaging:** Kafka, Fluvio
- **Workflow Engine:** Temporal
- **Service Mesh:** Dapr
- **API Gateway:** APISIX
- **Security:** OpenAppSec, Wazuh, OpenCTI
- **Data Platform:** Delta Lake, Apache Spark, Apache Flink, Ray, Apache Sedona, Apache DataFusion
- **Deployment:** Kubernetes, Helm

## Getting Started

### Prerequisites

- Docker
- Kubernetes cluster
- Helm 3

### Deployment

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-repo/insurance-platform.git
   cd insurance-platform
   ```

2. **Build Docker images for each service:**

   ```bash
   docker build -t insurance-platform/payment-service:latest ./payment-service
   docker build -t insurance-platform/policy-service:latest ./policy-service
   docker build -t insurance-platform/verification-service:latest ./verification-service
   ```

3. **Deploy the platform using Helm:**

   ```bash
   helm install insurance-platform ./helm/insurance-platform
   ```

This will deploy all the microservices and their dependencies to your Kubernetes cluster.

## Usage

Once the platform is deployed, you can access the API Gateway to interact with the services. The API documentation can be found at the `/docs` endpoint of each service.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
