import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const canaryReleaseManagerRouter = router({
  listReleases: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "canary_release")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { releases: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  createRelease: protectedProcedure.input(z.object({ version: z.string(), percentage: z.number().min(1).max(100), service: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const releaseId = "canary-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "canary_release_created", resource: "canary_release", resourceId: releaseId, status: "success", metadata: { version: input.version, percentage: input.percentage, service: input.service } });
    return { releaseId, version: input.version, percentage: input.percentage, service: input.service, status: "active" };
  }),
  promoteRelease: protectedProcedure.input(z.object({ releaseId: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "canary_release_promoted", resource: "canary_release", resourceId: input.releaseId, status: "success", metadata: { promotedAt: new Date().toISOString() } });
    return { success: true, releaseId: input.releaseId, status: "promoted" };
  }),
  rollbackRelease: protectedProcedure.input(z.object({ releaseId: z.string(), reason: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "canary_release_rolled_back", resource: "canary_release", resourceId: input.releaseId, status: "warning", metadata: { reason: input.reason } });
    return { success: true, releaseId: input.releaseId, status: "rolled_back" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "canary_release"));
    return { totalReleases: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
