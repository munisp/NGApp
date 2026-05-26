#!/usr/bin/env bash
# kafka-create-topics.sh — Idempotent Kafka topic provisioning for OG-RMM Platform
#
# Usage:
#   ./scripts/kafka-create-topics.sh [KAFKA_BROKERS]
#
# Environment:
#   KAFKA_BROKERS  — comma-separated broker list (default: localhost:9092)
#
# Topics created:
#   og.field.telemetry       — raw sensor readings from edge agents (partitions=12, retention=7d)
#   og.field.alarms          — alarm events from alarm-manager (partitions=6, retention=30d)
#   og.field.commands        — actuator commands (partitions=3, retention=7d)
#   og.field.audit           — audit log events (partitions=3, retention=90d)
#   og.analytics.forecasts   — ML production forecasts (partitions=3, retention=14d)
#   og.analytics.anomalies   — anomaly detection results (partitions=3, retention=14d)
#   og.financial.ledger      — TigerBeetle transfer events (partitions=3, retention=365d)
#   og.financial.settlements — Mojaloop royalty settlements (partitions=3, retention=365d)
#   og.ota.updates           — OTA firmware update events (partitions=3, retention=30d)
#   og.osdu.metadata         — OSDU metadata sync events (partitions=3, retention=30d)
#   og.dr.events             — Demand response events (partitions=3, retention=30d)
#   og.security.events       — Cybersecurity events (partitions=3, retention=90d)
#
# All topics use:
#   replication-factor=3 (production) or 1 (single-broker dev)
#   min.insync.replicas=2 (production) or 1 (dev)
#   compression.type=lz4

set -euo pipefail

KAFKA_BROKERS="${1:-${KAFKA_BROKERS:-localhost:9092}}"
REPLICATION_FACTOR="${REPLICATION_FACTOR:-1}"
MIN_ISR="${MIN_ISR:-1}"

# Detect if we're running against a multi-broker cluster
BROKER_COUNT=$(echo "$KAFKA_BROKERS" | tr ',' '\n' | wc -l)
if [ "$BROKER_COUNT" -ge 3 ]; then
  REPLICATION_FACTOR=3
  MIN_ISR=2
  echo "Multi-broker cluster detected ($BROKER_COUNT brokers): replication-factor=3, min.insync.replicas=2"
else
  echo "Single/dual broker detected: replication-factor=$REPLICATION_FACTOR, min.insync.replicas=$MIN_ISR"
fi

# Determine kafka-topics command (Redpanda rpk or Kafka kafka-topics.sh)
if command -v rpk &>/dev/null; then
  KAFKA_CMD="rpk"
  echo "Using Redpanda rpk"
elif command -v kafka-topics.sh &>/dev/null; then
  KAFKA_CMD="kafka"
  echo "Using Apache Kafka kafka-topics.sh"
else
  echo "ERROR: Neither rpk nor kafka-topics.sh found in PATH"
  echo "Install Redpanda (rpk) or Apache Kafka tools"
  exit 1
fi

create_topic() {
  local name="$1"
  local partitions="$2"
  local retention_ms="$3"
  local extra_config="${4:-}"

  echo "Creating topic: $name (partitions=$partitions, retention=${retention_ms}ms)"

  if [ "$KAFKA_CMD" = "rpk" ]; then
    rpk topic create "$name" \
      --brokers "$KAFKA_BROKERS" \
      --partitions "$partitions" \
      --replicas "$REPLICATION_FACTOR" \
      --topic-config "retention.ms=$retention_ms" \
      --topic-config "compression.type=lz4" \
      --topic-config "min.insync.replicas=$MIN_ISR" \
      ${extra_config:+--topic-config "$extra_config"} \
      2>&1 | grep -v "TOPIC_ALREADY_EXISTS\|already exists" || true
  else
    kafka-topics.sh --bootstrap-server "$KAFKA_BROKERS" \
      --create --if-not-exists \
      --topic "$name" \
      --partitions "$partitions" \
      --replication-factor "$REPLICATION_FACTOR" \
      --config "retention.ms=$retention_ms" \
      --config "compression.type=lz4" \
      --config "min.insync.replicas=$MIN_ISR" \
      ${extra_config:+--config "$extra_config"} \
      2>&1 | grep -v "already exists" || true
  fi
}

echo ""
echo "=== OG-RMM Kafka Topic Provisioning ==="
echo "Brokers: $KAFKA_BROKERS"
echo ""

# ── Field telemetry & control ─────────────────────────────────────────────────
# 12 partitions for telemetry — high throughput, one partition per well cluster
create_topic "og.field.telemetry"     12  $((7 * 24 * 3600 * 1000))   "max.message.bytes=1048576"
create_topic "og.field.alarms"         6  $((30 * 24 * 3600 * 1000))  "max.message.bytes=65536"
create_topic "og.field.commands"       3  $((7 * 24 * 3600 * 1000))   "max.message.bytes=65536"
create_topic "og.field.audit"          3  $((90 * 24 * 3600 * 1000))  "cleanup.policy=compact,delete"

# ── Analytics ─────────────────────────────────────────────────────────────────
create_topic "og.analytics.forecasts"  3  $((14 * 24 * 3600 * 1000))  ""
create_topic "og.analytics.anomalies"  3  $((14 * 24 * 3600 * 1000))  ""

# ── Financial ─────────────────────────────────────────────────────────────────
# Long retention for financial audit trail
create_topic "og.financial.ledger"       3  $((365 * 24 * 3600 * 1000)) "cleanup.policy=compact,delete"
create_topic "og.financial.settlements"  3  $((365 * 24 * 3600 * 1000)) "cleanup.policy=compact,delete"

# ── Operations ────────────────────────────────────────────────────────────────
create_topic "og.ota.updates"     3  $((30 * 24 * 3600 * 1000))  ""
create_topic "og.osdu.metadata"   3  $((30 * 24 * 3600 * 1000))  "cleanup.policy=compact"
create_topic "og.dr.events"       3  $((30 * 24 * 3600 * 1000))  ""
create_topic "og.security.events" 3  $((90 * 24 * 3600 * 1000))  ""

echo ""
echo "=== Topic provisioning complete ==="
echo ""

# List all created topics
if [ "$KAFKA_CMD" = "rpk" ]; then
  echo "Current topics:"
  rpk topic list --brokers "$KAFKA_BROKERS" 2>/dev/null || true
else
  echo "Current topics:"
  kafka-topics.sh --bootstrap-server "$KAFKA_BROKERS" --list 2>/dev/null | grep "^og\." || true
fi
