import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, gte, lte } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const auditTrailRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(50), offset: z.number().default(0), action: z.string().optional(), resource: z.string().optional(), status: z.string().optional() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input.action) conditions.push(eq(auditLog.action, input.action));
    if (input.resource) conditions.push(eq(auditLog.resource, input.resource));
    if (input.status) conditions.push(eq(auditLog.status, input.status));
    const rows = conditions.length > 0 ? await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input.limit).offset(input.offset) : await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(input.limit).offset(input.offset);
    const [totalResult] = conditions.length > 0 ? await db.select({ value: count() }).from(auditLog).where(and(...conditions)) : await db.select({ value: count() }).from(auditLog);
    return { items: rows, total: Number(totalResult.value), limit: input.limit, offset: input.offset };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, input.id)).limit(1);
    return row ?? null;
  }),
  getActions: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select({ action: auditLog.action, cnt: count() }).from(auditLog).groupBy(auditLog.action).orderBy(desc(count())).limit(50);
    return { actions: rows.map(r => ({ action: r.action, count: Number(r.cnt) })) };
  }),
  getResources: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select({ resource: auditLog.resource, cnt: count() }).from(auditLog).groupBy(auditLog.resource).orderBy(desc(count())).limit(50);
    return { resources: rows.map(r => ({ resource: r.resource, count: Number(r.cnt) })) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog);
    const [success] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.status, "success"));
    const [failure] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.status, "failure"));
    return { totalEntries: Number(total.value), successCount: Number(success.value), failureCount: Number(failure.value) };
  }),
});
