import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const mobileApiLayerRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRequests: 0, activeDevices: 0, apiVersion: "v3", sdkVersion: "2.1.0" };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "mobile_api")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalRequests: rows.length, activeDevices: 0, apiVersion: "v3", sdkVersion: "2.1.0" };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { config: null };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "mobile_api_config")).limit(1);
    if (rows.length > 0 && rows[0].value) return { config: JSON.parse(String(rows[0].value)) };
    return { config: { apiUrl: "/api/trpc", wsUrl: "/ws", offlineEnabled: true, syncInterval: 30000, maxOfflineQueue: 500 } };
  }),
  updateConfig: protectedProcedure.input(z.object({ offlineEnabled: z.boolean().optional(), syncInterval: z.number().optional(), maxOfflineQueue: z.number().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(systemConfig).values({ key: "mobile_api_config", value: JSON.stringify(input) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(input), updatedAt: new Date() } });
    return { success: true };
  }),
});
