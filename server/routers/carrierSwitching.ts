import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const carrierSwitchingRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSwitches: 0, successRate: 0, avgSwitchTimeMs: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "carrier_switch")).orderBy(desc(auditLog.createdAt)).limit(500);
    const success = rows.filter(r => r.status === "success").length;
    return { totalSwitches: rows.length, successRate: rows.length > 0 ? Math.round(success / rows.length * 100) : 100, avgSwitchTimeMs: 250 };
  }),
  listSwitches: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { switches: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "carrier_switch")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { switches: rows.map(r => ({ id: r.id, ...r.metadata as any, status: r.status, switchedAt: r.createdAt })), total: rows.length };
  }),
  requestSwitch: protectedProcedure.input(z.object({ fromCarrier: z.string(), toCarrier: z.string(), reason: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const switchId = "SW-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "carrier_switch", resource: "carriers", resourceId: switchId, status: "success", metadata: { fromCarrier: input.fromCarrier, toCarrier: input.toCarrier, reason: input.reason } });
    return { success: true, switchId };
  }),
});
