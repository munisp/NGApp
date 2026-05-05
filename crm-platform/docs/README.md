# Proactive Fraud Prevention System

This directory contains the complete implementation of the Proactive Fraud Prevention system for the Banking CRM platform. The system detects suspicious transaction patterns and initiates outbound calls to customers in their preferred language to verify transactions before they become problematic.

## System Architecture

The system consists of the following components:

### Go Components

1. **Transaction Processor** (`transaction_processor/`)
   - Consumes transaction events from Kafka
   - Normalizes transaction data from multiple sources
   - Forwards transactions to the fraud detection engine

2. **Fraud Detection Engine** (`fraud_detection_engine/`)
   - Evaluates transactions against fraud detection rules
   - Calculates risk scores using ML models
   - Triggers appropriate actions based on risk assessment

3. **Case Management Service** (`case_management/`)
   - Manages fraud cases and investigations
   - Handles case resolution and follow-up actions
   - Provides case history and audit trail

4. **API Gateway** (`api_gateway/`)
   - Exposes RESTful APIs for system integration
   - Handles authentication and authorization
   - Provides API documentation via Swagger

### Python Components

1. **ML Risk Scoring Service** (`ml_risk_scoring/`)
   - Provides ML-based risk scoring for transactions
   - Handles model training and evaluation
   - Exposes prediction API for real-time scoring

2. **AI Telephony Integration** (`ai_telephony/`)
   - Manages outbound verification calls
   - Handles conversation flows in multiple Nigerian languages
   - Processes customer responses and updates case status

3. **Analytics Service** (`analytics/`)
   - Collects and processes system metrics
   - Generates performance reports and dashboards
   - Provides optimization recommendations

## Directory Structure

```
fraud-prevention/
├── go/
│   ├── transaction_processor/
│   ├── fraud_detection_engine/
│   ├── case_management/
│   ├── api_gateway/
│   └── common/
├── python/
│   ├── ml_risk_scoring/
│   ├── ai_telephony/
│   └── analytics/
├── kubernetes/
│   ├── deployments/
│   ├── services/
│   ├── configmaps/
│   └── secrets/
├── docker/
│   ├── go/
│   └── python/
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   └── test.sh
└── README.md
```

## Getting Started

### Prerequisites

- Go 1.21+
- Python 3.11+
- Docker and Docker Compose
- Kubernetes cluster
- Kafka cluster
- PostgreSQL database
- Redis cache
- Ollama with Llama 3 models

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/banking-crm.git
   cd banking-crm/enterprise-crm/banking-ai-telephony/fraud-prevention
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Run the setup script:
   ```bash
   ./scripts/setup.sh
   ```

4. Build the Docker images:
   ```bash
   docker-compose build
   ```

5. Deploy to Kubernetes:
   ```bash
   ./scripts/deploy.sh
   ```

## Usage

### API Endpoints

The system exposes the following API endpoints:

- `POST /api/v1/transactions` - Submit a transaction for fraud detection
- `GET /api/v1/cases/{case_id}` - Get fraud case details
- `PUT /api/v1/cases/{case_id}/resolve` - Resolve a fraud case
- `GET /api/v1/metrics` - Get system metrics and performance data

### Kafka Topics

The system uses the following Kafka topics:

- `banking.transactions` - Raw transaction events from various sources
- `fraud.detection.alerts` - Fraud detection alerts
- `fraud.verification.calls` - Verification call events
- `fraud.case.updates` - Fraud case status updates

## Development

### Building Go Components

```bash
cd go
make build
```

### Building Python Components

```bash
cd python
pip install -e .
```

### Running Tests

```bash
./scripts/test.sh
```

## Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

### Kubernetes (Production)

```bash
kubectl apply -f kubernetes/
```

## Monitoring

The system exposes Prometheus metrics at `/metrics` endpoints for each service. A Grafana dashboard is provided in `kubernetes/configmaps/grafana-dashboards.yaml`.

## License

This project is proprietary and confidential. All rights reserved.

