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
 */

import { runBenchmarkSuite, type BenchmarkRun } from "./influxBenchmark";
import { notifyOwner } from "./_core/notification";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const ALERT_THRESHOLD = parseInt(process.env.BENCHMARK_ALERT_THRESHOLD ?? "70", 10);
const CRON_HOUR_UTC = parseInt(process.env.BENCHMARK_CRON_HOUR ?? "2", 10); // 02:00 UTC

// In-memory store for the last 30 nightly runs (no DB dependency)
const nightlyHistory: BenchmarkRun[] = [];
const MAX_HISTORY = 30;

// ─── BENCHMARK RUNNER ─────────────────────────────────────────────────────────

async function runNightlyBenchmark() {
  const startedAt = new Date().toISOString();
  console.log(`[BenchmarkScheduler] Starting nightly benchmark run at ${startedAt}`);

  try {
    const result = await runBenchmarkSuite();

    // Persist to in-memory history
    nightlyHistory.unshift(result);
    if (nightlyHistory.length > MAX_HISTORY) nightlyHistory.pop();

    const score = result.summary.overallScore;
    const backend = result.backend;

    console.log(
      `[BenchmarkScheduler] Nightly run complete — score: ${score}% | backend: ${backend} | ` +
      `exceeds: ${result.summary.exceeds} | meets: ${result.summary.meets} | below: ${result.summary.below}`
    );

    // ── Alert owner if score drops below threshold ─────────────────────────
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
        const sent = await notifyOwner({ title, content });
        if (sent) {
          console.log(`[BenchmarkScheduler] Owner alert sent — score ${score}% below ${ALERT_THRESHOLD}% threshold`);
        } else {
          console.warn(`[BenchmarkScheduler] Owner alert failed to send (notification service unavailable)`);
        }
      } catch (notifyErr) {
        // Don't let notification failure crash the scheduler
        console.warn(`[BenchmarkScheduler] Owner alert error:`, notifyErr instanceof Error ? notifyErr.message : notifyErr);
      }
    } else {
      console.log(`[BenchmarkScheduler] Score ${score}% is above threshold ${ALERT_THRESHOLD}% — no alert needed`);
    }

    return result;
  } catch (err) {
    console.error(`[BenchmarkScheduler] Nightly benchmark failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── SCHEDULER ────────────────────────────────────────────────────────────────

/**
 * Calculate milliseconds until the next scheduled run at CRON_HOUR_UTC:00 UTC.
 */
function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(CRON_HOUR_UTC, 0, 0, 0);

  // If the target time has already passed today, schedule for tomorrow
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextRun() {
  const delay = msUntilNextRun();
  const nextRunAt = new Date(Date.now() + delay).toISOString();
  console.log(`[BenchmarkScheduler] Next nightly run scheduled at ${nextRunAt} (in ${Math.round(delay / 60000)} minutes)`);

  schedulerTimer = setTimeout(async () => {
    await runNightlyBenchmark();
    scheduleNextRun(); // Re-schedule for the next day
  }, delay);

  // Prevent the timer from blocking process exit
  if (schedulerTimer.unref) schedulerTimer.unref();
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Start the nightly benchmark scheduler.
 * Called once from server/_core/index.ts on startup.
 */
export function startBenchmarkScheduler() {
  console.log(
    `[BenchmarkScheduler] Started — nightly runs at ${CRON_HOUR_UTC.toString().padStart(2, "0")}:00 UTC | ` +
    `alert threshold: ${ALERT_THRESHOLD}%`
  );
  scheduleNextRun();
}

/**
 * Stop the scheduler (useful for graceful shutdown or tests).
 */
export function stopBenchmarkScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    console.log("[BenchmarkScheduler] Stopped");
  }
}

/**
 * Get the in-memory nightly benchmark history.
 */
export function getNightlyBenchmarkHistory(limit = 10): BenchmarkRun[] {
  return nightlyHistory.slice(0, limit);
}

/**
 * Trigger a benchmark run immediately (for testing or manual trigger from UI).
 */
export async function triggerBenchmarkNow(): Promise<BenchmarkRun | null> {
  return runNightlyBenchmark();
}
