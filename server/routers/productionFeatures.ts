import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const productionFeaturesRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalFeatures: 0, enabled: 0, disabled: 0, rolloutInProgress: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'ff_%'`);
    const enabled = rows.filter(r => { try { return JSON.parse(String(r.value ?? "{}")).enabled === true; } catch { return false; } }).length;
    return { totalFeatures: rows.length, enabled, disabled: rows.length - enabled, rolloutInProgress: 0 };
  }),
  listFeatures: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { features: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'ff_%'`).limit(input?.limit ?? 50);
    return { features: rows.map(r => ({ key: r.key.replace("ff_", ""), ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
  }),
  toggleFeature: protectedProcedure.input(z.object({ featureKey: z.string(), enabled: z.boolean() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const key = "ff_" + input.featureKey;
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
    const existing = rows.length > 0 ? JSON.parse(String(rows[0].value ?? "{}")) : {};
    const merged = { ...existing, enabled: input.enabled, updatedAt: new Date().toISOString() };
    await db.insert(systemConfig).values({ key, value: JSON.stringify(merged) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(merged), updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: input.enabled ? "feature_enabled" : "feature_disabled", resource: "feature_flags", resourceId: input.featureKey, status: "success", metadata: { enabled: input.enabled } });
    return { success: true };
  }),
  createFeature: protectedProcedure.input(z.object({ name: z.string(), description: z.string().optional(), enabled: z.boolean().default(false), rolloutPercent: z.number().default(0) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const key = "ff_" + input.name.toLowerCase().replace(/\s+/g, "_");
    await db.insert(systemConfig).values({ key, value: JSON.stringify({ name: input.name, description: input.description, enabled: input.enabled, rolloutPercent: input.rolloutPercent, createdAt: new Date().toISOString() }) });
    await db.insert(auditLog).values({ action: "feature_created", resource: "feature_flags", resourceId: key, status: "success", metadata: { name: input.name } });
    return { success: true, featureKey: key };
  }),
});
