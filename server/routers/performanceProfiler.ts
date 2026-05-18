import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const performanceProfilerRouter = router({
  listProfiles: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "performance_profile")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { profiles: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  startProfile: protectedProcedure.input(z.object({ endpoint: z.string(), duration: z.number().default(30), sampleRate: z.number().default(100) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const profileId = "prof-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "profile_started", resource: "performance_profile", resourceId: profileId, status: "success", metadata: { endpoint: input.endpoint, duration: input.duration, sampleRate: input.sampleRate } });
    return { profileId, endpoint: input.endpoint, status: "profiling", duration: input.duration };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "performance_profile"));
    return { totalProfiles: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
