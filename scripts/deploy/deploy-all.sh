#!/bin/bash

# Banking-CRM Integration System Deployment Script
# This script deploys the entire Banking-CRM Integration System to a Kubernetes cluster

set -e

# Configuration
NAMESPACE="banking-crm"
KUBECTL="kubectl"
HELM="helm"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section header
print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Function to print success message
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error message
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print warning message
print_warning() {
    echo -e "${YELLOW}! $1${NC}"
}

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is required but not installed. Please install $1 and try again."
        exit 1
    fi
}

# Function to check if namespace exists
check_namespace() {
    if ! $KUBECTL get namespace $NAMESPACE &> /dev/null; then
        print_warning "Namespace $NAMESPACE does not exist. Creating..."
        $KUBECTL create namespace $NAMESPACE
        print_success "Namespace $NAMESPACE created."
    else
        print_success "Namespace $NAMESPACE already exists."
    fi
}

# Function to deploy Kubernetes resources
deploy_kubernetes_resources() {
    local resource_file=$1
    local resource_name=$2
    
    print_section "Deploying $resource_name"
    
    if [ -f "$resource_file" ]; then
        $KUBECTL apply -f "$resource_file" -n $NAMESPACE
        print_success "$resource_name deployed successfully."
    else
        print_error "Resource file $resource_file not found."
        exit 1
    fi
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local deployment_name=$1
    local timeout=$2
    
    echo "Waiting for deployment $deployment_name to be ready (timeout: ${timeout}s)..."
    
    $KUBECTL rollout status deployment/$deployment_name -n $NAMESPACE --timeout=${timeout}s
    
    if [ $? -eq 0 ]; then
        print_success "Deployment $deployment_name is ready."
    else
        print_error "Deployment $deployment_name failed to become ready within ${timeout}s."
        exit 1
    fi
}

# Function to deploy Helm chart
deploy_helm_chart() {
    local chart_name=$1
    local release_name=$2
    local chart_repo=$3
    local chart_version=$4
    local values_file=$5
    
    print_section "Deploying Helm chart $chart_name"
    
    # Add repo if provided
    if [ -n "$chart_repo" ]; then
        $HELM repo add ${chart_name}-repo $chart_repo
        $HELM repo update
    fi
    
    # Check if release exists
    if $HELM list -n $NAMESPACE | grep -q $release_name; then
        print_warning "Helm release $release_name already exists. Upgrading..."
        
        if [ -n "$values_file" ] && [ -f "$values_file" ]; then
            $HELM upgrade $release_name ${chart_name}-repo/$chart_name \
                --namespace $NAMESPACE \
                --version $chart_version \
                --values $values_file
        else
            $HELM upgrade $release_name ${chart_name}-repo/$chart_name \
                --namespace $NAMESPACE \
                --version $chart_version
        fi
    else
        if [ -n "$values_file" ] && [ -f "$values_file" ]; then
            $HELM install $release_name ${chart_name}-repo/$chart_name \
                --namespace $NAMESPACE \
                --version $chart_version \
                --values $values_file
        else
            $HELM install $release_name ${chart_name}-repo/$chart_name \
                --namespace $NAMESPACE \
                --version $chart_version
        fi
    fi
    
    print_success "Helm chart $chart_name deployed successfully."
}

# Check required commands
check_command $KUBECTL
check_command $HELM

# Print banner
cat << "EOF"
 ____              _    _                  ____ ____  __  __
| __ )  __ _ _ __ | | _(_)_ __   __ _    / ___|  _ \|  \/  |
|  _ \ / _` | '_ \| |/ / | '_ \ / _` |  | |   | |_) | |\/| |
| |_) | (_| | | | |   <| | | | | (_| |  | |___|  _ <| |  | |
|____/ \__,_|_| |_|_|\_\_|_| |_|\__, |   \____|_| \_\_|  |_|
                                |___/
 ___       _                       _   _             
|_ _|_ __ | |_ ___  __ _ _ __ __ _| |_(_) ___  _ __  
 | || '_ \| __/ _ \/ _` | '__/ _` | __| |/ _ \| '_ \ 
 | || | | | ||  __/ (_| | | | (_| | |_| | (_) | | | |
|___|_| |_|\__\___|\__, |_|  \__,_|\__|_|\___/|_| |_|
                   |___/                             
EOF

echo -e "\nDeploying Banking-CRM Integration System...\n"

# Check and create namespace
check_namespace

# Deploy infrastructure components
print_section "Deploying Infrastructure Components"

# Deploy etcd
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/etcd-deployment.yaml" "etcd"

# Deploy Redis
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/redis-deployment.yaml" "Redis"

# Deploy FalkorDB
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/falkordb-deployment.yaml" "FalkorDB"

# Deploy Ollama
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/ollama-deployment.yaml" "Ollama"

# Wait for infrastructure components to be ready
wait_for_deployment "etcd" 300
wait_for_deployment "redis" 300
wait_for_deployment "falkordb" 300
wait_for_deployment "ollama" 600

# Deploy Keycloak
print_section "Deploying Keycloak"
deploy_helm_chart "keycloak" "keycloak" "https://charts.bitnami.com/bitnami" "15.1.0" "$PROJECT_ROOT/config/keycloak/keycloak-values.yaml"

# Wait for Keycloak to be ready
wait_for_deployment "keycloak" 600

# Deploy APISIX
print_section "Deploying APISIX"
deploy_helm_chart "apisix" "apisix" "https://charts.apiseven.com" "1.13.0" "$PROJECT_ROOT/config/apisix/apisix-values.yaml"

# Wait for APISIX to be ready
wait_for_deployment "apisix" 300

# Deploy Dapr
print_section "Deploying Dapr"
deploy_helm_chart "dapr" "dapr" "https://dapr.github.io/helm-charts" "1.11.0" "$PROJECT_ROOT/config/dapr/dapr-values.yaml"

# Wait for Dapr to be ready
wait_for_deployment "dapr-operator" 300
wait_for_deployment "dapr-sidecar-injector" 300

# Deploy Dapr components
print_section "Deploying Dapr Components"
$KUBECTL apply -f "$PROJECT_ROOT/config/dapr/components/" -n $NAMESPACE
print_success "Dapr components deployed successfully."

# Deploy Fluvio
print_section "Deploying Fluvio"
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/fluvio-deployment.yaml" "Fluvio"

# Wait for Fluvio to be ready
wait_for_deployment "fluvio" 300

# Deploy Temporal
print_section "Deploying Temporal"
deploy_helm_chart "temporal" "temporal" "https://helm.temporal.io" "0.19.0" "$PROJECT_ROOT/config/temporal/temporal-values.yaml"

# Wait for Temporal to be ready
wait_for_deployment "temporal-frontend" 300
wait_for_deployment "temporal-history" 300
wait_for_deployment "temporal-matching" 300
wait_for_deployment "temporal-worker" 300

# Deploy monitoring stack
print_section "Deploying Monitoring Stack"
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/monitoring-stack.yaml" "Monitoring Stack"

# Wait for monitoring components to be ready
wait_for_deployment "prometheus" 300
wait_for_deployment "grafana" 300
wait_for_deployment "alertmanager" 300
wait_for_deployment "jaeger" 300

# Deploy application services
print_section "Deploying Application Services"

# Deploy Banking Service
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/banking-service-deployment.yaml" "Banking Service"

# Deploy CRM Service
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/crm-service-deployment.yaml" "CRM Service"

# Deploy AI Service
deploy_kubernetes_resources "$PROJECT_ROOT/kubernetes/ai-service-deployment.yaml" "AI Service"

# Wait for application services to be ready
wait_for_deployment "banking-service" 300
wait_for_deployment "crm-service" 300
wait_for_deployment "ai-service" 300

# Deploy APISIX routes
print_section "Deploying APISIX Routes"
$KUBECTL apply -f "$PROJECT_ROOT/config/apisix/routes/" -n $NAMESPACE
print_success "APISIX routes deployed successfully."

# Print summary
print_section "Deployment Summary"
echo "The following components have been deployed:"
echo "- Infrastructure: etcd, Redis, FalkorDB, Ollama"
echo "- Security: Keycloak"
echo "- API Gateway: APISIX"
echo "- Service Mesh: Dapr"
echo "- Event Streaming: Fluvio"
echo "- Workflow Engine: Temporal"
echo "- Monitoring: Prometheus, Grafana, Alertmanager, Jaeger"
echo "- Application Services: Banking Service, CRM Service, AI Service"

# Print access information
print_section "Access Information"

# Get APISIX endpoint
APISIX_ENDPOINT=$($KUBECTL get svc apisix-gateway -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$APISIX_ENDPOINT" ]; then
    APISIX_ENDPOINT=$($KUBECTL get svc apisix-gateway -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
fi

if [ -z "$APISIX_ENDPOINT" ]; then
    APISIX_ENDPOINT="<pending>"
    print_warning "APISIX endpoint is not yet available. Please check the service status."
else
    print_success "APISIX API Gateway: http://$APISIX_ENDPOINT:9080"
fi

# Get Grafana endpoint
GRAFANA_ENDPOINT=$($KUBECTL get svc grafana -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$GRAFANA_ENDPOINT" ]; then
    GRAFANA_ENDPOINT=$($KUBECTL get svc grafana -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
fi

if [ -z "$GRAFANA_ENDPOINT" ]; then
    GRAFANA_ENDPOINT="<pending>"
    print_warning "Grafana endpoint is not yet available. Please check the service status."
else
    print_success "Grafana: http://$GRAFANA_ENDPOINT:3000"
    echo "  Username: admin"
    echo "  Password: admin123 (please change after first login)"
fi

# Get Jaeger endpoint
JAEGER_ENDPOINT=$($KUBECTL get svc jaeger -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$JAEGER_ENDPOINT" ]; then
    JAEGER_ENDPOINT=$($KUBECTL get svc jaeger -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
fi

if [ -z "$JAEGER_ENDPOINT" ]; then
    JAEGER_ENDPOINT="<pending>"
    print_warning "Jaeger endpoint is not yet available. Please check the service status."
else
    print_success "Jaeger: http://$JAEGER_ENDPOINT:16686"
fi

# Get Keycloak endpoint
KEYCLOAK_ENDPOINT=$($KUBECTL get svc keycloak -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$KEYCLOAK_ENDPOINT" ]; then
    KEYCLOAK_ENDPOINT=$($KUBECTL get svc keycloak -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
fi

if [ -z "$KEYCLOAK_ENDPOINT" ]; then
    KEYCLOAK_ENDPOINT="<pending>"
    print_warning "Keycloak endpoint is not yet available. Please check the service status."
else
    print_success "Keycloak: http://$KEYCLOAK_ENDPOINT:8080"
    echo "  Username: admin"
    echo "  Password: (check Kubernetes secret keycloak-admin)"
fi

print_section "Next Steps"
echo "1. Configure Keycloak realm and clients"
echo "2. Import Grafana dashboards"
echo "3. Configure alerting rules in Prometheus"
echo "4. Test the API endpoints through APISIX"
echo "5. Monitor the system using Grafana and Jaeger"

print_success "Banking-CRM Integration System deployed successfully!"

