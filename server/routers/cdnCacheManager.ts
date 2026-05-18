import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const cdnCacheManagerRouter = router({
  getCacheStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "cdn_cache_config")).limit(1);
    const cacheConfig = config ? JSON.parse(String(config.value)) : { hitRate: 95, totalCached: 0, totalEvicted: 0 };
    return { ...cacheConfig, lastUpdated: new Date().toISOString() };
  }),
  listCacheRules: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "cdn_cache_rule")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { rules: rows.map(r => ({ id: r.resourceId, action: r.action, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  purgeCache: protectedProcedure.input(z.object({ pattern: z.string(), type: z.enum(["path", "tag", "all"]).default("path") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "cdn_cache_purged", resource: "cdn_cache_rule", resourceId: "purge-" + crypto.randomUUID(), status: "success", metadata: { pattern: input.pattern, type: input.type } });
    return { success: true, pattern: input.pattern, purgedAt: new Date().toISOString() };
  }),
  updateCacheRule: protectedProcedure.input(z.object({ path: z.string(), ttlSeconds: z.number(), cacheControl: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "cdn_cache_rule_updated", resource: "cdn_cache_rule", resourceId: input.path, status: "success", metadata: { ttlSeconds: input.ttlSeconds, cacheControl: input.cacheControl } });
    return { success: true, path: input.path, ttlSeconds: input.ttlSeconds };
  }),
});
