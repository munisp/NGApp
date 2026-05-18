import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg, and, gte } from "drizzle-orm";
import { platform_health_checks, auditLog } from "../../drizzle/schema";

export const performanceProfilerRouter = router({
  listProfiles: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50), component: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platform_health_checks).orderBy(desc(platform_health_checks.checkedAt)).limit(input?.limit ?? 50);
    return { profiles: rows.map(r => ({ id: r.id, component: r.component, latencyMs: r.latencyMs, status: r.status, checkedAt: r.checkedAt })), total: rows.length };
  }),
  startProfile: protectedProcedure.input(z.object({ component: z.string().min(1).max(128), durationMs: z.number().min(1000).max(300000).default(30000) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const profileId = crypto.randomUUID();
    await db.insert(platform_health_checks).values({ component: input.component, status: "healthy", latencyMs: 0 });
    await db.insert(auditLog).values({ action: "profile_started", resource: "performance_profiler", resourceId: profileId, status: "success", metadata: { component: input.component, durationMs: input.durationMs } });
    return { profileId, component: input.component, status: "recording", durationMs: input.durationMs };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks);
    const [avgLat] = await db.select({ value: avg(platform_health_checks.latencyMs) }).from(platform_health_checks);
    return { totalProfiles: Number(total.value), avgLatencyMs: Math.round(Number(avgLat.value ?? 0)) };
  }),
});
