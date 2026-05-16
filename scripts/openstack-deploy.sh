#!/bin/bash
set -e

# ===========================================
# OpenStack Infrastructure Deployment Script
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
STACK_NAME="insurance-platform"
ENVIRONMENT="production"
HEAT_DIR="$PROJECT_ROOT/heat"

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

usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

Commands:
    create          Create OpenStack infrastructure
    update          Update existing infrastructure
    delete          Delete infrastructure
    status          Show stack status
    outputs         Show stack outputs
    swift-setup     Setup Swift containers
    validate        Validate Heat templates

Options:
    -s, --stack-name    Stack name [default: insurance-platform]
    -e, --environment   Environment (development|staging|production) [default: production]
    -h, --help          Show this help message

Environment Variables:
    OS_AUTH_URL         OpenStack authentication URL
    OS_PROJECT_NAME     OpenStack project name
    OS_USERNAME         OpenStack username
    OS_PASSWORD         OpenStack password
    OS_REGION_NAME      OpenStack region

Examples:
    $0 create -e production
    $0 status
    $0 outputs
EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    command -v openstack >/dev/null 2>&1 || {
        log_error "OpenStack CLI not found. Install with: pip install python-openstackclient"
        exit 1
    }
    
    if [ -z "$OS_AUTH_URL" ]; then
        log_error "OpenStack credentials not set. Source your openrc file."
        exit 1
    fi
    
    log_success "Prerequisites met"
}

validate_templates() {
    log_info "Validating Heat templates..."
    
    for template in "$HEAT_DIR"/*.yaml; do
        log_info "Validating $(basename "$template")..."
        openstack orchestration template validate -t "$template" || {
            log_error "Template validation failed: $template"
            exit 1
        }
    done
    
    log_success "All templates valid"
}

create_stack() {
    log_info "Creating OpenStack stack: $STACK_NAME"
    
    validate_templates
    
    # Create main infrastructure stack
    openstack stack create \
        --template "$HEAT_DIR/main.yaml" \
        --parameter "environment=$ENVIRONMENT" \
        --parameter "worker_count=5" \
        --wait \
        "$STACK_NAME"
    
    log_success "Stack created successfully"
    
    # Show outputs
    outputs
}

update_stack() {
    log_info "Updating OpenStack stack: $STACK_NAME"
    
    validate_templates
    
    openstack stack update \
        --template "$HEAT_DIR/main.yaml" \
        --parameter "environment=$ENVIRONMENT" \
        --wait \
        "$STACK_NAME"
    
    log_success "Stack updated successfully"
}

delete_stack() {
    log_warning "This will delete the entire infrastructure stack: $STACK_NAME"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deleting stack..."
        
        openstack stack delete --yes --wait "$STACK_NAME"
        
        log_success "Stack deleted"
    else
        log_info "Aborted"
    fi
}

stack_status() {
    log_info "Stack Status: $STACK_NAME"
    echo ""
    
    openstack stack show "$STACK_NAME"
    echo ""
    
    log_info "Stack Resources:"
    openstack stack resource list "$STACK_NAME"
}

stack_outputs() {
    log_info "Stack Outputs: $STACK_NAME"
    echo ""
    
    openstack stack output list "$STACK_NAME"
    echo ""
    
    log_info "Detailed Outputs:"
    openstack stack output show "$STACK_NAME" --all
}

setup_swift() {
    log_info "Setting up Swift containers..."
    
    openstack stack create \
        --template "$HEAT_DIR/swift-containers.yaml" \
        --parameter "environment=$ENVIRONMENT" \
        --wait \
        "${STACK_NAME}-swift"
    
    log_success "Swift containers created"
    
    # List containers
    log_info "Swift Containers:"
    openstack container list
}

setup_autoscaling() {
    log_info "Setting up auto-scaling..."
    
    # Get network and security group from main stack
    NETWORK_ID=$(openstack stack output show "$STACK_NAME" network_id -f value -c output_value)
    
    openstack stack create \
        --template "$HEAT_DIR/autoscaling.yaml" \
        --parameter "network=$NETWORK_ID" \
        --parameter "min_workers=3" \
        --parameter "max_workers=20" \
        --wait \
        "${STACK_NAME}-autoscaling"
    
    log_success "Auto-scaling configured"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        create|update|delete|status|outputs|swift-setup|validate|autoscaling)
            COMMAND="$1"
            shift
            break
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

check_prerequisites

case $COMMAND in
    create)
        create_stack
        ;;
    update)
        update_stack
        ;;
    delete)
        delete_stack
        ;;
    status)
        stack_status
        ;;
    outputs)
        stack_outputs
        ;;
    swift-setup)
        setup_swift
        ;;
    validate)
        validate_templates
        ;;
    autoscaling)
        setup_autoscaling
        ;;
    *)
        usage
        exit 1
        ;;
esac
