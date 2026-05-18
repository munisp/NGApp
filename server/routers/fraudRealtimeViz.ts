import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import { fraudAlerts, transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const fraudRealtimeVizRouter = router({
  getRealtimeAlerts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(fraudAlerts).where(eq(fraudAlerts.status, "open")).orderBy(desc(fraudAlerts.createdAt)).limit(input?.limit ?? 20);
      return { alerts: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getHeatmap: protectedProcedure.input(z.object({ hours: z.number().default(24) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select({ severity: fraudAlerts.severity, cnt: count() }).from(fraudAlerts).where(gte(fraudAlerts.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(input?.hours ?? 24))} hours'`)).groupBy(fraudAlerts.severity).limit(100);
      return { heatmap: rows.map(r => ({ severity: r.severity, count: Number(r.cnt) })), period: `${input?.hours ?? 24}h` };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(fraudAlerts).limit(100);
    const [open] = await db.select({ value: count() }).from(fraudAlerts).where(eq(fraudAlerts.status, "open")).limit(100);
    const [critical] = await db.select({ value: count() }).from(fraudAlerts).where(eq(fraudAlerts.severity, "critical")).limit(100);
    return { totalAlerts: Number(total.value), openAlerts: Number(open.value), criticalAlerts: Number(critical.value) };
  }),
});
