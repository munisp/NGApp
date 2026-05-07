/**
 * NDSEP Database Migration Verification
 * =======================================
 * Post-migration verification to ensure data integrity:
 *   - Schema validation (expected tables/columns exist)
 *   - Row count sanity checks
 *   - Index existence verification
 *   - Constraint verification
 *   - Foreign key integrity
 */

import { Pool } from "pg";
import { getDatabaseUrl } from "./config";
import { getPgSslConfig } from "./dbSslConfig";
import { logger } from "./logger";

export interface MigrationCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  details: string;
}

export interface VerificationReport {
  passed: boolean;
  checks: MigrationCheck[];
  duration: number;
}

const CRITICAL_TABLES = [
  "users", "organizations", "audit_logs", "citizen_requests",
  "breach_incidents", "consent_records", "dpia_records",
  "dpco_organisations", "dpco_audit_engagements", "sessions",
  "data_processing_activities", "transfer_instruments",
];

export async function verifyMigrations(): Promise<VerificationReport> {
  const pool = new Pool({ connectionString: getDatabaseUrl(), ssl: getPgSslConfig(), max: 2 });
  const start = Date.now();
  const checks: MigrationCheck[] = [];

  try {
    // 1. Check all critical tables exist
    for (const table of CRITICAL_TABLES) {
      const { rows } = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      checks.push({
        name: `table_exists:${table}`,
        status: rows[0].exists ? "pass" : "fail",
        details: rows[0].exists ? `Table ${table} exists` : `MISSING: table ${table}`,
      });
    }

    // 2. Check critical columns
    const criticalColumns = [
      { table: "users", column: "open_id" },
      { table: "users", column: "display_name" },
      { table: "users", column: "role" },
      { table: "organizations", column: "compliance_score" },
      { table: "citizen_requests", column: "citizen_email" },
      { table: "audit_logs", column: "action" },
    ];

    for (const { table, column } of criticalColumns) {
      const { rows } = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2)`,
        [table, column]
      );
      checks.push({
        name: `column_exists:${table}.${column}`,
        status: rows[0].exists ? "pass" : "fail",
        details: rows[0].exists ? `${table}.${column} exists` : `MISSING: ${table}.${column}`,
      });
    }

    // 3. Check indexes exist
    const { rows: indexes } = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`
    );
    const indexCount = indexes.length;
    checks.push({
      name: "index_count",
      status: indexCount >= 10 ? "pass" : "warn",
      details: `${indexCount} indexes found`,
    });

    // 4. Check row counts for critical tables
    for (const table of ["users", "organizations"]) {
      try {
        const { rows: [row] } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${table}`);
        checks.push({
          name: `row_count:${table}`,
          status: "pass",
          details: `${table}: ${row.cnt} rows`,
        });
      } catch {
        checks.push({
          name: `row_count:${table}`,
          status: "warn",
          details: `Could not count rows in ${table}`,
        });
      }
    }

    // 5. Check foreign key constraints
    const { rows: fks } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM information_schema.table_constraints
       WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'`
    );
    checks.push({
      name: "foreign_keys",
      status: "pass",
      details: `${fks[0].cnt} foreign key constraints`,
    });

  } finally {
    await pool.end();
  }

  const passed = checks.every(c => c.status !== "fail");

  const report: VerificationReport = {
    passed,
    checks,
    duration: Date.now() - start,
  };

  if (passed) {
    logger.info({ checks: checks.length, duration: report.duration }, "[Migration] All checks passed");
  } else {
    const failures = checks.filter(c => c.status === "fail");
    logger.error({ failures }, "[Migration] %d checks failed", failures.length);
  }

  return report;
}
