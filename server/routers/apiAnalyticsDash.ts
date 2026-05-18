import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, avg, and, gte } from "drizzle-orm";
import { apiKeyUsage, apiKeys, platform_health_checks, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const apiAnalyticsDashRouter = router({
  getDashboard: protectedProcedure.input(z.object({ hoursBack: z.number().min(1).max(720).default(24) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [totalKeys] = await db.select({ value: count() }).from(apiKeys).limit(100);
      const [totalUsage] = await db.select({ value: count() }).from(apiKeyUsage).limit(100);
      const [avgLatency] = await db.select({ value: avg(platform_health_checks.responseTime) }).from(platform_health_checks).limit(100);
      return { totalApiKeys: Number(totalKeys.value), totalRequests: Number(totalUsage.value), avgLatencyMs: Math.round(Number(avgLatency.value ?? 0)), periodHours: input?.hoursBack ?? 24 };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getTopEndpoints: protectedProcedure.input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select({ endpoint: apiKeyUsage.endpoint, requestCount: count() }).from(apiKeyUsage).groupBy(apiKeyUsage.endpoint).orderBy(desc(count())).limit(input?.limit ?? 10);
      return { endpoints: rows };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [keys] = await db.select({ value: count() }).from(apiKeys).limit(100);
    const [usage] = await db.select({ value: count() }).from(apiKeyUsage).limit(100);
    return { totalKeys: Number(keys.value), totalRequests: Number(usage.value) };
  }),
});
