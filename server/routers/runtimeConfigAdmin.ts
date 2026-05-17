import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const runtimeConfigAdminRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalConfigs: 0, modifiedToday: 0, environments: 0 };
    const [total] = await db.select({ value: count() }).from(systemConfig);
    return { totalConfigs: Number(total.value), modifiedToday: 0, environments: 3 };
  }),
  listConfigs: protectedProcedure.input(z.object({ prefix: z.string().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { configs: [], total: 0 };
    const conditions: any[] = [];
    if (input?.prefix) conditions.push(sql`${systemConfig.key} LIKE ${input.prefix + "%"}`);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(systemConfig).where(where).orderBy(asc(systemConfig.key)).limit(input?.limit ?? 50);
    return { configs: rows.map(r => ({ key: r.key, value: r.value, updatedAt: r.updatedAt })), total: rows.length };
  }),
  getConfig: protectedProcedure.input(z.object({ key: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, input.key)).limit(1);
    return rows.length > 0 ? { key: rows[0].key, value: rows[0].value, updatedAt: rows[0].updatedAt } : null;
  }),
  setConfig: protectedProcedure.input(z.object({ key: z.string(), value: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(systemConfig).values({ key: input.key, value: input.value }).onConflictDoUpdate({ target: systemConfig.key, set: { value: input.value, updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: "config_updated", resource: "system_config", resourceId: input.key, status: "success", metadata: { key: input.key } });
    return { success: true };
  }),
  deleteConfig: protectedProcedure.input(z.object({ key: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(systemConfig).where(eq(systemConfig.key, input.key));
    await db.insert(auditLog).values({ action: "config_deleted", resource: "system_config", resourceId: input.key, status: "success", metadata: {} });
    return { success: true };
  }),
});
