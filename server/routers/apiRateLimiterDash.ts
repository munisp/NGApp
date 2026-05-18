import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { rateLimitRules, auditLog } from "../../drizzle/schema";

export const apiRateLimiterDashRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(rateLimitRules).orderBy(desc(rateLimitRules.createdAt)).limit(input?.limit ?? 50);
    return { rules: rows, total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ endpoint: z.string().min(1), maxRequests: z.number().int().positive(), windowSeconds: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [rule] = await db.insert(rateLimitRules).values({ endpoint: input.endpoint, maxRequests: input.maxRequests, windowSeconds: input.windowSeconds, isActive: true }).returning();
    await db.insert(auditLog).values({ action: "rate_limit_rule_created", resource: "rate_limit_rules", resourceId: String(rule.id), status: "success", metadata: { endpoint: input.endpoint } });
    return { id: rule.id, endpoint: input.endpoint, status: "active" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(rateLimitRules);
    const [enabled] = await db.select({ value: count() }).from(rateLimitRules).where(eq(rateLimitRules.isActive, true));
    return { totalRules: Number(total.value), enabledRules: Number(enabled.value) };
  }),
});
