#!/bin/bash

###############################################################################
# Production Deployment Script for Crypto Remittance System
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="crypto-remittance"
DEPLOY_ENV="${DEPLOY_ENV:-production}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f ".env.${DEPLOY_ENV}" ]; then
        log_error "Environment file .env.${DEPLOY_ENV} not found"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

backup_database() {
    log_info "Creating database backup..."
    
    BACKUP_DIR="./backups"
    BACKUP_FILE="${BACKUP_DIR}/db_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p "$BACKUP_DIR"
    
    docker-compose exec -T db mysqldump \
        -u"${DB_USER}" \
        -p"${DB_PASSWORD}" \
        "${DB_NAME}" > "$BACKUP_FILE"
    
    log_info "Database backed up to: $BACKUP_FILE"
}

build_images() {
    log_info "Building Docker images..."
    
    if [ -n "$DOCKER_REGISTRY" ]; then
        IMAGE_NAME="${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}"
    else
        IMAGE_NAME="${APP_NAME}:${IMAGE_TAG}"
    fi
    
    docker build -t "$IMAGE_NAME" .
    
    log_info "Image built: $IMAGE_NAME"
}

push_images() {
    if [ -n "$DOCKER_REGISTRY" ]; then
        log_info "Pushing images to registry..."
        
        IMAGE_NAME="${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}"
        docker push "$IMAGE_NAME"
        
        log_info "Image pushed: $IMAGE_NAME"
    else
        log_warn "No registry configured, skipping push"
    fi
}

run_migrations() {
    log_info "Running database migrations..."
    
    docker-compose exec -T app pnpm db:push
    
    log_info "Migrations completed"
}

deploy_application() {
    log_info "Deploying application..."
    
    # Load environment variables
    export $(cat ".env.${DEPLOY_ENV}" | xargs)
    
    # Pull latest images (if using registry)
    if [ -n "$DOCKER_REGISTRY" ]; then
        docker-compose pull
    fi
    
    # Start services
    docker-compose up -d
    
    log_info "Application deployed"
}

health_check() {
    log_info "Performing health check..."
    
    MAX_RETRIES=30
    RETRY_INTERVAL=2
    
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -f http://localhost:3000/health &> /dev/null; then
            log_info "Health check passed"
            return 0
        fi
        
        log_warn "Health check attempt $i/$MAX_RETRIES failed, retrying..."
        sleep $RETRY_INTERVAL
    done
    
    log_error "Health check failed after $MAX_RETRIES attempts"
    return 1
}

rollback() {
    log_error "Deployment failed, rolling back..."
    
    # Stop current containers
    docker-compose down
    
    # Restore from backup (if available)
    LATEST_BACKUP=$(ls -t ./backups/db_backup_*.sql 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        log_info "Restoring database from: $LATEST_BACKUP"
        docker-compose exec -T db mysql \
            -u"${DB_USER}" \
            -p"${DB_PASSWORD}" \
            "${DB_NAME}" < "$LATEST_BACKUP"
    fi
    
    # Start previous version
    docker-compose up -d
    
    log_error "Rollback completed"
    exit 1
}

cleanup() {
    log_info "Cleaning up old images..."
    
    docker image prune -f
    
    # Keep only last 5 backups
    ls -t ./backups/db_backup_*.sql 2>/dev/null | tail -n +6 | xargs -r rm
    
    log_info "Cleanup completed"
}

show_status() {
    log_info "Deployment Status:"
    echo ""
    docker-compose ps
    echo ""
    log_info "Logs (last 20 lines):"
    docker-compose logs --tail=20
}

# Main deployment flow
main() {
    log_info "Starting deployment for environment: $DEPLOY_ENV"
    
    check_prerequisites
    
    # Backup before deployment
    if [ "$DEPLOY_ENV" = "production" ]; then
        backup_database
    fi
    
    # Build and push images
    build_images
    push_images
    
    # Deploy
    deploy_application
    
    # Run migrations
    run_migrations
    
    # Health check
    if ! health_check; then
        rollback
    fi
    
    # Cleanup
    cleanup
    
    # Show status
    show_status
    
    log_info "Deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    backup)
        backup_database
        ;;
    rollback)
        rollback
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {deploy|backup|rollback|status}"
        exit 1
        ;;
esac
