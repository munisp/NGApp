import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { softwareUpdates, platform_health_checks, auditLog } from "../../drizzle/schema";

export const canaryReleaseManagerRouter = router({
  listReleases: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(softwareUpdates).orderBy(desc(softwareUpdates.createdAt)).limit(input?.limit ?? 50);
    return { releases: rows, total: rows.length };
  }),
  createRelease: protectedProcedure.input(z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), canaryPercent: z.number().min(1).max(100).default(5), description: z.string().max(500).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const releaseId = "CAN-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const [release] = await db.insert(softwareUpdates).values({ version: input.version, component: "canary", status: "pending", releaseNotes: input.description ?? "" }).returning();
    await db.insert(auditLog).values({ action: "canary_release_created", resource: "software_updates", resourceId: releaseId, status: "success", metadata: { version: input.version, canaryPercent: input.canaryPercent } });
    return { releaseId, updateId: release.id, version: input.version, canaryPercent: input.canaryPercent, status: "canary" };
  }),
  promoteRelease: protectedProcedure.input(z.object({ releaseId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(softwareUpdates).set({ status: "released" }).where(eq(softwareUpdates.id, input.releaseId));
    await db.insert(auditLog).values({ action: "canary_promoted", resource: "software_updates", resourceId: String(input.releaseId), status: "success", metadata: {} });
    return { success: true, releaseId: input.releaseId, status: "released" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(softwareUpdates);
    return { totalReleases: Number(total.value) };
  }),
});
