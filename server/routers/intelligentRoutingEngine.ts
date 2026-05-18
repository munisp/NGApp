import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { rateLimitRules, platform_health_checks } from "../../drizzle/schema";

export const intelligentRoutingEngineRouter = router({
  listRoutes: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(rateLimitRules).limit(input?.limit ?? 50);
    return { routes: rows.map(r => ({ id: r.id, endpoint: r.endpoint, maxRequests: r.maxRequests, windowSeconds: r.windowSeconds, isActive: r.isActive })), total: rows.length };
  }),
  getHealth: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks);
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.status, "healthy"));
    return { totalEndpoints: Number(total.value), healthyEndpoints: Number(healthy.value), routingStatus: "active" };
  }),
});
