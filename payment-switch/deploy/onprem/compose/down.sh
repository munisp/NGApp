#!/bin/bash
# Payment Switch Platform - Docker Compose Shutdown Script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.unified.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Stop services
stop_services() {
    log_info "Stopping Payment Switch services..."
    docker compose -f "$COMPOSE_FILE" down
    log_info "Services stopped."
}

# Remove volumes (optional)
remove_volumes() {
    log_warn "This will delete all data volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Removing volumes..."
        docker compose -f "$COMPOSE_FILE" down -v
        log_info "Volumes removed."
    fi
}

# Main
main() {
    echo "=============================================="
    echo "Payment Switch Platform - Docker Compose Stop"
    echo "=============================================="
    echo ""
    
    if [ "${REMOVE_VOLUMES:-false}" == "true" ]; then
        remove_volumes
    else
        stop_services
    fi
    
    log_info "Shutdown complete."
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --volumes|-v)
            export REMOVE_VOLUMES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --volumes, -v  Also remove data volumes (destructive!)"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
