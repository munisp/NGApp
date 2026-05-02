#!/bin/bash

# Create Kubernetes deployment files for all new services

BASE_DIR="/home/ubuntu/nextgen-payment-switch/deployment/kubernetes"

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
    mkdir -p $BASE_DIR/$service
    cat > $BASE_DIR/$service/deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $service
  template:
    metadata:
      labels:
        app: $service
    spec:
      containers:
      - name: $service
        image: nextgen-payment-switch/$service:latest
        ports:
        - containerPort: 8000
EOF

    cat > $BASE_DIR/$service/service.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: $service
spec:
  selector:
    app: $service
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
EOF
done

echo "Kubernetes deployment files created for all 13 new services!"

