#!/bin/bash

echo "=========================================="
echo "Docker Deployment Package Verification"
echo "=========================================="
echo ""

check_file() {
    if [ -f "$1" ]; then
        echo "✓ $1"
        return 0
    else
        echo "✗ $1 NOT FOUND"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo "✓ $1/"
        return 0
    else
        echo "✗ $1/ NOT FOUND"
        return 1
    fi
}

cd /home/ubuntu/nextgen-payment-switch

echo "Core Deployment Files:"
echo "----------------------"
check_file "docker-compose.yml"
check_file ".env.example"
check_file "Makefile"
check_file "DOCKER_README.md"
check_file "DOCKER_DEPLOYMENT_GUIDE.md"

echo ""
echo "Service Dockerfiles:"
echo "--------------------"
check_file "services/payment-gateway/Dockerfile"
check_file "services/fraud-detection-service/Dockerfile"
check_file "services/settlement/Dockerfile"
check_file "services/offline-payments/Dockerfile"
check_file "services/fraud-detection/Dockerfile"

echo ""
echo "Database Schema:"
echo "----------------"
check_file "services/database/schema.sql"

echo ""
echo "Monitoring Configuration:"
echo "-------------------------"
check_file "monitoring/prometheus.yml"
check_file "monitoring/grafana/datasources/prometheus.yml"
check_dir "monitoring/grafana/dashboards"

echo ""
echo "NGINX Configuration:"
echo "--------------------"
check_file "nginx/nginx.conf"

echo ""
echo "Package Archive:"
echo "----------------"
check_file "/home/ubuntu/docker-deployment-package.zip"

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
