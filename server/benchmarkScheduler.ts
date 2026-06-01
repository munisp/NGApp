/**
 * benchmarkScheduler.ts — Nightly InfluxDB benchmark cron
 *
 * Runs the full InfluxDB benchmark suite once per day at 02:00 UTC.
 * If the overall score drops below the ALERT_THRESHOLD (default 70%),
 * fires a notifyOwner() alert so the team can investigate before the
 * next production shift.
 *
 * Schedule: 02:00 UTC daily (configurable via BENCHMARK_CRON_HOUR env var)
 * Alert threshold: 70% (configurable via BENCHMARK_ALERT_THRESHOLD env var)
 *
 * History is persisted to PostgreSQL (benchmark_runs table) to survive restarts.
 */

import { runBenchmarkSuite, type BenchmarkRun } from "./influxBenchmark";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { benchmarkRuns } from "../drizzle/schema";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import logger from "./_core/logger";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const ALERT_THRESHOLD = parseInt(process.env.BENCHMARK_ALERT_THRESHOLD ?? "70", 10);
const CRON_HOUR_UTC = parseInt(process.env.BENCHMARK_CRON_HOUR ?? "2", 10);

// ─── BENCHMARK RUNNER ─────────────────────────────────────────────────────────

async function runNightlyBenchmark(): Promise<BenchmarkRun | null> {
  const startedAt = new Date();
  logger.info({ startedAt: startedAt.toISOString() }, "Starting nightly benchmark run");

  try {
    const result = await runBenchmarkSuite();

    // Persist to PostgreSQL
    const db = await getDb();
    if (db) {
      await db.insert(benchmarkRuns).values({
        runId: `BENCH-${nanoid(8)}`,
        status: "completed",
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        metrics: result.summary as any,
      }).onConflictDoNothing();
    }

    const score = result.summary.overallScore;
    const backend = result.backend;

    logger.info({ score, backend, exceeds: result.summary.exceeds, meets: result.summary.meets, below: result.summary.below }, "Nightly benchmark complete");

    if (score < ALERT_THRESHOLD) {
      const belowTargetTests = result.results
        .filter(r => r.status === "below")
        .map(r => `  • **${r.name}**: ${r.value.toLocaleString()} ${r.unit} (target: ${r.targetValue.toLocaleString()} ${r.unit})`)
        .join("\n");

      const title = `⚠️ InfluxDB Benchmark Alert — Score ${score}% (below ${ALERT_THRESHOLD}% threshold)`;
      const content = [
        `## Nightly InfluxDB Benchmark Alert`,
        ``,
        `The automated nightly benchmark run completed with an overall score of **${score}%**, which is below the alert threshold of **${ALERT_THRESHOLD}%**.`,
        ``,
        `**Run Details:**`,
        `- **Backend:** ${backend}`,
        `- **Started:** ${result.startedAt}`,
        `- **Completed:** ${result.completedAt}`,
        `- **Total Tests:** ${result.summary.totalTests}`,
        `- **Exceeds Target:** ${result.summary.exceeds}`,
        `- **Meets Target:** ${result.summary.meets}`,
        `- **Below Target:** ${result.summary.below}`,
        ``,
        `**Tests Below Target:**`,
        belowTargetTests || "  (none)",
        ``,
        `**Recommended Actions:**`,
        `1. Check InfluxDB service health and resource utilisation (CPU, memory, disk I/O)`,
        `2. Review recent schema changes or query patterns that may have degraded performance`,
        `3. Compare against the previous nightly run in the InfluxDB Benchmark dashboard`,
        `4. If PostgreSQL fallback is active, consider provisioning InfluxDB for production`,
        ``,
        `View the full benchmark report at: /influx-benchmark`,
      ].join("\n");

      try {
        await notifyOwner({ title, content });
        logger.info({ score, threshold: ALERT_THRESHOLD }, "Owner alert sent — benchmark below threshold");
      } catch (notifyErr) {
        logger.warn({ err: notifyErr }, "Owner alert failed to send");
      }
    }

    return result;
  } catch (err) {
    logger.error({ err }, "Nightly benchmark failed");

    const db = await getDb();
    if (db) {
      await db.insert(benchmarkRuns).values({
        runId: `BENCH-${nanoid(8)}`,
        status: "failed",
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        metrics: { error: err instanceof Error ? err.message : String(err) },
      }).onConflictDoNothing();
    }

    return null;
  }
}

// ─── SCHEDULER ────────────────────────────────────────────────────────────────

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(CRON_HOUR_UTC, 0, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextRun() {
  const delay = msUntilNextRun();
  const nextRunAt = new Date(Date.now() + delay).toISOString();
  logger.info({ nextRunAt, delayMin: Math.round(delay / 60000) }, "Next nightly benchmark scheduled");

  schedulerTimer = setTimeout(async () => {
    await runNightlyBenchmark();
    scheduleNextRun();
  }, delay);

  if (schedulerTimer.unref) schedulerTimer.unref();
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export function startBenchmarkScheduler() {
  logger.info({ cronHourUtc: CRON_HOUR_UTC, alertThreshold: ALERT_THRESHOLD }, "BenchmarkScheduler started");
  scheduleNextRun();
}

export function stopBenchmarkScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    logger.info("BenchmarkScheduler stopped");
  }
}

export async function getNightlyBenchmarkHistory(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(benchmarkRuns).orderBy(desc(benchmarkRuns.createdAt)).limit(limit);
}

export async function triggerBenchmarkNow(): Promise<BenchmarkRun | null> {
  return runNightlyBenchmark();
}
