import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const openTelemetryRouter = router({
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "otel_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { endpoint: "http://localhost:4317", samplingRate: 0.1, exporterType: "otlp", serviceName: "agency-banking" };
  }),
  listTraces: protectedProcedure.input(z.object({ limit: z.number().default(50), service: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "otel_trace")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { traces: rows.map(r => ({ traceId: r.resourceId, service: r.action, status: r.status, timestamp: r.createdAt })), total: rows.length };
  }),
  updateConfig: protectedProcedure.input(z.object({ samplingRate: z.number().min(0).max(1).optional(), endpoint: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, "otel_config")).limit(1);
    const current = existing ? JSON.parse(String(existing.value)) : {};
    const updated = { ...current, ...input };
    await db.insert(systemConfig).values({ key: "otel_config", value: JSON.stringify(updated) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(updated), updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: "otel_config_updated", resource: "otel_config", resourceId: "config", status: "success", metadata: input });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "otel_trace"));
    return { totalTraces: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
