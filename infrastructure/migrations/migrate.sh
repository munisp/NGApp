#!/bin/bash
# Database migration runner for NGApp platform
# Usage: ./migrate.sh [up|down|status] [service]

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-ngapp}"
DB_PASSWORD="${DB_PASSWORD:-ngapp_dev_2026}"
DB_NAME="${DB_NAME:-ngapp}"

CONNSTR="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

ACTION="${1:-status}"
SERVICE="${2:-all}"

echo "=== NGApp Database Migration ==="
echo "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Action: ${ACTION}"
echo "Service: ${SERVICE}"
echo ""

# Create extensions
psql "$CONNSTR" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true
psql "$CONNSTR" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>/dev/null || true

if [ "$ACTION" = "up" ]; then
    echo "Running GORM AutoMigrate via service startup..."
    echo "Each service auto-migrates its tables on startup."
    echo "For manual migrations, use the SQL files in each service's migrations/ directory."
elif [ "$ACTION" = "seed" ]; then
    echo "Seeding database with initial data..."
    psql "$CONNSTR" < "$(dirname $0)/seed.sql"
elif [ "$ACTION" = "status" ]; then
    echo "Checking database tables..."
    psql "$CONNSTR" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
fi

echo ""
echo "=== Migration complete ==="
