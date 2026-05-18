import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import { fraudAlerts, transactions, auditLog } from "../../drizzle/schema";

export const fraudRealtimeVizRouter = router({
  getRealtimeAlerts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(fraudAlerts).where(eq(fraudAlerts.status, "open")).orderBy(desc(fraudAlerts.createdAt)).limit(input?.limit ?? 20);
    return { alerts: rows, total: rows.length };
  }),
  getHeatmap: protectedProcedure.input(z.object({ hours: z.number().default(24) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select({ severity: fraudAlerts.severity, cnt: count() }).from(fraudAlerts).where(gte(fraudAlerts.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(input?.hours ?? 24))} hours'`)).groupBy(fraudAlerts.severity);
    return { heatmap: rows.map(r => ({ severity: r.severity, count: Number(r.cnt) })), period: `${input?.hours ?? 24}h` };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(fraudAlerts);
    const [open] = await db.select({ value: count() }).from(fraudAlerts).where(eq(fraudAlerts.status, "open"));
    const [critical] = await db.select({ value: count() }).from(fraudAlerts).where(eq(fraudAlerts.severity, "critical"));
    return { totalAlerts: Number(total.value), openAlerts: Number(open.value), criticalAlerts: Number(critical.value) };
  }),
});
