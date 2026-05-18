import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { rateLimitRules, platform_health_checks } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const intelligentRoutingEngineRouter = router({
  listRoutes: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(rateLimitRules).limit(input?.limit ?? 50);
      return { routes: rows.map(r => ({ id: r.id, endpoint: r.endpoint, maxRequests: r.maxRequests, windowSeconds: r.windowSeconds, isActive: r.isActive })), total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getHealth: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks).limit(100);
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.status, "healthy")).limit(100);
    return { totalEndpoints: Number(total.value), healthyEndpoints: Number(healthy.value), routingStatus: "active" };
  }),
});
