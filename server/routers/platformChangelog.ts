import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const platformChangelogRouter = router({
  listReleases: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { releases: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`\${systemConfig.key} LIKE 'release_%'`).orderBy(desc(systemConfig.updatedAt)).limit(input?.limit ?? 20);
    return { releases: rows.map(r => ({ id: r.key.replace("release_", ""), ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
  }),
  getRelease: protectedProcedure.input(z.object({ releaseId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "release_" + input.releaseId)).limit(1);
    if (rows.length === 0) return null;
    return { id: input.releaseId, ...JSON.parse(String(rows[0].value ?? "{}")) };
  }),
  createRelease: protectedProcedure.input(z.object({ version: z.string(), title: z.string(), features: z.array(z.string()), breakingChanges: z.array(z.string()).optional(), migrationGuide: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const releaseId = "REL-" + crypto.randomUUID().toUpperCase();
    await db.insert(systemConfig).values({ key: "release_" + releaseId, value: JSON.stringify({ ...input, status: "current", date: new Date().toISOString().split("T")[0], knownIssues: [] }) });
    await db.insert(auditLog).values({ action: "release_published", resource: "changelog", resourceId: releaseId, status: "success", metadata: { version: input.version, title: input.title } });
    return { success: true, releaseId };
  }),
});
