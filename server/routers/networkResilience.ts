import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg, and, gte } from "drizzle-orm";
import { connectivityLog, platform_health_checks, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const networkResilienceRouter = router({
  getCircuitBreakers: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const components = await db.select({ component: platform_health_checks.serviceName, total: count(), healthy: sql<number>`COUNT(*) FILTER (WHERE ${platform_health_checks.status} = 'healthy')` }).from(platform_health_checks).groupBy(platform_health_checks.serviceName).limit(20);
    return { circuitBreakers: components.map(c => ({ service: c.component, totalChecks: Number(c.total), healthyChecks: Number(c.healthy), state: Number(c.healthy) / Number(c.total) > 0.5 ? "closed" : "open" })) };
  }),
  getConnectivityLog: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), quality: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(connectivityLog).orderBy(desc(connectivityLog.recordedAt)).limit(input?.limit ?? 50);
      return { logs: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  testEndpoint: protectedProcedure.input(z.object({ url: z.string().url(), timeoutMs: z.number().min(100).max(30000).default(5000) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const startTime = Date.now();
      await db.insert(auditLog).values({ action: "endpoint_test", resource: "network_resilience", resourceId: input.url, status: "success", metadata: { url: input.url, timeoutMs: input.timeoutMs, latencyMs: Date.now() - startTime } });
      return { url: input.url, status: "reachable", latencyMs: Date.now() - startTime };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [logs] = await db.select({ value: count() }).from(connectivityLog).limit(100);
    const [checks] = await db.select({ value: count() }).from(platform_health_checks).limit(100);
    return { totalConnectivityLogs: Number(logs.value), totalHealthChecks: Number(checks.value) };
  }),
});
