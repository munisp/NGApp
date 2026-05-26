import { TRPCError } from "@trpc/server";
/**
 * influxBenchmark router — InfluxDB vs. Historian Benchmark tRPC procedures
 */

import { z } from "zod";
import { router, protectedProcedure} from "../_core/trpc";
import { runBenchmarkSuite, type BenchmarkRun } from "../influxBenchmark";
import { triggerBenchmarkNow, getNightlyBenchmarkHistory } from "../benchmarkScheduler";

// In-memory store for benchmark history (last 10 runs)
const benchmarkHistory: BenchmarkRun[] = [];
const MAX_HISTORY = 10;

export const influxBenchmarkRouter = router({
  /**
   * Run the full benchmark suite.
   * Returns results immediately (runs synchronously, ~5-15s).
   */
  run: protectedProcedure.mutation(async () => {
    const result = await runBenchmarkSuite();
    benchmarkHistory.unshift(result);
    if (benchmarkHistory.length > MAX_HISTORY) benchmarkHistory.pop();
    return result;
  }),

  /**
   * Get the most recent benchmark run result.
   */
  latest: protectedProcedure.query(() => {
    try {
      return benchmarkHistory[0] ?? null;
    } catch (err: unknown) {
      if (err instanceof TRPCError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }
  }),

  /**
   * Get benchmark run history (last N runs).
   */
  history: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(10).default(5) }).optional())
    .query(({ input }) => {
      return benchmarkHistory.slice(0, input?.limit ?? 5);
    }),

  /**
   * Trigger a nightly-style benchmark run immediately (with owner alert if score < 70%).
   * This is the same run that the scheduler fires at 02:00 UTC.
   */
  triggerNow: protectedProcedure.mutation(async () => {
    const result = await triggerBenchmarkNow();
    return result;
  }),

  /**
   * Get the nightly scheduler history (last 30 runs).
   */
  nightlyHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(10) }).optional())
    .query(({ input }) => {
      try {
        return getNightlyBenchmarkHistory(input?.limit ?? 10);
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  /**
   * Get the current backend configuration status.
   */
  config: protectedProcedure.query(() => {
    const influxConfigured = !!(process.env.INFLUXDB_URL && process.env.INFLUXDB_TOKEN);
    return {
      influxConfigured,
      influxUrl: process.env.INFLUXDB_URL ? process.env.INFLUXDB_URL.replace(/\/\/.*@/, "//***@") : null,
      influxBucket: process.env.INFLUXDB_BUCKET ?? "og_rmm",
      influxOrg: process.env.INFLUXDB_ORG ?? "og-rmm",
      postgresAvailable: !!process.env.DATABASE_URL,
      activeBackend: influxConfigured ? "InfluxDB" : "PostgreSQL (fallback)",
      competitorTargets: {
        aveva_pi: { tags: 10_000_000, writePtsPerSec: 1_000_000, queryMs: 80 },
        cognite_cdf: { tags: 50_000_000, writePtsPerSec: 500_000, queryMs: 150 },
        influxdb_oss: { tags: 1_000_000, writePtsPerSec: 300_000, queryMs: 50 },
      },
    };
  }),
});
