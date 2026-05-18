import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const predictiveAgentChurnRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalItems: 0, active: 0, lastUpdated: null };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'churn_%'`).limit(100);
    return { totalItems: rows.length, active: rows.length, lastUpdated: new Date().toISOString() };
  }),
  list: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'churn_%'`).limit(input?.limit ?? 20);
    return { items: rows.map(r => ({ id: r.key.replace("churn_", ""), ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ name: z.string(), data: z.record(z.string(), z.any()).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const itemId = "CHURN-" + crypto.randomUUID().toUpperCase();
    await db.insert(systemConfig).values({ key: "churn_" + itemId, value: JSON.stringify({ name: input.name, ...input.data, createdAt: new Date().toISOString() }) });
    await db.insert(auditLog).values({ action: "churn_created", resource: "churn", resourceId: itemId, status: "success", metadata: { name: input.name } });
    return { success: true, itemId };
  }),
  delete: protectedProcedure.input(z.object({ itemId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(systemConfig).where(eq(systemConfig.key, "churn_" + input.itemId));
    return { success: true };
  }),
});
