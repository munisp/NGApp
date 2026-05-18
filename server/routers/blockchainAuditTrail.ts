import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg, and, gte } from "drizzle-orm";
import { platform_health_checks, systemConfig, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const blockchainAuditTrailRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(platform_health_checks).where(eq(platform_health_checks.serviceName, "blockchain_audit")).orderBy(desc(platform_health_checks.checkedAt)).limit(input?.limit ?? 50);
      return { items: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "blockchain_audit_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { enabled: true, intervalMs: 30000, retentionDays: 30 };
  }),
  updateConfig: protectedProcedure.input(z.object({ enabled: z.boolean().optional(), intervalMs: z.number().min(1000).max(3600000).optional(), retentionDays: z.number().min(1).max(365).optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, "blockchain_audit_config")).limit(1);
      const merged = existing ? { ...JSON.parse(String(existing.value)), ...input } : input;
      if (existing) {
        await db.update(systemConfig).set({ value: JSON.stringify(merged) }).where(eq(systemConfig.key, "blockchain_audit_config"));
      } else {
        await db.insert(systemConfig).values({ key: "blockchain_audit_config", value: JSON.stringify(merged) });
      }
      await db.insert(auditLog).values({ action: "blockchain_audit_config_updated", resource: "blockchain_audit", resourceId: "config", status: "success", metadata: input });
      return { success: true, config: merged };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.serviceName, "blockchain_audit")).limit(100);
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(and(eq(platform_health_checks.serviceName, "blockchain_audit"), eq(platform_health_checks.status, "healthy"))).limit(100);
    const [avgLat] = await db.select({ value: avg(platform_health_checks.responseTime) }).from(platform_health_checks).where(eq(platform_health_checks.serviceName, "blockchain_audit")).limit(100);
    return { totalChecks: Number(total.value), healthyChecks: Number(healthy.value), avgLatencyMs: Math.round(Number(avgLat.value ?? 0)), uptimePercent: Number(total.value) > 0 ? Math.round((Number(healthy.value) / Number(total.value)) * 100) : 100 };
  }),
});
