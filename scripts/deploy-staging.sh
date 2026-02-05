#!/bin/bash

################################################################################
# Staging Environment Deployment Script
# Deploys complete fintech app stack to staging Kubernetes cluster
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-fintech-staging}"
ENVIRONMENT="staging"
REGISTRY="${REGISTRY:-your-registry.io}"
VERSION="${VERSION:-latest}"

# Service ports
API_PORT=3000
OCR_PORT=5010
VIDEO_LIVENESS_PORT=5011
FACIAL_RECOGNITION_PORT=5009
DATABASE_PORT=5432

# Logging functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create namespace
create_namespace() {
    log_info "Creating namespace: ${NAMESPACE}"
    
    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace ${NAMESPACE} environment=staging --overwrite
    
    log_success "Namespace created"
}

# Build and push Docker images
build_images() {
    log_info "Building Docker images..."
    
    cd /home/ubuntu/fintech-mobile-app
    
    # Build API server image
    log_info "Building API server image..."
    docker build -t ${REGISTRY}/fintech-api:${VERSION} -f - . <<'EOF'
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF
    
    docker push ${REGISTRY}/fintech-api:${VERSION}
    log_success "API server image built and pushed"
    
    # Build OCR service image
    log_info "Building OCR service image..."
    cd /home/ubuntu/python-services/multi-ocr
    docker build -t ${REGISTRY}/fintech-ocr:${VERSION} -f Dockerfile .
    docker push ${REGISTRY}/fintech-ocr:${VERSION}
    log_success "OCR service image built and pushed"
    
    # Build video liveness image
    log_info "Building video liveness image..."
    cd /home/ubuntu/python-services/video-liveness
    docker build -t ${REGISTRY}/fintech-video-liveness:${VERSION} -f Dockerfile .
    docker push ${REGISTRY}/fintech-video-liveness:${VERSION}
    log_success "Video liveness image built and pushed"
    
    # Build facial recognition image
    log_info "Building facial recognition image..."
    cd /home/ubuntu/python-services/facial-recognition
    docker build -t ${REGISTRY}/fintech-facial-recognition:${VERSION} -f Dockerfile .
    docker push ${REGISTRY}/fintech-facial-recognition:${VERSION}
    log_success "Facial recognition image built and pushed"
}

# Create secrets
create_secrets() {
    log_info "Creating secrets..."
    
    # Database credentials
    DB_PASSWORD=$(openssl rand -base64 32)
    kubectl create secret generic database-creds \
        -n ${NAMESPACE} \
        --from-literal=username=fintech_user \
        --from-literal=password=${DB_PASSWORD} \
        --from-literal=database=fintech_staging \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Database URL
    kubectl create secret generic database-url \
        -n ${NAMESPACE} \
        --from-literal=url="postgresql://fintech_user:${DB_PASSWORD}@postgres:5432/fintech_staging" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # JWT secret
    JWT_SECRET=$(openssl rand -base64 64)
    kubectl create secret generic jwt-secret \
        -n ${NAMESPACE} \
        --from-literal=secret=${JWT_SECRET} \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Encryption key
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    kubectl create secret generic encryption-key \
        -n ${NAMESPACE} \
        --from-literal=key=${ENCRYPTION_KEY} \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Save credentials
    cat > /tmp/staging-credentials.txt <<EOF
Staging Environment Credentials
================================
Database User: fintech_user
Database Password: ${DB_PASSWORD}
Database Name: fintech_staging
JWT Secret: ${JWT_SECRET}
Encryption Key: ${ENCRYPTION_KEY}

IMPORTANT: Store these credentials securely and delete this file.
EOF
    
    log_success "Secrets created"
    log_warning "Credentials saved to /tmp/staging-credentials.txt"
}

# Deploy database
deploy_database() {
    log_info "Deploying PostgreSQL database..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: ${NAMESPACE}
  labels:
    app: postgres
    environment: staging
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
        environment: staging
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          ports:
            - containerPort: 5432
              name: postgres
          env:
            - name: POSTGRES_DB
              valueFrom:
                secretKeyRef:
                  name: database-creds
                  key: database
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: database-creds
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: database-creds
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          resources:
            requests:
              memory: "2Gi"
              cpu: "1"
            limits:
              memory: "4Gi"
              cpu: "2"
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
          livenessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - fintech_user
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - fintech_user
            initialDelaySeconds: 10
            periodSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: standard
        resources:
          requests:
            storage: 50Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: ${NAMESPACE}
  labels:
    app: postgres
spec:
  type: ClusterIP
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: postgres
EOF
    
    log_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n ${NAMESPACE} --timeout=300s
    
    log_success "PostgreSQL deployed"
}

# Deploy OCR service
deploy_ocr_service() {
    log_info "Deploying OCR service..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ocr-service
  namespace: ${NAMESPACE}
  labels:
    app: ocr-service
    environment: staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ocr-service
  template:
    metadata:
      labels:
        app: ocr-service
        environment: staging
    spec:
      containers:
        - name: ocr-service
          image: ${REGISTRY}/fintech-ocr:${VERSION}
          ports:
            - containerPort: 5010
              name: http
          env:
            - name: ENVIRONMENT
              value: "staging"
            - name: LOG_LEVEL
              value: "INFO"
          resources:
            requests:
              memory: "4Gi"
              cpu: "2"
              nvidia.com/gpu: "1"
            limits:
              memory: "8Gi"
              cpu: "4"
              nvidia.com/gpu: "1"
          livenessProbe:
            httpGet:
              path: /health
              port: 5010
            initialDelaySeconds: 60
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 5010
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: ocr-service
  namespace: ${NAMESPACE}
  labels:
    app: ocr-service
spec:
  type: ClusterIP
  ports:
    - port: 5010
      targetPort: 5010
  selector:
    app: ocr-service
EOF
    
    log_info "Waiting for OCR service to be ready..."
    kubectl wait --for=condition=ready pod -l app=ocr-service -n ${NAMESPACE} --timeout=300s
    
    log_success "OCR service deployed"
}

# Deploy video liveness service
deploy_video_liveness() {
    log_info "Deploying video liveness service..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-liveness
  namespace: ${NAMESPACE}
  labels:
    app: video-liveness
    environment: staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: video-liveness
  template:
    metadata:
      labels:
        app: video-liveness
        environment: staging
    spec:
      containers:
        - name: video-liveness
          image: ${REGISTRY}/fintech-video-liveness:${VERSION}
          ports:
            - containerPort: 5011
              name: http
          env:
            - name: ENVIRONMENT
              value: "staging"
            - name: LOG_LEVEL
              value: "INFO"
          resources:
            requests:
              memory: "2Gi"
              cpu: "1"
            limits:
              memory: "4Gi"
              cpu: "2"
          livenessProbe:
            httpGet:
              path: /health
              port: 5011
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 5011
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: video-liveness
  namespace: ${NAMESPACE}
  labels:
    app: video-liveness
spec:
  type: ClusterIP
  ports:
    - port: 5011
      targetPort: 5011
  selector:
    app: video-liveness
EOF
    
    log_info "Waiting for video liveness service to be ready..."
    kubectl wait --for=condition=ready pod -l app=video-liveness -n ${NAMESPACE} --timeout=300s
    
    log_success "Video liveness service deployed"
}

# Deploy facial recognition service
deploy_facial_recognition() {
    log_info "Deploying facial recognition service..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: facial-recognition
  namespace: ${NAMESPACE}
  labels:
    app: facial-recognition
    environment: staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: facial-recognition
  template:
    metadata:
      labels:
        app: facial-recognition
        environment: staging
    spec:
      containers:
        - name: facial-recognition
          image: ${REGISTRY}/fintech-facial-recognition:${VERSION}
          ports:
            - containerPort: 5009
              name: http
          env:
            - name: ENVIRONMENT
              value: "staging"
            - name: LOG_LEVEL
              value: "INFO"
          resources:
            requests:
              memory: "2Gi"
              cpu: "1"
            limits:
              memory: "4Gi"
              cpu: "2"
          livenessProbe:
            httpGet:
              path: /health
              port: 5009
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 5009
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: facial-recognition
  namespace: ${NAMESPACE}
  labels:
    app: facial-recognition
spec:
  type: ClusterIP
  ports:
    - port: 5009
      targetPort: 5009
  selector:
    app: facial-recognition
EOF
    
    log_info "Waiting for facial recognition service to be ready..."
    kubectl wait --for=condition=ready pod -l app=facial-recognition -n ${NAMESPACE} --timeout=300s
    
    log_success "Facial recognition service deployed"
}

# Deploy API server
deploy_api_server() {
    log_info "Deploying API server..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: ${NAMESPACE}
  labels:
    app: api-server
    environment: staging
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        environment: staging
    spec:
      containers:
        - name: api-server
          image: ${REGISTRY}/fintech-api:${VERSION}
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NODE_ENV
              value: "staging"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-url
                  key: url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: jwt-secret
                  key: secret
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: encryption-key
                  key: key
            - name: OCR_SERVICE_URL
              value: "http://ocr-service:5010"
            - name: VIDEO_LIVENESS_URL
              value: "http://video-liveness:5011"
            - name: FACIAL_RECOGNITION_URL
              value: "http://facial-recognition:5009"
          resources:
            requests:
              memory: "2Gi"
              cpu: "1"
            limits:
              memory: "4Gi"
              cpu: "2"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: ${NAMESPACE}
  labels:
    app: api-server
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: api-server
EOF
    
    log_info "Waiting for API server to be ready..."
    kubectl wait --for=condition=ready pod -l app=api-server -n ${NAMESPACE} --timeout=300s
    
    log_success "API server deployed"
}

# Deploy Wazuh SIEM
deploy_wazuh() {
    log_info "Deploying Wazuh SIEM to staging..."
    
    cd /home/ubuntu/python-services/wazuh/scripts
    
    DEPLOYMENT_TYPE=kubernetes \
    NAMESPACE=${NAMESPACE} \
    INDEXER_REPLICAS=1 \
    MANAGER_REPLICAS=1 \
    DASHBOARD_REPLICAS=1 \
    ./deploy-wazuh.sh
    
    log_success "Wazuh SIEM deployed"
}

# Run health checks
health_check() {
    log_info "Running health checks..."
    
    # Check all pods
    log_info "Checking pod status..."
    kubectl get pods -n ${NAMESPACE}
    
    # Check services
    log_info "Checking services..."
    kubectl get svc -n ${NAMESPACE}
    
    # Get API server URL
    API_URL=$(kubectl get svc api-server -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ -z "$API_URL" ]; then
        API_URL=$(kubectl get svc api-server -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    fi
    
    log_success "API Server URL: http://${API_URL}"
    
    # Test API health
    log_info "Testing API health..."
    if curl -f http://${API_URL}/health > /dev/null 2>&1; then
        log_success "API health check passed"
    else
        log_warning "API health check failed - service may still be starting"
    fi
}

# Print summary
print_summary() {
    log_info "========================================="
    log_info "Staging Environment Deployment Summary"
    log_info "========================================="
    log_info "Namespace: ${NAMESPACE}"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Registry: ${REGISTRY}"
    log_info "Version: ${VERSION}"
    log_info "========================================="
    log_info ""
    log_info "Services Deployed:"
    log_info "  - PostgreSQL Database (port 5432)"
    log_info "  - API Server (port 3000)"
    log_info "  - OCR Service (port 5010)"
    log_info "  - Video Liveness (port 5011)"
    log_info "  - Facial Recognition (port 5009)"
    log_info "  - Wazuh SIEM (ports 1514, 9200, 5601)"
    log_info "========================================="
    log_info ""
    log_info "Next Steps:"
    log_info "1. Access API at: http://${API_URL}"
    log_info "2. View credentials: /tmp/staging-credentials.txt"
    log_info "3. Run load tests: ./run-load-tests.sh"
    log_info "4. Run security audit: ./run-security-audit.sh"
    log_info "========================================="
}

# Main deployment flow
main() {
    log_info "Starting Staging Environment Deployment"
    
    check_prerequisites
    create_namespace
    
    if [[ "$1" != "skip-build" ]]; then
        build_images
    else
        log_warning "Skipping image build (using existing images)"
    fi
    
    create_secrets
    deploy_database
    deploy_ocr_service
    deploy_video_liveness
    deploy_facial_recognition
    deploy_api_server
    
    if [[ "$1" != "skip-wazuh" ]]; then
        deploy_wazuh
    else
        log_warning "Skipping Wazuh deployment"
    fi
    
    log_info "Waiting 30 seconds for services to stabilize..."
    sleep 30
    
    health_check
    print_summary
    
    log_success "Staging Environment Deployment Complete!"
}

# Run main function
main "$@"
