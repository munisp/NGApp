import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { analyticsMetrics, auditLog, systemConfig } from "../../drizzle/schema";

export const platformMetricsExporterRouter = router({
  listMetrics: protectedProcedure.input(z.object({ limit: z.number().default(100) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(analyticsMetrics).orderBy(desc(analyticsMetrics.createdAt)).limit(input?.limit ?? 100);
    return { metrics: rows, total: rows.length };
  }),
  getExportConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "metrics_exporter_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { format: "prometheus", endpoint: "/metrics", interval: 15, enabled: true };
  }),
  exportMetrics: protectedProcedure.input(z.object({ format: z.enum(["prometheus", "json", "openmetrics"]).default("prometheus") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(analyticsMetrics).limit(100);
    await db.insert(auditLog).values({ action: "metrics_exported", resource: "metrics_exporter", resourceId: "export-" + crypto.randomUUID(), status: "success", metadata: { format: input.format, metricCount: rows.length } });
    return { success: true, format: input.format, metricCount: rows.length, exportedAt: new Date().toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(analyticsMetrics);
    return { totalMetrics: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
