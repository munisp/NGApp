import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg, and, gte } from "drizzle-orm";
import { platform_health_checks, systemConfig, auditLog } from "../../drizzle/schema";

export const smartContractPaymentRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platform_health_checks).where(eq(platform_health_checks.component, "smart_contract")).orderBy(desc(platform_health_checks.checkedAt)).limit(input?.limit ?? 50);
    return { items: rows, total: rows.length };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "smart_contract_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { enabled: true, intervalMs: 30000, retentionDays: 30 };
  }),
  updateConfig: protectedProcedure.input(z.object({ enabled: z.boolean().optional(), intervalMs: z.number().min(1000).max(3600000).optional(), retentionDays: z.number().min(1).max(365).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, "smart_contract_config")).limit(1);
    const merged = existing ? { ...JSON.parse(String(existing.value)), ...input } : input;
    if (existing) {
      await db.update(systemConfig).set({ value: JSON.stringify(merged) }).where(eq(systemConfig.key, "smart_contract_config"));
    } else {
      await db.insert(systemConfig).values({ key: "smart_contract_config", value: JSON.stringify(merged) });
    }
    await db.insert(auditLog).values({ action: "smart_contract_config_updated", resource: "smart_contract", resourceId: "config", status: "success", metadata: input });
    return { success: true, config: merged };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.component, "smart_contract"));
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(and(eq(platform_health_checks.component, "smart_contract"), eq(platform_health_checks.status, "healthy")));
    const [avgLat] = await db.select({ value: avg(platform_health_checks.latencyMs) }).from(platform_health_checks).where(eq(platform_health_checks.component, "smart_contract"));
    return { totalChecks: Number(total.value), healthyChecks: Number(healthy.value), avgLatencyMs: Math.round(Number(avgLat.value ?? 0)), uptimePercent: Number(total.value) > 0 ? Math.round((Number(healthy.value) / Number(total.value)) * 100) : 100 };
  }),
});
