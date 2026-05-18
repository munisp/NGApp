import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const networkTelemetryRouter = router({
  getMetrics: protectedProcedure.input(z.object({ period: z.enum(["1h", "6h", "24h", "7d"]).default("24h") }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "network_telemetry")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { metrics: rows.map(r => ({ type: r.action, value: r.metadata, timestamp: r.createdAt })), period: input?.period ?? "24h", total: rows.length };
  }),
  getTopEndpoints: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select({ endpoint: auditLog.resourceId, cnt: count() }).from(auditLog).where(eq(auditLog.resource, "network_telemetry")).groupBy(auditLog.resourceId).orderBy(desc(count())).limit(input?.limit ?? 20);
    return { endpoints: rows.map(r => ({ endpoint: r.endpoint, requestCount: Number(r.cnt) })) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "network_telemetry"));
    return { totalDataPoints: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
