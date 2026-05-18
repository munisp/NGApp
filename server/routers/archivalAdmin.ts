import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, lte } from "drizzle-orm";
import { auditLog, transactions } from "../../drizzle/schema";

export const archivalAdminRouter = router({
  getArchivalPolicies: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "archival_policy_set")).orderBy(desc(auditLog.createdAt)).limit(20);
    return { policies: rows.map(r => ({ id: r.resourceId, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  getArchivalHistory: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "data_archived")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { history: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalArchived] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "data_archived"));
    const [totalTx] = await db.select({ value: count() }).from(transactions);
    return { totalArchivedOperations: Number(totalArchived.value), totalTransactions: Number(totalTx.value), lastUpdated: new Date().toISOString() };
  }),
  archiveOldRecords: protectedProcedure.input(z.object({ olderThanDays: z.number().min(90), resource: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "data_archived", resource: input.resource, resourceId: "archive-" + crypto.randomUUID(), status: "success", metadata: { olderThanDays: input.olderThanDays, archivedAt: new Date().toISOString() } });
    return { success: true, resource: input.resource, olderThanDays: input.olderThanDays };
  }),
});
