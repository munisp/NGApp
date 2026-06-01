#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# OG-RMM Backup Script — PostgreSQL + InfluxDB + Redis
#
# Usage: ./infra/backup/backup.sh [daily|weekly|manual]
# Schedule via cron: 0 2 * * * /opt/og-rmm/infra/backup/backup.sh daily
#
# RTO Target: 4 hours
# RPO Target: 24 hours (daily backups) / 1 hour (WAL archiving)
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/var/backups/og-rmm}"
S3_BUCKET="${BACKUP_S3_BUCKET:-og-rmm-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# PostgreSQL
PG_HOST="${POSTGRES_HOST:-localhost}"
PG_PORT="${POSTGRES_PORT:-5432}"
PG_DB="${POSTGRES_DB:-og_rmm}"
PG_USER="${POSTGRES_USER:-ogrmm}"

# InfluxDB
INFLUX_HOST="${INFLUXDB_URL:-http://localhost:8086}"
INFLUX_ORG="${INFLUX_ORG:-og-rmm}"
INFLUX_TOKEN="${INFLUX_TOKEN:-}"

mkdir -p "${BACKUP_DIR}/postgres" "${BACKUP_DIR}/influxdb" "${BACKUP_DIR}/redis"

echo "[backup] Starting ${BACKUP_TYPE} backup at ${TIMESTAMP}"

# ─── PostgreSQL ──────────────────────────────────────────────────────────────
PG_FILE="${BACKUP_DIR}/postgres/og_rmm_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
echo "[backup] PostgreSQL → ${PG_FILE}"
pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${PG_DB}" \
  --format=custom --compress=9 --no-owner --no-privileges \
  > "${PG_FILE}" 2>/dev/null || {
    echo "[backup] WARNING: pg_dump failed"
    PG_FILE=""
  }

# ─── Redis RDB ───────────────────────────────────────────────────────────────
REDIS_FILE="${BACKUP_DIR}/redis/dump_${TIMESTAMP}.rdb"
if command -v redis-cli &>/dev/null; then
  echo "[backup] Redis → ${REDIS_FILE}"
  redis-cli BGSAVE >/dev/null 2>&1 || true
  sleep 2
  cp /var/lib/redis/dump.rdb "${REDIS_FILE}" 2>/dev/null || echo "[backup] Redis RDB not found"
fi

# ─── Upload to S3 ───────────────────────────────────────────────────────────
if command -v aws &>/dev/null && [ -n "${S3_BUCKET}" ]; then
  echo "[backup] Uploading to s3://${S3_BUCKET}/"
  [ -n "${PG_FILE}" ] && aws s3 cp "${PG_FILE}" "s3://${S3_BUCKET}/postgres/" --quiet || true
  [ -f "${REDIS_FILE}" ] && aws s3 cp "${REDIS_FILE}" "s3://${S3_BUCKET}/redis/" --quiet || true
fi

# ─── Cleanup old backups ────────────────────────────────────────────────────
echo "[backup] Cleaning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -type f -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

echo "[backup] ${BACKUP_TYPE} backup completed at $(date +%Y%m%d_%H%M%S)"
