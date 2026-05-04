#!/bin/bash

# Create Dockerfiles for all new services

BASE_DIR="/home/ubuntu/nextgen-payment-switch/services"

SERVICES=(
    "notification-service"
    "batch-processing-service"
    "qr-code-service"
    "social-graph-service"
    "pos-service"
    "p2p-service"
    "subscription-service"
    "invoicing-service"
    "erp-integration-service"
    "approval-workflow-service"
    "payroll-service"
    "corporate-onboarding-service"
    "advanced-analytics-service"
)

for service in "${SERVICES[@]}"; do
    cat > $BASE_DIR/$service/Dockerfile << EOF
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF
done

echo "Dockerfiles created for all 13 new services!"

