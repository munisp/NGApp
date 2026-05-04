#!/bin/bash

# Database Restore Script
# Restores MySQL and PostgreSQL databases from backup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/payment-switch/backups}"

# Database credentials
MYSQL_HOST="${MYSQL_HOST:-mysql-db}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD}"

POSTGRES_HOST="${POSTGRES_HOST:-postgres-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Database Restore Script                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to list available backups
list_backups() {
    echo -e "${BLUE}Available backups:${NC}"
    echo ""
    
    local count=1
    while IFS= read -r -d '' dir; do
        local date=$(basename "$dir")
        local mysql_backup=$(ls "$dir"/mysql-*.sql.gz 2>/dev/null | head -1)
        local postgres_backup=$(ls "$dir"/postgres-*.sql.gz 2>/dev/null | head -1)
        
        if [ -f "$mysql_backup" ] || [ -f "$postgres_backup" ]; then
            echo -e "${count}. ${GREEN}$date${NC}"
            
            if [ -f "$mysql_backup" ]; then
                local size=$(du -h "$mysql_backup" | cut -f1)
                echo "   MySQL: $(basename "$mysql_backup") ($size)"
            fi
            
            if [ -f "$postgres_backup" ]; then
                local size=$(du -h "$postgres_backup" | cut -f1)
                echo "   PostgreSQL: $(basename "$postgres_backup") ($size)"
            fi
            
            echo ""
            count=$((count + 1))
        fi
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "202*" -print0 | sort -rz)
    
    if [ $count -eq 1 ]; then
        echo -e "${YELLOW}No backups found in $BACKUP_DIR${NC}"
        exit 1
    fi
}

# Function to restore MySQL
restore_mysql() {
    local backup_file="$1"
    
    echo -e "${BLUE}Restoring MySQL database...${NC}"
    echo -e "${YELLOW}⚠ WARNING: This will overwrite the current database!${NC}"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
    
    echo ""
    echo "Decompressing backup..."
    gunzip -c "$backup_file" > /tmp/mysql-restore.sql
    
    echo "Restoring database..."
    if command -v mysql &> /dev/null; then
        mysql \
            --host="$MYSQL_HOST" \
            --port="$MYSQL_PORT" \
            --user="$MYSQL_USER" \
            --password="$MYSQL_PASSWORD" \
            < /tmp/mysql-restore.sql
    elif command -v docker &> /dev/null; then
        docker exec -i mysql-db mysql \
            --user="$MYSQL_USER" \
            --password="$MYSQL_PASSWORD" \
            < /tmp/mysql-restore.sql
    else
        echo -e "${RED}✗ MySQL restore failed: mysql client not available${NC}"
        rm /tmp/mysql-restore.sql
        return 1
    fi
    
    rm /tmp/mysql-restore.sql
    echo -e "${GREEN}✓ MySQL database restored successfully${NC}"
    echo ""
}

# Function to restore PostgreSQL
restore_postgres() {
    local backup_file="$1"
    
    echo -e "${BLUE}Restoring PostgreSQL database...${NC}"
    echo -e "${YELLOW}⚠ WARNING: This will overwrite the current database!${NC}"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
    
    echo ""
    echo "Decompressing backup..."
    gunzip -c "$backup_file" > /tmp/postgres-restore.sql
    
    echo "Restoring database..."
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    if command -v psql &> /dev/null; then
        psql \
            --host="$POSTGRES_HOST" \
            --port="$POSTGRES_PORT" \
            --username="$POSTGRES_USER" \
            --dbname="postgres" \
            < /tmp/postgres-restore.sql
    elif command -v docker &> /dev/null; then
        docker exec -i postgres-db psql \
            --username="$POSTGRES_USER" \
            --dbname="postgres" \
            < /tmp/postgres-restore.sql
    else
        echo -e "${RED}✗ PostgreSQL restore failed: psql client not available${NC}"
        rm /tmp/postgres-restore.sql
        return 1
    fi
    
    rm /tmp/postgres-restore.sql
    echo -e "${GREEN}✓ PostgreSQL database restored successfully${NC}"
    echo ""
}

# Main execution
if [ $# -eq 0 ]; then
    # Interactive mode
    list_backups
    
    read -p "Enter backup date (YYYYMMDD) to restore: " backup_date
    
    if [ ! -d "$BACKUP_DIR/$backup_date" ]; then
        echo -e "${RED}✗ Backup not found: $backup_date${NC}"
        exit 1
    fi
    
    MYSQL_BACKUP=$(ls "$BACKUP_DIR/$backup_date"/mysql-*.sql.gz 2>/dev/null | head -1)
    POSTGRES_BACKUP=$(ls "$BACKUP_DIR/$backup_date"/postgres-*.sql.gz 2>/dev/null | head -1)
else
    # Command line mode
    backup_date="$1"
    
    if [ ! -d "$BACKUP_DIR/$backup_date" ]; then
        echo -e "${RED}✗ Backup not found: $backup_date${NC}"
        exit 1
    fi
    
    MYSQL_BACKUP=$(ls "$BACKUP_DIR/$backup_date"/mysql-*.sql.gz 2>/dev/null | head -1)
    POSTGRES_BACKUP=$(ls "$BACKUP_DIR/$backup_date"/postgres-*.sql.gz 2>/dev/null | head -1)
fi

# Restore databases
if [ -f "$MYSQL_BACKUP" ]; then
    restore_mysql "$MYSQL_BACKUP"
fi

if [ -f "$POSTGRES_BACKUP" ]; then
    restore_postgres "$POSTGRES_BACKUP"
fi

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Restore Completed Successfully!                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Restored from: $BACKUP_DIR/$backup_date"
echo ""
echo -e "${YELLOW}⚠ Remember to restart your application services!${NC}"
