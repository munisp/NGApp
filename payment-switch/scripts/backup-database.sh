#!/bin/bash

# Automated Database Backup Script
# Backs up MySQL and PostgreSQL databases with compression and retention

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/payment-switch/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DATE_DIR=$(date +%Y%m%d)

# Database credentials (from environment or .env file)
MYSQL_HOST="${MYSQL_HOST:-mysql-db}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD}"
MYSQL_DATABASE="${MYSQL_DATABASE:-payment_switch}"

POSTGRES_HOST="${POSTGRES_HOST:-postgres-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DATABASE="${POSTGRES_DATABASE:-payment_switch}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Database Backup Script                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Backup started at: $(date)"
echo "Backup directory: $BACKUP_DIR/$DATE_DIR"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE_DIR"

# Function to backup MySQL
backup_mysql() {
    echo -e "${BLUE}[1/2] Backing up MySQL database...${NC}"
    
    local backup_file="$BACKUP_DIR/$DATE_DIR/mysql-$TIMESTAMP.sql"
    local compressed_file="$backup_file.gz"
    
    if command -v mysqldump &> /dev/null; then
        # Direct mysqldump
        mysqldump \
            --host="$MYSQL_HOST" \
            --port="$MYSQL_PORT" \
            --user="$MYSQL_USER" \
            --password="$MYSQL_PASSWORD" \
            --single-transaction \
            --quick \
            --lock-tables=false \
            --routines \
            --triggers \
            --events \
            --databases "$MYSQL_DATABASE" \
            > "$backup_file"
    elif command -v docker &> /dev/null; then
        # Docker container backup
        docker exec mysql-db mysqldump \
            --user="$MYSQL_USER" \
            --password="$MYSQL_PASSWORD" \
            --single-transaction \
            --quick \
            --lock-tables=false \
            --routines \
            --triggers \
            --events \
            --databases "$MYSQL_DATABASE" \
            > "$backup_file"
    else
        echo -e "${RED}✗ MySQL backup failed: mysqldump not available${NC}"
        return 1
    fi
    
    # Compress backup
    gzip "$backup_file"
    
    local size=$(du -h "$compressed_file" | cut -f1)
    echo -e "${GREEN}✓ MySQL backup completed: $compressed_file ($size)${NC}"
    echo ""
}

# Function to backup PostgreSQL
backup_postgres() {
    echo -e "${BLUE}[2/2] Backing up PostgreSQL database...${NC}"
    
    local backup_file="$BACKUP_DIR/$DATE_DIR/postgres-$TIMESTAMP.sql"
    local compressed_file="$backup_file.gz"
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    if command -v pg_dump &> /dev/null; then
        # Direct pg_dump
        pg_dump \
            --host="$POSTGRES_HOST" \
            --port="$POSTGRES_PORT" \
            --username="$POSTGRES_USER" \
            --dbname="$POSTGRES_DATABASE" \
            --format=plain \
            --no-owner \
            --no-acl \
            > "$backup_file"
    elif command -v docker &> /dev/null; then
        # Docker container backup
        docker exec postgres-db pg_dump \
            --username="$POSTGRES_USER" \
            --dbname="$POSTGRES_DATABASE" \
            --format=plain \
            --no-owner \
            --no-acl \
            > "$backup_file"
    else
        echo -e "${RED}✗ PostgreSQL backup failed: pg_dump not available${NC}"
        return 1
    fi
    
    # Compress backup
    gzip "$backup_file"
    
    local size=$(du -h "$compressed_file" | cut -f1)
    echo -e "${GREEN}✓ PostgreSQL backup completed: $compressed_file ($size)${NC}"
    echo ""
}

# Function to upload to S3
upload_to_s3() {
    if [ -z "$S3_BUCKET" ]; then
        echo -e "${YELLOW}⚠ S3_BUCKET not set, skipping S3 upload${NC}"
        return 0
    fi
    
    echo -e "${BLUE}Uploading backups to S3...${NC}"
    
    if command -v aws &> /dev/null; then
        aws s3 sync "$BACKUP_DIR/$DATE_DIR" "s3://$S3_BUCKET/backups/$DATE_DIR/" \
            --storage-class STANDARD_IA \
            --quiet
        
        echo -e "${GREEN}✓ Backups uploaded to S3: s3://$S3_BUCKET/backups/$DATE_DIR/${NC}"
    else
        echo -e "${YELLOW}⚠ AWS CLI not installed, skipping S3 upload${NC}"
    fi
    echo ""
}

# Function to clean old backups
cleanup_old_backups() {
    echo -e "${BLUE}Cleaning up backups older than $RETENTION_DAYS days...${NC}"
    
    local deleted_count=0
    
    # Find and delete old backup directories
    while IFS= read -r -d '' dir; do
        rm -rf "$dir"
        deleted_count=$((deleted_count + 1))
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -print0)
    
    if [ $deleted_count -gt 0 ]; then
        echo -e "${GREEN}✓ Deleted $deleted_count old backup directories${NC}"
    else
        echo -e "${GREEN}✓ No old backups to delete${NC}"
    fi
    
    # Clean up S3 old backups
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
        
        aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
            local dir_date=$(echo "$line" | awk '{print $2}' | tr -d '/')
            if [ "$dir_date" -lt "$cutoff_date" ]; then
                aws s3 rm "s3://$S3_BUCKET/backups/$dir_date/" --recursive --quiet
                echo "Deleted S3 backup: $dir_date"
            fi
        done
    fi
    echo ""
}

# Function to verify backup
verify_backup() {
    echo -e "${BLUE}Verifying backups...${NC}"
    
    local mysql_backup=$(ls -t "$BACKUP_DIR/$DATE_DIR"/mysql-*.sql.gz 2>/dev/null | head -1)
    local postgres_backup=$(ls -t "$BACKUP_DIR/$DATE_DIR"/postgres-*.sql.gz 2>/dev/null | head -1)
    
    local verified=true
    
    # Verify MySQL backup
    if [ -f "$mysql_backup" ]; then
        if gunzip -t "$mysql_backup" 2>/dev/null; then
            echo -e "${GREEN}✓ MySQL backup verified${NC}"
        else
            echo -e "${RED}✗ MySQL backup corrupted${NC}"
            verified=false
        fi
    fi
    
    # Verify PostgreSQL backup
    if [ -f "$postgres_backup" ]; then
        if gunzip -t "$postgres_backup" 2>/dev/null; then
            echo -e "${GREEN}✓ PostgreSQL backup verified${NC}"
        else
            echo -e "${RED}✗ PostgreSQL backup corrupted${NC}"
            verified=false
        fi
    fi
    
    echo ""
    
    if [ "$verified" = true ]; then
        return 0
    else
        return 1
    fi
}

# Function to send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        local emoji=":white_check_mark:"
        
        if [ "$status" = "failure" ]; then
            color="danger"
            emoji=":x:"
        fi
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Database Backup $status\",
                    \"text\": \"$message\",
                    \"footer\": \"Payment Switch Backup System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            --silent --output /dev/null
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    # Run backups
    if backup_mysql && backup_postgres; then
        # Upload to S3
        upload_to_s3
        
        # Verify backups
        if verify_backup; then
            # Cleanup old backups
            cleanup_old_backups
            
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║  Backup Completed Successfully!                        ║${NC}"
            echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
            echo ""
            echo "Duration: ${duration}s"
            echo "Location: $BACKUP_DIR/$DATE_DIR"
            
            if [ -n "$S3_BUCKET" ]; then
                echo "S3 Location: s3://$S3_BUCKET/backups/$DATE_DIR/"
            fi
            
            send_notification "success" "Database backup completed successfully in ${duration}s"
            
            exit 0
        else
            echo -e "${RED}✗ Backup verification failed${NC}"
            send_notification "failure" "Backup verification failed"
            exit 1
        fi
    else
        echo -e "${RED}✗ Backup failed${NC}"
        send_notification "failure" "Database backup failed"
        exit 1
    fi
}

# Run main function
main
