#!/bin/bash
set -e

# Document Intelligence Platform - Kubernetes Deployment Script
# This script deploys the complete HA infrastructure

NAMESPACE_INFRA="document-intelligence-infra"
NAMESPACE_APP="document-intelligence"

echo "=========================================="
echo "Document Intelligence Platform Deployment"
echo "=========================================="

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        echo "ERROR: kubectl is not installed"
        exit 1
    fi
    
    if ! command -v kustomize &> /dev/null; then
        echo "WARNING: kustomize is not installed, using kubectl kustomize"
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        echo "ERROR: Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    echo "Prerequisites check passed"
}

# Create namespaces
create_namespaces() {
    echo "Creating namespaces..."
    kubectl apply -f base/namespace.yaml
}

# Deploy infrastructure services
deploy_infrastructure() {
    echo "Deploying infrastructure services..."
    
    # Deploy PostgreSQL first (dependency for many services)
    echo "  - Deploying PostgreSQL HA..."
    kubectl apply -f base/postgresql-ha.yaml
    kubectl wait --for=condition=ready pod -l app=postgresql -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy Redis
    echo "  - Deploying Redis HA..."
    kubectl apply -f redis/redis-ha.yaml
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy Kafka
    echo "  - Deploying Kafka HA..."
    kubectl apply -f kafka/kafka-ha.yaml
    kubectl wait --for=condition=ready pod -l app=kafka -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy etcd for APISIX
    echo "  - Deploying etcd for APISIX..."
    kubectl apply -f apisix/apisix-ha.yaml
    kubectl wait --for=condition=ready pod -l app=etcd -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy APISIX
    echo "  - Deploying APISIX HA..."
    kubectl wait --for=condition=ready pod -l app=apisix -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy Temporal
    echo "  - Deploying Temporal HA..."
    kubectl apply -f temporal/temporal-ha.yaml
    kubectl wait --for=condition=ready pod -l app=temporal -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy Keycloak
    echo "  - Deploying Keycloak HA..."
    kubectl apply -f keycloak/keycloak-ha.yaml
    kubectl wait --for=condition=ready pod -l app=keycloak -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy Permify
    echo "  - Deploying Permify HA..."
    kubectl apply -f permify/permify-ha.yaml
    kubectl wait --for=condition=ready pod -l app=permify -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy TigerBeetle
    echo "  - Deploying TigerBeetle HA..."
    kubectl apply -f tigerbeetle/tigerbeetle-ha.yaml
    kubectl wait --for=condition=ready pod -l app=tigerbeetle -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy Dapr
    echo "  - Deploying Dapr HA..."
    kubectl apply -f dapr/dapr-ha.yaml
    
    # Deploy Fluvio
    echo "  - Deploying Fluvio HA..."
    kubectl apply -f fluvio/fluvio-ha.yaml
    kubectl wait --for=condition=ready pod -l app=fluvio-sc -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy Lakehouse (Spark + MinIO)
    echo "  - Deploying Lakehouse HA..."
    kubectl apply -f lakehouse/lakehouse-ha.yaml
    kubectl wait --for=condition=ready pod -l app=spark-master -n $NAMESPACE_INFRA --timeout=300s || true
    kubectl wait --for=condition=ready pod -l app=minio -n $NAMESPACE_INFRA --timeout=300s || true
    
    # Deploy OpenAppSec
    echo "  - Deploying OpenAppSec HA..."
    kubectl apply -f openappsec/openappsec-ha.yaml
    
    echo "Infrastructure deployment complete"
}

# Deploy application services
deploy_application() {
    echo "Deploying application services..."
    kubectl apply -f application/document-intelligence.yaml
    
    echo "Waiting for application pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=backend-api -n $NAMESPACE_APP --timeout=300s || true
    kubectl wait --for=condition=ready pod -l app=frontend -n $NAMESPACE_APP --timeout=300s || true
    kubectl wait --for=condition=ready pod -l app=ocr-service -n $NAMESPACE_APP --timeout=300s || true
    
    echo "Application deployment complete"
}

# Initialize databases
init_databases() {
    echo "Initializing databases..."
    kubectl apply -f base/postgresql-ha.yaml -l job-name=postgresql-init-databases
    kubectl wait --for=condition=complete job/postgresql-init-databases -n $NAMESPACE_INFRA --timeout=120s || true
}

# Initialize Kafka topics
init_kafka_topics() {
    echo "Initializing Kafka topics..."
    kubectl apply -f kafka/kafka-ha.yaml -l job-name=kafka-topic-init
    kubectl wait --for=condition=complete job/kafka-topic-init -n $NAMESPACE_INFRA --timeout=120s || true
}

# Initialize Fluvio topics
init_fluvio_topics() {
    echo "Initializing Fluvio topics..."
    kubectl apply -f fluvio/fluvio-ha.yaml -l job-name=fluvio-topic-init
    kubectl wait --for=condition=complete job/fluvio-topic-init -n $NAMESPACE_INFRA --timeout=120s || true
}

# Get service URLs
get_service_urls() {
    echo ""
    echo "=========================================="
    echo "Service URLs"
    echo "=========================================="
    
    APISIX_IP=$(kubectl get svc apisix -n $NAMESPACE_INFRA -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    echo "API Gateway: http://$APISIX_IP"
    
    echo ""
    echo "Internal Services:"
    echo "  - Backend API: http://backend-api.$NAMESPACE_APP:8001"
    echo "  - Frontend: http://frontend.$NAMESPACE_APP:3000"
    echo "  - OCR Service: http://ocr-service.$NAMESPACE_APP:9002"
    echo "  - Lakehouse API: http://lakehouse-api.$NAMESPACE_INFRA:8002"
    echo "  - Temporal UI: http://temporal-ui.$NAMESPACE_INFRA:8080"
    echo "  - Keycloak: http://keycloak.$NAMESPACE_INFRA:8080"
    echo "  - Grafana: http://grafana.$NAMESPACE_INFRA:3000"
    echo "  - Spark UI: http://spark-master.$NAMESPACE_INFRA:8080"
    echo "  - MinIO Console: http://minio.$NAMESPACE_INFRA:9001"
}

# Health check
health_check() {
    echo ""
    echo "=========================================="
    echo "Health Check"
    echo "=========================================="
    
    echo "Infrastructure pods:"
    kubectl get pods -n $NAMESPACE_INFRA -o wide
    
    echo ""
    echo "Application pods:"
    kubectl get pods -n $NAMESPACE_APP -o wide
    
    echo ""
    echo "Services:"
    kubectl get svc -n $NAMESPACE_INFRA
    kubectl get svc -n $NAMESPACE_APP
}

# Main deployment
main() {
    case "${1:-deploy}" in
        deploy)
            check_prerequisites
            create_namespaces
            deploy_infrastructure
            init_databases
            init_kafka_topics
            init_fluvio_topics
            deploy_application
            get_service_urls
            health_check
            ;;
        infrastructure)
            check_prerequisites
            create_namespaces
            deploy_infrastructure
            init_databases
            init_kafka_topics
            init_fluvio_topics
            ;;
        application)
            check_prerequisites
            deploy_application
            ;;
        status)
            health_check
            ;;
        urls)
            get_service_urls
            ;;
        *)
            echo "Usage: $0 {deploy|infrastructure|application|status|urls}"
            exit 1
            ;;
    esac
}

main "$@"
