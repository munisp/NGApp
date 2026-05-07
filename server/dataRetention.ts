/**
 * NDSEP Data Retention & Automated Purging (NDPA Section 29)
 * ===========================================================
 * Implements the "storage limitation" principle from the Nigeria Data
 * Protection Act — personal data must not be retained longer than necessary.
 *
 * Environment variables:
 *   DATA_RETENTION_AUDIT_LOGS_DAYS  — audit log retention (default: 2555 / 7 years)
 *   DATA_RETENTION_SESSION_DAYS     — session data (default: 90)
 *   DATA_RETENTION_ANALYTICS_DAYS   — analytics events (default: 730 / 2 years)
 *   DATA_RETENTION_BREACH_DAYS      — breach data (default: 2555 / 7 years)
 *   DATA_RETENTION_DSAR_DAYS        — DSAR completed requests (default: 1095 / 3 years)
 *   DATA_RETENTION_ENABLED          — "true" | "false" (default: "true")
 *   DATA_RETENTION_DRY_RUN          — "true" to log without deleting (default: "false")
 */

import { Pool } from "pg";
import { getDatabaseUrl } from "./config";
import { getPgSslConfig } from "./dbSslConfig";
import { logger } from "./logger";

const RETENTION_POLICIES = [
  {
    name: "completed_dsar_requests",
    table: "citizen_requests",
    dateColumn: "completed_at",
    condition: "status = 'completed'",
    defaultDays: 1095, // 3 years
    envKey: "DATA_RETENTION_DSAR_DAYS",
  },
  {
    name: "old_audit_logs",
    table: "audit_logs",
    dateColumn: "created_at",
    condition: null,
    defaultDays: 2555, // 7 years
    envKey: "DATA_RETENTION_AUDIT_LOGS_DAYS",
  },
  {
    name: "expired_sessions",
    table: "sessions",
    dateColumn: "expires_at",
    condition: null,
    defaultDays: 90,
    envKey: "DATA_RETENTION_SESSION_DAYS",
  },
  {
    name: "old_streaming_events",
    table: "streaming_events",
    dateColumn: "created_at",
    condition: null,
    defaultDays: 730, // 2 years
    envKey: "DATA_RETENTION_ANALYTICS_DAYS",
  },
  {
    name: "old_network_events",
    table: "network_events",
    dateColumn: "created_at",
    condition: null,
    defaultDays: 365, // 1 year
    envKey: "DATA_RETENTION_ANALYTICS_DAYS",
  },
  {
    name: "old_security_alerts",
    table: "security_alerts",
    dateColumn: "created_at",
    condition: "resolved_at IS NOT NULL",
    defaultDays: 730,
    envKey: "DATA_RETENTION_ANALYTICS_DAYS",
  },
];

export interface RetentionResult {
  policy: string;
  table: string;
  deleted: number;
  cutoffDate: string;
  dryRun: boolean;
}

export async function runRetentionPolicies(): Promise<RetentionResult[]> {
  const enabled = (process.env.DATA_RETENTION_ENABLED ?? "true") === "true";
  const dryRun = (process.env.DATA_RETENTION_DRY_RUN ?? "false") === "true";

  if (!enabled) {
    logger.info("[Retention] Data retention is disabled (DATA_RETENTION_ENABLED=false)");
    return [];
  }

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: getPgSslConfig(),
    max: 2,
  });

  const results: RetentionResult[] = [];

  try {
    for (const policy of RETENTION_POLICIES) {
      const days = parseInt(process.env[policy.envKey] ?? String(policy.defaultDays), 10);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const cutoffStr = cutoff.toISOString();

      const where = policy.condition
        ? `${policy.dateColumn} < $1 AND ${policy.condition}`
        : `${policy.dateColumn} < $1`;

      try {
        // Check if table exists
        const tableCheck = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
          [policy.table]
        );
        if (!tableCheck.rows[0].exists) continue;

        if (dryRun) {
          const countResult = await pool.query(
            `SELECT COUNT(*) FROM ${policy.table} WHERE ${where}`,
            [cutoffStr]
          );
          const count = parseInt(countResult.rows[0].count, 10);
          logger.info(
            { policy: policy.name, table: policy.table, count, cutoff: cutoffStr },
            "[Retention] DRY RUN — would delete %d rows from %s",
            count, policy.table
          );
          results.push({ policy: policy.name, table: policy.table, deleted: count, cutoffDate: cutoffStr, dryRun: true });
        } else {
          const deleteResult = await pool.query(
            `DELETE FROM ${policy.table} WHERE ${where}`,
            [cutoffStr]
          );
          const deleted = deleteResult.rowCount ?? 0;
          logger.info(
            { policy: policy.name, table: policy.table, deleted, cutoff: cutoffStr },
            "[Retention] Deleted %d rows from %s (cutoff: %s)",
            deleted, policy.table, cutoffStr
          );
          results.push({ policy: policy.name, table: policy.table, deleted, cutoffDate: cutoffStr, dryRun: false });
        }
      } catch (err) {
        logger.warn({ err, policy: policy.name }, "[Retention] Failed to apply policy %s — skipping", policy.name);
      }
    }
  } finally {
    await pool.end();
  }

  return results;
}

let retentionTimer: NodeJS.Timeout | null = null;

export function startRetentionScheduler(): void {
  const intervalMs = parseInt(process.env.DATA_RETENTION_INTERVAL_MS ?? String(24 * 60 * 60 * 1000), 10);

  retentionTimer = setInterval(async () => {
    try {
      const results = await runRetentionPolicies();
      const total = results.reduce((sum, r) => sum + r.deleted, 0);
      logger.info({ totalDeleted: total, policies: results.length }, "[Retention] Scheduled run complete");
    } catch (err) {
      logger.error({ err }, "[Retention] Scheduled run failed");
    }
  }, intervalMs);

  logger.info(
    { intervalMs, nextRun: new Date(Date.now() + intervalMs).toISOString() },
    "[Retention] Scheduler started — running every %dms",
    intervalMs
  );
}

export function stopRetentionScheduler(): void {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
}
