import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, ilike, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const activityAuditLogRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), action: z.string().optional(), resource: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.action) conditions.push(ilike(auditLog.action, `%${input.action}%`));
    if (input?.resource) conditions.push(eq(auditLog.resource, input.resource));
    const rows = await db.select().from(auditLog).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    const [total] = await db.select({ value: count() }).from(auditLog).where(conditions.length ? and(...conditions) : undefined);
    return { entries: rows, total: Number(total.value) };
  }),
});
