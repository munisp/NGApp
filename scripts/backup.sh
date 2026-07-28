#!/bin/bash
set -e

# ===========================================
# Database Backup Script for OpenStack Swift
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
BACKUP_DIR="/tmp/insurance-backups"
SWIFT_CONTAINER="insurance-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Database configuration
PG_HOST="${PG_HOST:-postgresql-ha-pgpool.insurance-platform.svc.cluster.local}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-insurance_admin}"
PG_DB="${PG_DB:-insurance}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

backup_postgresql() {
    log_info "Backing up PostgreSQL database..."
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_file="$BACKUP_DIR/postgresql_${PG_DB}_${TIMESTAMP}.sql.gz"
    
    PGPASSWORD="$PG_PASSWORD" pg_dump \
        -h "$PG_HOST" \
        -p "$PG_PORT" \
        -U "$PG_USER" \
        -d "$PG_DB" \
        --format=custom \
        --compress=9 \
        -f "$backup_file"
    
    log_success "PostgreSQL backup created: $backup_file"
    echo "$backup_file"
}

backup_redis() {
    log_info "Backing up Redis..."
    
    local backup_file="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
    
    redis-cli -h "${REDIS_HOST:-redis-cluster.middleware.svc.cluster.local}" \
        -a "$REDIS_PASSWORD" \
        --rdb "$backup_file"
    
    gzip "$backup_file"
    
    log_success "Redis backup created: ${backup_file}.gz"
    echo "${backup_file}.gz"
}

upload_to_swift() {
    local file=$1
    local filename=$(basename "$file")
    
    log_info "Uploading $filename to Swift..."
    
    openstack object create "$SWIFT_CONTAINER" "$file" --name "$filename"
    
    log_success "Uploaded to Swift: $filename"
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
    
    # Swift cleanup
    local cutoff_date=$(date -d "-$RETENTION_DAYS days" +%Y%m%d)
    
    openstack object list "$SWIFT_CONTAINER" -f value -c Name | while read -r object; do
        local object_date=$(echo "$object" | grep -oP '\d{8}' | head -1)
        if [ -n "$object_date" ] && [ "$object_date" -lt "$cutoff_date" ]; then
            log_info "Deleting old backup: $object"
            openstack object delete "$SWIFT_CONTAINER" "$object"
        fi
    done
    
    log_success "Cleanup complete"
}

full_backup() {
    log_info "Starting full backup..."
    
    local pg_backup=$(backup_postgresql)
    upload_to_swift "$pg_backup"
    
    if [ -n "$REDIS_PASSWORD" ]; then
        local redis_backup=$(backup_redis)
        upload_to_swift "$redis_backup"
    fi
    
    cleanup_old_backups
    
    log_success "Full backup complete!"
}

restore_postgresql() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file required"
        exit 1
    fi
    
    log_info "Restoring PostgreSQL from $backup_file..."
    
    # Download from Swift if needed
    if [[ "$backup_file" != /* ]]; then
        local local_file="$BACKUP_DIR/$backup_file"
        openstack object save "$SWIFT_CONTAINER" "$backup_file" --file "$local_file"
        backup_file="$local_file"
    fi
    
    PGPASSWORD="$PG_PASSWORD" pg_restore \
        -h "$PG_HOST" \
        -p "$PG_PORT" \
        -U "$PG_USER" \
        -d "$PG_DB" \
        --clean \
        --if-exists \
        "$backup_file"
    
    log_success "PostgreSQL restored"
}

list_backups() {
    log_info "Available backups in Swift:"
    openstack object list "$SWIFT_CONTAINER" --long
}

usage() {
    cat << EOF
Usage: $0 COMMAND [OPTIONS]

Commands:
    backup          Create full backup
    restore         Restore from backup
    list            List available backups
    cleanup         Clean up old backups

Options:
    --pg-host       PostgreSQL host
    --pg-port       PostgreSQL port
    --pg-user       PostgreSQL user
    --pg-db         PostgreSQL database
    --retention     Retention days [default: 30]

Environment Variables:
    PG_PASSWORD     PostgreSQL password
    REDIS_PASSWORD  Redis password
    OS_*            OpenStack credentials

Examples:
    $0 backup
    $0 restore postgresql_insurance_20240101_120000.sql.gz
    $0 list
EOF
}

case $1 in
    backup)
        full_backup
        ;;
    restore)
        restore_postgresql "$2"
        ;;
    list)
        list_backups
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    *)
        usage
        exit 1
        ;;
esac
