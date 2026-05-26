#!/bin/bash

# Enterprise CRM Infrastructure Deployment Script
# This script deploys the complete infrastructure stack for the enterprise CRM system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE_ENTERPRISE_CRM="enterprise-crm"
NAMESPACE_DATA_PLATFORM="data-platform"
NAMESPACE_MONITORING="monitoring"
NAMESPACE_SECURITY="security"
KUBE_CONFIG_DIR="../infrastructure/kubernetes"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install kubectl first."
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm is not installed. Please install helm first."
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
    fi
    
    log "Prerequisites check completed successfully."
}

# Create namespaces
create_namespaces() {
    log "Creating namespaces..."
    
    kubectl apply -f "${KUBE_CONFIG_DIR}/namespace.yaml"
    
    # Wait for namespaces to be ready
    kubectl wait --for=condition=Active --timeout=60s namespace/${NAMESPACE_ENTERPRISE_CRM}
    kubectl wait --for=condition=Active --timeout=60s namespace/${NAMESPACE_DATA_PLATFORM}
    kubectl wait --for=condition=Active --timeout=60s namespace/${NAMESPACE_MONITORING}
    kubectl wait --for=condition=Active --timeout=60s namespace/${NAMESPACE_SECURITY}
    
    log "Namespaces created successfully."
}

# Install Strimzi Kafka Operator
install_kafka_operator() {
    log "Installing Strimzi Kafka Operator..."
    
    # Add Strimzi Helm repository
    helm repo add strimzi https://strimzi.io/charts/
    helm repo update
    
    # Install Strimzi operator
    helm upgrade --install strimzi-kafka-operator strimzi/strimzi-kafka-operator \
        --namespace ${NAMESPACE_DATA_PLATFORM} \
        --set watchAnyNamespace=true \
        --wait --timeout=600s
    
    # Wait for operator to be ready
    kubectl wait --for=condition=Ready --timeout=300s pod -l name=strimzi-cluster-operator -n ${NAMESPACE_DATA_PLATFORM}
    
    log "Strimzi Kafka Operator installed successfully."
}

# Deploy Kafka cluster
deploy_kafka() {
    log "Deploying Kafka cluster..."
    
    kubectl apply -f "${KUBE_CONFIG_DIR}/kafka-cluster.yaml"
    
    # Wait for Kafka cluster to be ready
    kubectl wait --for=condition=Ready --timeout=600s kafka/enterprise-kafka-cluster -n ${NAMESPACE_DATA_PLATFORM}
    
    log "Kafka cluster deployed successfully."
}

# Install Flink Operator
install_flink_operator() {
    log "Installing Flink Operator..."
    
    # Add Flink Helm repository
    helm repo add flink-operator-repo https://downloads.apache.org/flink/flink-kubernetes-operator-1.6.0/
    helm repo update
    
    # Install Flink operator
    helm upgrade --install flink-kubernetes-operator flink-operator-repo/flink-kubernetes-operator \
        --namespace ${NAMESPACE_DATA_PLATFORM} \
        --wait --timeout=600s
    
    log "Flink Operator installed successfully."
}

# Deploy Flink cluster
deploy_flink() {
    log "Deploying Flink cluster..."
    
    kubectl apply -f "${KUBE_CONFIG_DIR}/flink-cluster.yaml"
    
    # Wait for Flink cluster to be ready
    kubectl wait --for=condition=Ready --timeout=600s flinkdeployment/enterprise-flink-cluster -n ${NAMESPACE_DATA_PLATFORM}
    
    log "Flink cluster deployed successfully."
}

# Deploy Temporal
deploy_temporal() {
    log "Deploying Temporal workflow engine..."
    
    # First deploy PostgreSQL for Temporal
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo update
    
    helm upgrade --install postgresql bitnami/postgresql \
        --namespace ${NAMESPACE_ENTERPRISE_CRM} \
        --set auth.postgresPassword=postgres123 \
        --set auth.database=temporal \
        --set primary.persistence.size=20Gi \
        --wait --timeout=600s
    
    # Deploy Temporal server
    kubectl apply -f "${KUBE_CONFIG_DIR}/temporal-cluster.yaml"
    
    # Wait for Temporal to be ready
    kubectl wait --for=condition=Available --timeout=600s deployment/temporal-server -n ${NAMESPACE_ENTERPRISE_CRM}
    kubectl wait --for=condition=Available --timeout=600s deployment/temporal-web -n ${NAMESPACE_ENTERPRISE_CRM}
    
    log "Temporal workflow engine deployed successfully."
}

# Install Dapr
install_dapr() {
    log "Installing Dapr..."
    
    # Add Dapr Helm repository
    helm repo add dapr https://dapr.github.io/helm-charts/
    helm repo update
    
    # Install Dapr
    helm upgrade --install dapr dapr/dapr \
        --namespace dapr-system \
        --create-namespace \
        --set global.ha.enabled=true \
        --wait --timeout=600s
    
    # Deploy Dapr configuration
    kubectl apply -f "${KUBE_CONFIG_DIR}/dapr-config.yaml"
    
    log "Dapr installed successfully."
}

# Deploy Redis for state management
deploy_redis() {
    log "Deploying Redis for state management..."
    
    helm upgrade --install redis bitnami/redis \
        --namespace ${NAMESPACE_ENTERPRISE_CRM} \
        --set auth.password=redis_pass \
        --set master.persistence.size=10Gi \
        --set replica.replicaCount=2 \
        --set replica.persistence.size=10Gi \
        --wait --timeout=600s
    
    log "Redis deployed successfully."
}

# Deploy APISIX Gateway
deploy_apisix() {
    log "Deploying APISIX API Gateway..."
    
    # Deploy etcd for APISIX
    helm upgrade --install etcd bitnami/etcd \
        --namespace ${NAMESPACE_ENTERPRISE_CRM} \
        --set auth.rbac.create=false \
        --set persistence.size=8Gi \
        --wait --timeout=600s
    
    # Deploy APISIX
    kubectl apply -f "${KUBE_CONFIG_DIR}/apisix-gateway.yaml"
    
    # Wait for APISIX to be ready
    kubectl wait --for=condition=Available --timeout=600s deployment/apisix-gateway -n ${NAMESPACE_ENTERPRISE_CRM}
    
    log "APISIX API Gateway deployed successfully."
}

# Deploy monitoring stack
deploy_monitoring() {
    log "Deploying monitoring stack..."
    
    # Install Prometheus
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace ${NAMESPACE_MONITORING} \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
        --set prometheus.prometheusSpec.retention=30d \
        --set grafana.persistence.enabled=true \
        --set grafana.persistence.size=10Gi \
        --wait --timeout=600s
    
    # Deploy Kubecost and OpenSearch
    kubectl apply -f "${KUBE_CONFIG_DIR}/monitoring-stack.yaml"
    
    # Wait for monitoring components to be ready
    kubectl wait --for=condition=Available --timeout=600s deployment/kubecost -n ${NAMESPACE_MONITORING}
    kubectl wait --for=condition=Ready --timeout=600s statefulset/opensearch-cluster-master -n ${NAMESPACE_MONITORING}
    kubectl wait --for=condition=Available --timeout=600s deployment/opensearch-dashboards -n ${NAMESPACE_MONITORING}
    
    log "Monitoring stack deployed successfully."
}

# Deploy Jaeger for distributed tracing
deploy_jaeger() {
    log "Deploying Jaeger for distributed tracing..."
    
    # Add Jaeger Helm repository
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    # Install Jaeger
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace ${NAMESPACE_MONITORING} \
        --set provisionDataStore.cassandra=false \
        --set provisionDataStore.elasticsearch=true \
        --set storage.type=elasticsearch \
        --set storage.elasticsearch.host=opensearch.monitoring.svc.cluster.local \
        --set storage.elasticsearch.port=9200 \
        --set storage.elasticsearch.scheme=https \
        --set storage.elasticsearch.user=admin \
        --set storage.elasticsearch.password=admin \
        --wait --timeout=600s
    
    log "Jaeger deployed successfully."
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    info "Checking namespace status..."
    kubectl get namespaces
    
    info "Checking Kafka cluster..."
    kubectl get kafka -n ${NAMESPACE_DATA_PLATFORM}
    
    info "Checking Flink cluster..."
    kubectl get flinkdeployment -n ${NAMESPACE_DATA_PLATFORM}
    
    info "Checking Temporal..."
    kubectl get pods -n ${NAMESPACE_ENTERPRISE_CRM} -l app.kubernetes.io/name=temporal
    
    info "Checking Dapr..."
    kubectl get pods -n dapr-system
    
    info "Checking APISIX..."
    kubectl get pods -n ${NAMESPACE_ENTERPRISE_CRM} -l app.kubernetes.io/name=apisix
    
    info "Checking monitoring stack..."
    kubectl get pods -n ${NAMESPACE_MONITORING}
    
    info "Getting service endpoints..."
    kubectl get services -n ${NAMESPACE_ENTERPRISE_CRM}
    kubectl get services -n ${NAMESPACE_DATA_PLATFORM}
    kubectl get services -n ${NAMESPACE_MONITORING}
    
    log "Deployment verification completed."
}

# Print access information
print_access_info() {
    log "Deployment completed successfully!"
    
    echo ""
    echo "=== ACCESS INFORMATION ==="
    echo ""
    
    # Get LoadBalancer IPs
    APISIX_IP=$(kubectl get service apisix-gateway -n ${NAMESPACE_ENTERPRISE_CRM} -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
    
    echo "🌐 API Gateway (APISIX):"
    echo "   HTTP:  http://${APISIX_IP}:80"
    echo "   HTTPS: https://${APISIX_IP}:443"
    echo "   Admin: http://${APISIX_IP}:9091"
    echo ""
    
    echo "📊 Monitoring Dashboards:"
    echo "   Grafana:     kubectl port-forward -n ${NAMESPACE_MONITORING} svc/prometheus-grafana 3000:80"
    echo "   Prometheus:  kubectl port-forward -n ${NAMESPACE_MONITORING} svc/prometheus-kube-prometheus-prometheus 9090:9090"
    echo "   Kubecost:    kubectl port-forward -n ${NAMESPACE_MONITORING} svc/kubecost-cost-analyzer 9090:9090"
    echo "   OpenSearch:  kubectl port-forward -n ${NAMESPACE_MONITORING} svc/opensearch-dashboards 5601:5601"
    echo "   Jaeger:      kubectl port-forward -n ${NAMESPACE_MONITORING} svc/jaeger-query 16686:16686"
    echo ""
    
    echo "🔄 Workflow & Streaming:"
    echo "   Temporal Web: kubectl port-forward -n ${NAMESPACE_ENTERPRISE_CRM} svc/temporal-web 8080:8080"
    echo "   Flink Web:    kubectl port-forward -n ${NAMESPACE_DATA_PLATFORM} svc/enterprise-flink-cluster-rest 8081:8081"
    echo ""
    
    echo "📝 Default Credentials:"
    echo "   Grafana:     admin / prom-operator"
    echo "   OpenSearch:  admin / admin"
    echo "   PostgreSQL:  postgres / postgres123"
    echo "   Redis:       default / redis_pass"
    echo ""
    
    echo "🚀 Next Steps:"
    echo "   1. Deploy microservices using: ./deploy-services.sh"
    echo "   2. Configure security components"
    echo "   3. Set up data pipelines"
    echo "   4. Deploy frontend applications"
    echo ""
}

# Main deployment function
main() {
    log "Starting Enterprise CRM Infrastructure Deployment..."
    
    check_prerequisites
    create_namespaces
    
    # Deploy core infrastructure
    install_kafka_operator
    deploy_kafka
    install_flink_operator
    deploy_flink
    deploy_temporal
    install_dapr
    deploy_redis
    deploy_apisix
    
    # Deploy monitoring and observability
    deploy_monitoring
    deploy_jaeger
    
    # Verify and provide access information
    verify_deployment
    print_access_info
    
    log "Infrastructure deployment completed successfully!"
}

# Handle script interruption
trap 'error "Deployment interrupted by user"' INT TERM

# Run main function
main "$@"

