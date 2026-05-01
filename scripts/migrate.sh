#!/usr/bin/env bash
# NDSEP Database Migration Script
# Uses golang-migrate for production-grade migrations
# Usage: ./scripts/migrate.sh [up|down|version|force VERSION]

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/migrations"
DB_URL="${DATABASE_URL:-postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db?sslmode=disable}"

# Install golang-migrate if not present
if ! command -v migrate &>/dev/null; then
  echo "Installing golang-migrate..."
  MIGRATE_VERSION="v4.17.0"
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
  curl -sL "https://github.com/golang-migrate/migrate/releases/download/${MIGRATE_VERSION}/migrate.${OS}-${ARCH}.tar.gz" | tar xz
  chmod +x migrate
  sudo mv migrate /usr/local/bin/migrate
fi

COMMAND="${1:-up}"

case "$COMMAND" in
  up)
    echo "Running all pending migrations..."
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" up
    echo "Migrations complete."
    ;;
  down)
    STEPS="${2:-1}"
    echo "Rolling back $STEPS migration(s)..."
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" down "$STEPS"
    ;;
  version)
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" version
    ;;
  force)
    VERSION="${2:?Usage: migrate.sh force VERSION}"
    echo "Forcing migration version to $VERSION..."
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" force "$VERSION"
    ;;
  drop)
    echo "WARNING: Dropping all tables..."
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" drop -f
    ;;
  *)
    echo "Usage: $0 [up|down [N]|version|force VERSION|drop]"
    exit 1
    ;;
esac
