#!/bin/bash
# Database Migration Script (#2)
# Usage: ./scripts/migrate.sh [generate|migrate|push|status]

set -euo pipefail

ACTION="${1:-migrate}"

echo "=== 54Bank Database Migration ==="
echo "Action: $ACTION"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

case "$ACTION" in
  generate)
    echo "Generating migration from schema changes..."
    npx drizzle-kit generate
    echo "Migration files generated in drizzle/ directory"
    ;;
  migrate)
    echo "Running pending migrations..."
    npx drizzle-kit migrate
    echo "Migrations applied successfully"
    ;;
  push)
    echo "Pushing schema directly (dev only)..."
    npx drizzle-kit push
    echo "Schema pushed"
    ;;
  status)
    echo "Checking migration status..."
    npx drizzle-kit check
    ;;
  seed)
    echo "Running seed data..."
    npx tsx scripts/seed-data.ts
    echo "Seed data applied"
    ;;
  full)
    echo "Full setup: generate + migrate + seed..."
    npx drizzle-kit generate || true
    npx drizzle-kit migrate
    npx tsx scripts/seed-data.ts
    echo "Full database setup complete"
    ;;
  *)
    echo "Usage: $0 [generate|migrate|push|status|seed|full]"
    exit 1
    ;;
esac

echo "=== Done ==="
