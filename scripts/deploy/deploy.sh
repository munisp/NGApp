#!/bin/bash

# Enterprise CRM Production Deployment Script
# This script automates the deployment of the Enterprise CRM system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${DEPLOYMENT_ENV:-production}
NAMESPACE=${NAMESPACE:-enterprise-crm-prod}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-enterprise-crm}
VERSION=${VERSION:-latest}
BACKUP_ENABLED=${BACKUP_ENABLED:-true}
MONITORING_ENABLED=${MONITORING_ENABLED:-true}
SECURITY_ENABLED=${SECURITY_ENABLED:-true}

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KUBE_DIR="$PROJECT_ROOT/infrastructure/kubernetes"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
SECURITY_DIR="$PROJECT_ROOT/security"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed. Please install helm first."
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed. Please install docker first."
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    # Check if required environment variables are set
    if [[ -z "$POSTGRES_PASSWORD" ]]; then
        log_error "POSTGRES_PASSWORD environment variable is not set."
        exit 1
    fi
    
    if [[ -z "$JWT_SECRET" ]]; then
        log_error "JWT_SECRET environment variable is not set."
        exit 1
    fi
    
    if [[ -z "$NOVU_API_KEY" ]]; then
        log_error "NOVU_API_KEY environment variable is not set."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_namespace() {
    log_info "Creating namespace: $NAMESPACE"
    
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace $NAMESPACE environment=$DEPLOYMENT_ENV --overwrite
    kubectl label namespace $NAMESPACE project=enterprise-crm --overwrite
    
    log_success "Namespace $NAMESPACE created/updated"
}

create_secrets() {
    log_info "Creating secrets..."
    
    # PostgreSQL secret
    kubectl create secret generic postgresql-secret \
        --from-literal=username=postgres \
        --from-literal=password="$POSTGRES_PASSWORD" \
        --from-literal=database=enterprise_crm_prod \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Redis secret
    kubectl create secret generic redis-secret \
        --from-literal=password="$(openssl rand -base64 32)" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # JWT secret
    kubectl create secret generic jwt-secret \
        --from-literal=secret="$JWT_SECRET" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Novu secret
    kubectl create secret generic novu-secret \
        --from-literal=api-key="$NOVU_API_KEY" \
        --from-literal=app-id="$NOVU_APP_ID" \
        --from-literal=webhook-secret="$NOVU_WEBHOOK_SECRET" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # KeyCloak secret
    kubectl create secret generic keycloak-secret \
        --from-literal=admin-password="$(openssl rand -base64 32)" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Secrets created"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure components..."
    
    # Deploy storage classes
    kubectl apply -f "$KUBE_DIR/storage-classes.yaml"
    
    # Deploy persistent volumes
    kubectl apply -f "$KUBE_DIR/persistent-volumes.yaml"
    
    # Deploy Kafka cluster
    kubectl apply -f "$KUBE_DIR/kafka-cluster.yaml"
    
    # Deploy Temporal cluster
    kubectl apply -f "$KUBE_DIR/temporal-cluster.yaml"
    
    # Deploy APISIX gateway
    kubectl apply -f "$KUBE_DIR/apisix-gateway.yaml"
    
    log_success "Infrastructure components deployed"
}

build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Build customer service
    log_info "Building customer service..."
    cd "$PROJECT_ROOT/services/go/customer-service"
    docker build -t "$DOCKER_REGISTRY/customer-service:$VERSION" .
    docker push "$DOCKER_REGISTRY/customer-service:$VERSION"
    
    # Build CRM core service
    log_info "Building CRM core service..."
    cd "$PROJECT_ROOT/services/go/crm-core-service"
    docker build -t "$DOCKER_REGISTRY/crm-core-service:$VERSION" .
    docker push "$DOCKER_REGISTRY/crm-core-service:$VERSION"
    
    # Build inventory service
    log_info "Building inventory service..."
    cd "$PROJECT_ROOT/services/go/inventory-service"
    docker build -t "$DOCKER_REGISTRY/inventory-service:$VERSION" .
    docker push "$DOCKER_REGISTRY/inventory-service:$VERSION"
    
    # Build analytics service
    log_info "Building analytics service..."
    cd "$PROJECT_ROOT/services/go/analytics-service"
    docker build -t "$DOCKER_REGISTRY/analytics-service:$VERSION" .
    docker push "$DOCKER_REGISTRY/analytics-service:$VERSION"
    
    # Build Novu integration service
    log_info "Building Novu integration service..."
    cd "$PROJECT_ROOT/novu-integration"
    docker build -t "$DOCKER_REGISTRY/novu-integration:$VERSION" .
    docker push "$DOCKER_REGISTRY/novu-integration:$VERSION"
    
    # Build frontend
    log_info "Building frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm run build
    docker build -t "$DOCKER_REGISTRY/frontend:$VERSION" .
    docker push "$DOCKER_REGISTRY/frontend:$VERSION"
    
    cd "$SCRIPT_DIR"
    log_success "All images built and pushed"
}

deploy_database() {
    log_info "Deploying PostgreSQL database..."
    
    # Deploy PostgreSQL using Helm
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo update
    
    helm upgrade --install postgresql bitnami/postgresql \
        --namespace=$NAMESPACE \
        --set auth.postgresPassword="$POSTGRES_PASSWORD" \
        --set auth.database=enterprise_crm_prod \
        --set primary.persistence.enabled=true \
        --set primary.persistence.size=100Gi \
        --set primary.persistence.storageClass=fast-ssd \
        --set primary.resources.requests.memory=2Gi \
        --set primary.resources.requests.cpu=1000m \
        --set primary.resources.limits.memory=4Gi \
        --set primary.resources.limits.cpu=2000m \
        --set metrics.enabled=true \
        --set metrics.serviceMonitor.enabled=true \
        --wait --timeout=600s
    
    log_success "PostgreSQL deployed"
}

deploy_redis() {
    log_info "Deploying Redis..."
    
    helm upgrade --install redis bitnami/redis \
        --namespace=$NAMESPACE \
        --set auth.enabled=true \
        --set auth.password="$(kubectl get secret redis-secret -n $NAMESPACE -o jsonpath='{.data.password}' | base64 -d)" \
        --set master.persistence.enabled=true \
        --set master.persistence.size=10Gi \
        --set master.persistence.storageClass=fast-ssd \
        --set replica.replicaCount=2 \
        --set replica.persistence.enabled=true \
        --set replica.persistence.size=10Gi \
        --set replica.persistence.storageClass=fast-ssd \
        --set metrics.enabled=true \
        --set metrics.serviceMonitor.enabled=true \
        --wait --timeout=300s
    
    log_success "Redis deployed"
}

deploy_services() {
    log_info "Deploying application services..."
    
    # Update image tags in deployment files
    find "$PROJECT_ROOT/services" -name "kubernetes.yaml" -exec sed -i "s|image: .*|image: $DOCKER_REGISTRY/\$(basename \$(dirname \$(dirname \$(pwd)))):$VERSION|g" {} \;
    
    # Deploy customer service
    kubectl apply -f "$PROJECT_ROOT/services/go/customer-service/deployments/kubernetes.yaml"
    
    # Deploy CRM core service
    kubectl apply -f "$PROJECT_ROOT/services/go/crm-core-service/deployments/kubernetes.yaml"
    
    # Deploy inventory service
    kubectl apply -f "$PROJECT_ROOT/services/go/inventory-service/deployments/kubernetes.yaml"
    
    # Deploy analytics service
    kubectl apply -f "$PROJECT_ROOT/services/go/analytics-service/deployments/kubernetes.yaml"
    
    # Deploy Novu integration service
    kubectl apply -f "$PROJECT_ROOT/novu-integration/kubernetes/deployment.yaml"
    
    log_success "Application services deployed"
}

deploy_frontend() {
    log_info "Deploying frontend..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: $NAMESPACE
  labels:
    app: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: $DOCKER_REGISTRY/frontend:$VERSION
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        env:
        - name: REACT_APP_API_URL
          value: "https://api.enterprise-crm.com"
        - name: REACT_APP_NOVU_APP_ID
          valueFrom:
            secretKeyRef:
              name: novu-secret
              key: app-id
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: $NAMESPACE
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
EOF
    
    log_success "Frontend deployed"
}

deploy_ingress() {
    log_info "Deploying ingress..."
    
    # Install NGINX Ingress Controller
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.replicaCount=3 \
        --set controller.nodeSelector."kubernetes\.io/os"=linux \
        --set defaultBackend.nodeSelector."kubernetes\.io/os"=linux \
        --set controller.service.type=LoadBalancer \
        --wait --timeout=300s
    
    # Deploy ingress rules
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: enterprise-crm-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  rules:
  - host: app.enterprise-crm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: api.enterprise-crm.com
    http:
      paths:
      - path: /customers
        pathType: Prefix
        backend:
          service:
            name: customer-service
            port:
              number: 80
      - path: /crm
        pathType: Prefix
        backend:
          service:
            name: crm-core-service
            port:
              number: 80
      - path: /inventory
        pathType: Prefix
        backend:
          service:
            name: inventory-service
            port:
              number: 80
      - path: /analytics
        pathType: Prefix
        backend:
          service:
            name: analytics-service
            port:
              number: 80
  - host: notifications.enterprise-crm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: novu-integration-service
            port:
              number: 80
EOF
    
    log_success "Ingress deployed"
}

deploy_monitoring() {
    if [[ "$MONITORING_ENABLED" == "true" ]]; then
        log_info "Deploying monitoring stack..."
        
        # Create monitoring namespace
        kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
        
        # Deploy Prometheus stack
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --set prometheus.prometheusSpec.retention=30d \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=fast-ssd \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi \
            --set grafana.adminPassword="$(openssl rand -base64 32)" \
            --set grafana.persistence.enabled=true \
            --set grafana.persistence.storageClassName=fast-ssd \
            --set grafana.persistence.size=10Gi \
            --wait --timeout=600s
        
        # Deploy custom dashboards
        kubectl apply -f "$MONITORING_DIR/grafana/dashboards.yaml"
        
        log_success "Monitoring stack deployed"
    else
        log_warning "Monitoring deployment skipped"
    fi
}

deploy_security() {
    if [[ "$SECURITY_ENABLED" == "true" ]]; then
        log_info "Deploying security stack..."
        
        # Create security namespace
        kubectl create namespace security --dry-run=client -o yaml | kubectl apply -f -
        
        # Deploy KeyCloak
        kubectl apply -f "$SECURITY_DIR/keycloak/keycloak-deployment.yaml"
        
        # Deploy Permify
        kubectl apply -f "$SECURITY_DIR/permify/permify-deployment.yaml"
        
        # Deploy security monitoring
        kubectl apply -f "$SECURITY_DIR/wazuh/wazuh-deployment.yaml"
        kubectl apply -f "$SECURITY_DIR/openappsec/openappsec-deployment.yaml"
        kubectl apply -f "$SECURITY_DIR/opencti/opencti-deployment.yaml"
        
        log_success "Security stack deployed"
    else
        log_warning "Security deployment skipped"
    fi
}

wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    # Wait for database
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgresql -n $NAMESPACE --timeout=600s
    
    # Wait for Redis
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis -n $NAMESPACE --timeout=300s
    
    # Wait for services
    kubectl wait --for=condition=available deployment -l app=customer-service -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment -l app=crm-core-service -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment -l app=inventory-service -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment -l app=analytics-service -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment -l app=novu-integration-service -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment -l app=frontend -n $NAMESPACE --timeout=300s
    
    log_success "All deployments are ready"
}

run_database_migrations() {
    log_info "Running database migrations..."
    
    # Get PostgreSQL pod name
    POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}')
    
    # Run migrations
    kubectl exec -it $POSTGRES_POD -n $NAMESPACE -- psql -U postgres -d enterprise_crm_prod -c "
        CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
        CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";
        CREATE EXTENSION IF NOT EXISTS \"btree_gin\";
    "
    
    log_success "Database migrations completed"
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Get ingress IP
    INGRESS_IP=$(kubectl get service ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    if [[ -z "$INGRESS_IP" ]]; then
        INGRESS_IP=$(kubectl get service ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    fi
    
    log_info "Ingress IP/Hostname: $INGRESS_IP"
    
    # Health check function
    check_endpoint() {
        local url=$1
        local name=$2
        
        if curl -f -s "$url" > /dev/null; then
            log_success "$name health check passed"
        else
            log_error "$name health check failed"
            return 1
        fi
    }
    
    # Wait a bit for services to be fully ready
    sleep 30
    
    # Check services (using port-forward for now)
    kubectl port-forward -n $NAMESPACE svc/customer-service 8081:80 &
    PF_PID1=$!
    sleep 5
    check_endpoint "http://localhost:8081/health" "Customer Service"
    kill $PF_PID1
    
    kubectl port-forward -n $NAMESPACE svc/frontend 8080:80 &
    PF_PID2=$!
    sleep 5
    check_endpoint "http://localhost:8080/" "Frontend"
    kill $PF_PID2
    
    log_success "Health checks completed"
}

create_backup_job() {
    if [[ "$BACKUP_ENABLED" == "true" ]]; then
        log_info "Creating backup job..."
        
        cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: $NAMESPACE
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15-alpine
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgresql -U postgres enterprise_crm_prod | gzip > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql.gz
              echo "Backup completed: backup-\$(date +%Y%m%d-%H%M%S).sql.gz"
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgresql-secret
                  key: password
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
EOF
        
        log_success "Backup job created"
    else
        log_warning "Backup job creation skipped"
    fi
}

print_deployment_info() {
    log_info "Deployment completed successfully!"
    echo
    echo "=== Deployment Information ==="
    echo "Environment: $DEPLOYMENT_ENV"
    echo "Namespace: $NAMESPACE"
    echo "Version: $VERSION"
    echo
    echo "=== Access Information ==="
    
    # Get ingress IP
    INGRESS_IP=$(kubectl get service ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [[ -z "$INGRESS_IP" ]]; then
        INGRESS_IP=$(kubectl get service ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    fi
    
    echo "Ingress IP/Hostname: $INGRESS_IP"
    echo
    echo "Frontend: https://app.enterprise-crm.com"
    echo "API: https://api.enterprise-crm.com"
    echo "Notifications: https://notifications.enterprise-crm.com"
    echo
    
    if [[ "$MONITORING_ENABLED" == "true" ]]; then
        GRAFANA_PASSWORD=$(kubectl get secret prometheus-grafana -n monitoring -o jsonpath='{.data.admin-password}' | base64 -d)
        echo "Grafana: http://monitoring.enterprise-crm.com (admin/$GRAFANA_PASSWORD)"
    fi
    
    echo
    echo "=== Next Steps ==="
    echo "1. Update your DNS records to point to the ingress IP"
    echo "2. Configure SSL certificates"
    echo "3. Run initial data setup"
    echo "4. Configure monitoring alerts"
    echo "5. Set up backup verification"
    echo
    log_success "Enterprise CRM deployment completed!"
}

# Main deployment flow
main() {
    log_info "Starting Enterprise CRM deployment..."
    
    check_prerequisites
    create_namespace
    create_secrets
    deploy_infrastructure
    build_and_push_images
    deploy_database
    deploy_redis
    deploy_services
    deploy_frontend
    deploy_ingress
    deploy_monitoring
    deploy_security
    wait_for_deployments
    run_database_migrations
    create_backup_job
    run_health_checks
    print_deployment_info
}

# Handle script arguments
case "${1:-}" in
    "check")
        check_prerequisites
        ;;
    "build")
        build_and_push_images
        ;;
    "deploy")
        main
        ;;
    "health")
        run_health_checks
        ;;
    "clean")
        log_warning "Cleaning up deployment..."
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
        log_success "Cleanup completed"
        ;;
    *)
        echo "Usage: $0 {check|build|deploy|health|clean}"
        echo
        echo "Commands:"
        echo "  check  - Check prerequisites"
        echo "  build  - Build and push Docker images"
        echo "  deploy - Full deployment"
        echo "  health - Run health checks"
        echo "  clean  - Clean up deployment"
        exit 1
        ;;
esac

