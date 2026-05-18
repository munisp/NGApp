import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { rateLimitRules, auditLog } from "../../drizzle/schema";

export const apiRateLimiterDashRouter = router({
  listRules: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(rateLimitRules).orderBy(desc(rateLimitRules.createdAt)).limit(input?.limit ?? 50);
    return { rules: rows, total: rows.length };
  }),
  getViolations: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "rate_limit_exceeded")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { violations: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalRules] = await db.select({ value: count() }).from(rateLimitRules);
    const [violations] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "rate_limit_exceeded"));
    return { totalRules: Number(totalRules.value), totalViolations: Number(violations.value), lastUpdated: new Date().toISOString() };
  }),
  updateRule: protectedProcedure.input(z.object({ id: z.number(), maxRequests: z.number().optional(), windowSeconds: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const updates: Record<string, unknown> = {};
    if (input.maxRequests !== undefined) updates.maxRequests = input.maxRequests;
    if (input.windowSeconds !== undefined) updates.windowSeconds = input.windowSeconds;
    await db.update(rateLimitRules).set(updates).where(eq(rateLimitRules.id, input.id));
    await db.insert(auditLog).values({ action: "rate_limit_updated", resource: "rate_limit_rules", resourceId: String(input.id), status: "success", metadata: updates });
    return { success: true };
  }),
});
